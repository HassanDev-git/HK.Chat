const jwt = require('jsonwebtoken');
const db = require('../database');
const { JWT_SECRET } = require('../middleware/auth');

// Track online users: userId -> Set of socketIds
const onlineUsers = new Map();

function setupSocket(io) {
  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication required'));
    }
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.id;
      socket.userEmail = decoded.email;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`User connected: ${userId} (socket: ${socket.id})`);

    // Track online status
    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, new Set());
    }
    onlineUsers.get(userId).add(socket.id);

    // Update user online status
    db.prepare('UPDATE users SET is_online = 1, last_seen = datetime(\'now\') WHERE id = ?').run(userId);

    // Join user's chat rooms
    const chatMemberships = db.prepare('SELECT chat_id FROM chat_members WHERE user_id = ?').all(userId);
    chatMemberships.forEach(cm => {
      socket.join(`chat:${cm.chat_id}`);
    });

    // Broadcast online status
    socket.broadcast.emit('user:online', { userId, isOnline: true });

    // ==================
    // MESSAGE EVENTS
    // ==================

    socket.on('message:send', (data) => {
      const { chatId, message } = data;
      // Broadcast to chat room
      socket.to(`chat:${chatId}`).emit('message:receive', {
        chatId,
        message
      });
    });

    socket.on('message:delivered', (data) => {
      const { messageId, chatId } = data;
      const msg = db.prepare('SELECT delivered_to FROM messages WHERE id = ?').get(messageId);
      if (msg) {
        let delivered = JSON.parse(msg.delivered_to || '[]');
        if (!delivered.includes(userId)) {
          delivered.push(userId);
          db.prepare('UPDATE messages SET delivered_to = ? WHERE id = ?').run(JSON.stringify(delivered), messageId);
        }
        socket.to(`chat:${chatId}`).emit('message:delivered', { messageId, chatId, userId });
      }
    });

    socket.on('message:read', (data) => {
      const { chatId } = data;
      // Mark all messages as read
      const messages = db.prepare('SELECT id, read_by FROM messages WHERE chat_id = ? AND sender_id != ?').all(chatId, userId);
      messages.forEach(msg => {
        let readBy = JSON.parse(msg.read_by || '[]');
        if (!readBy.includes(userId)) {
          readBy.push(userId);
          db.prepare('UPDATE messages SET read_by = ? WHERE id = ?').run(JSON.stringify(readBy), msg.id);
        }
      });
      // Reset unread count
      db.prepare('UPDATE chat_members SET unread_count = 0 WHERE chat_id = ? AND user_id = ?').run(chatId, userId);
      socket.to(`chat:${chatId}`).emit('message:read', { chatId, userId });
    });

    socket.on('message:delete', (data) => {
      const { messageId, chatId } = data;
      socket.to(`chat:${chatId}`).emit('message:deleted', { messageId, chatId });
    });

    socket.on('message:edit', (data) => {
      const { messageId, chatId, content } = data;
      socket.to(`chat:${chatId}`).emit('message:edited', { messageId, chatId, content });
    });

    // ==================
    // TYPING EVENTS
    // ==================

    socket.on('typing:start', (data) => {
      const { chatId } = data;
      const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
      socket.to(`chat:${chatId}`).emit('typing:start', {
        chatId,
        userId,
        userName: user?.display_name
      });
    });

    socket.on('typing:stop', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('typing:stop', {
        chatId,
        userId
      });
    });

    // ==================
    // CHAT EVENTS
    // ==================

    socket.on('chat:join', (data) => {
      const { chatId } = data;
      socket.join(`chat:${chatId}`);
    });

    socket.on('chat:created', (data) => {
      const { chat } = data;
      // Notify all members
      if (chat.members) {
        chat.members.forEach(member => {
          const memberSockets = onlineUsers.get(member.id);
          if (memberSockets) {
            memberSockets.forEach(socketId => {
              io.to(socketId).emit('chat:new', { chat });
            });
          }
        });
      }
    });

    // ==================
    // GROUP EVENTS
    // ==================

    socket.on('group:memberAdded', (data) => {
      const { chatId, userId: newUserId } = data;
      const memberSockets = onlineUsers.get(newUserId);
      if (memberSockets) {
        memberSockets.forEach(sid => {
          io.sockets.sockets.get(sid)?.join(`chat:${chatId}`);
        });
      }
      socket.to(`chat:${chatId}`).emit('group:memberAdded', data);
    });

    socket.on('group:memberRemoved', (data) => {
      const { chatId, userId: removedUserId } = data;
      const memberSockets = onlineUsers.get(removedUserId);
      if (memberSockets) {
        memberSockets.forEach(sid => {
          io.sockets.sockets.get(sid)?.leave(`chat:${chatId}`);
        });
      }
      socket.to(`chat:${chatId}`).emit('group:memberRemoved', data);
    });

    socket.on('group:updated', (data) => {
      const { chatId } = data;
      socket.to(`chat:${chatId}`).emit('group:updated', data);
    });

    // ==================
    // STATUS EVENTS
    // ==================

    socket.on('status:new', (data) => {
      socket.broadcast.emit('status:new', { ...data, userId });
    });

    socket.on('status:viewed', (data) => {
      const { statusId, ownerId } = data;
      const ownerSockets = onlineUsers.get(ownerId);
      if (ownerSockets) {
        const user = db.prepare('SELECT display_name, profile_pic FROM users WHERE id = ?').get(userId);
        ownerSockets.forEach(sid => {
          io.to(sid).emit('status:viewed', { statusId, viewer: { id: userId, ...user } });
        });
      }
    });

    // ==================
    // VOICE/VIDEO CALL EVENTS (signaling)
    // ==================

    socket.on('call:initiate', (data) => {
      const { targetUserId, callType } = data;
      const caller = db.prepare('SELECT id, display_name, profile_pic FROM users WHERE id = ?').get(userId);
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:incoming', { caller, callType });
        });
      }
    });

    socket.on('call:accept', (data) => {
      const { callerId } = data;
      const callerSockets = onlineUsers.get(callerId);
      if (callerSockets) {
        callerSockets.forEach(sid => {
          io.to(sid).emit('call:accepted', { userId });
        });
      }
    });

    socket.on('call:reject', (data) => {
      const { callerId } = data;
      const callerSockets = onlineUsers.get(callerId);
      if (callerSockets) {
        callerSockets.forEach(sid => {
          io.to(sid).emit('call:rejected', { userId });
        });
      }
    });

    socket.on('call:end', (data) => {
      const { targetUserId } = data;
      const targetSockets = onlineUsers.get(targetUserId);
      if (targetSockets) {
        targetSockets.forEach(sid => {
          io.to(sid).emit('call:ended', { userId });
        });
      }
    });

    // ==================
    // DISCONNECT
    // ==================

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${userId} (socket: ${socket.id})`);

      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);
          // Update offline status
          db.prepare('UPDATE users SET is_online = 0, last_seen = datetime(\'now\') WHERE id = ?').run(userId);
          socket.broadcast.emit('user:online', { userId, isOnline: false, lastSeen: new Date().toISOString() });
        }
      }
    });
  });
}

module.exports = { setupSocket, onlineUsers };
