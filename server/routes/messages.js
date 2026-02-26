const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET MESSAGES for a chat
router.get('/:chatId', auth, (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { before, limit = 50 } = req.query;

    // Verify user is chat member
    const member = db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    let messages;
    if (before) {
      messages = db.prepare(`
        SELECT m.*, u.display_name as sender_name, u.profile_pic as sender_pic, u.unique_id as sender_unique_id
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ? AND m.id < ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(chatId, before, parseInt(limit));
    } else {
      messages = db.prepare(`
        SELECT m.*, u.display_name as sender_name, u.profile_pic as sender_pic, u.unique_id as sender_unique_id
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ?
        ORDER BY m.created_at DESC
        LIMIT ?
      `).all(chatId, parseInt(limit));
    }

    // Get reply-to messages
    const enrichedMessages = messages.map(msg => {
      let replyMessage = null;
      if (msg.reply_to) {
        replyMessage = db.prepare(`
          SELECT m.id, m.content, m.type, u.display_name as sender_name
          FROM messages m
          JOIN users u ON m.sender_id = u.id
          WHERE m.id = ?
        `).get(msg.reply_to);
      }
      return { ...msg, replyMessage };
    });

    // Reset unread count
    db.prepare('UPDATE chat_members SET unread_count = 0 WHERE chat_id = ? AND user_id = ?').run(chatId, req.user.id);

    res.json({ messages: enrichedMessages.reverse() });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// SEND MESSAGE
router.post('/:chatId', auth, (req, res) => {
  try {
    const chatId = req.params.chatId;
    const { type = 'text', content, file_url, file_name, file_size, file_type, thumbnail_url, duration, reply_to, forwarded_from, is_forwarded } = req.body;

    // Verify user is chat member
    const member = db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this chat' });
    }

    // Check if blocked in private chat
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    if (chat.type === 'private') {
      const otherMember = db.prepare('SELECT user_id FROM chat_members WHERE chat_id = ? AND user_id != ?').get(chatId, req.user.id);
      if (otherMember) {
        // Check if the other user blocked me
        const otherSettings = db.prepare('SELECT blocked_users FROM user_settings WHERE user_id = ?').get(otherMember.user_id);
        if (otherSettings) {
          const blockedByOther = JSON.parse(otherSettings.blocked_users || '[]');
          if (blockedByOther.includes(req.user.id)) {
            return res.status(403).json({ error: 'You cannot send messages to this user' });
          }
        }
        // Check if I blocked the other user
        const mySettings = db.prepare('SELECT blocked_users FROM user_settings WHERE user_id = ?').get(req.user.id);
        if (mySettings) {
          const myBlocked = JSON.parse(mySettings.blocked_users || '[]');
          if (myBlocked.includes(otherMember.user_id)) {
            return res.status(403).json({ error: 'You have blocked this user. Unblock to send messages.' });
          }
        }
      }
    }

    const result = db.prepare(`
      INSERT INTO messages (chat_id, sender_id, type, content, file_url, file_name, file_size, file_type, thumbnail_url, duration, reply_to, forwarded_from, is_forwarded)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(chatId, req.user.id, type, content || '', file_url || null, file_name || null, file_size || null, file_type || null, thumbnail_url || null, duration || null, reply_to || null, forwarded_from || null, is_forwarded ? 1 : 0);

    // Update chat timestamp
    db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);

    // Update unread count for other members
    db.prepare('UPDATE chat_members SET unread_count = unread_count + 1 WHERE chat_id = ? AND user_id != ?').run(chatId, req.user.id);

    const message = db.prepare(`
      SELECT m.*, u.display_name as sender_name, u.profile_pic as sender_pic, u.unique_id as sender_unique_id
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    // Get reply message if exists
    let replyMessage = null;
    if (reply_to) {
      replyMessage = db.prepare(`
        SELECT m.id, m.content, m.type, u.display_name as sender_name
        FROM messages m JOIN users u ON m.sender_id = u.id
        WHERE m.id = ?
      `).get(reply_to);
    }

    res.status(201).json({ message: { ...message, replyMessage } });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE MESSAGE
router.delete('/:messageId', auth, (req, res) => {
  try {
    const { deleteForEveryone } = req.query;
    const messageId = req.params.messageId;

    const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    if (deleteForEveryone === 'true' && message.sender_id === req.user.id) {
      db.prepare("UPDATE messages SET is_deleted = 1, content = 'This message was deleted', file_url = NULL WHERE id = ?").run(messageId);
    }

    res.json({ message: 'Message deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// EDIT MESSAGE
router.put('/:messageId', auth, (req, res) => {
  try {
    const { content } = req.body;
    const messageId = req.params.messageId;

    const message = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(messageId, req.user.id);
    if (!message) {
      return res.status(404).json({ error: 'Message not found or not yours' });
    }

    db.prepare("UPDATE messages SET content = ?, is_edited = 1, edited_at = datetime('now') WHERE id = ?").run(content, messageId);

    const updated = db.prepare(`
      SELECT m.*, u.display_name as sender_name, u.profile_pic as sender_pic
      FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
    `).get(messageId);

    res.json({ message: updated });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// STAR/UNSTAR MESSAGE
router.put('/:messageId/star', auth, (req, res) => {
  try {
    const messageId = req.params.messageId;
    const existing = db.prepare('SELECT * FROM starred_messages WHERE message_id = ? AND user_id = ?').get(messageId, req.user.id);

    if (existing) {
      db.prepare('DELETE FROM starred_messages WHERE message_id = ? AND user_id = ?').run(messageId, req.user.id);
      res.json({ starred: false });
    } else {
      db.prepare('INSERT INTO starred_messages (message_id, user_id) VALUES (?, ?)').run(messageId, req.user.id);
      res.json({ starred: true });
    }
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET STARRED MESSAGES
router.get('/starred/all', auth, (req, res) => {
  try {
    const messages = db.prepare(`
      SELECT m.*, u.display_name as sender_name, u.profile_pic as sender_pic, c.name as chat_name
      FROM starred_messages sm
      JOIN messages m ON sm.message_id = m.id
      JOIN users u ON m.sender_id = u.id
      JOIN chats c ON m.chat_id = c.id
      WHERE sm.user_id = ?
      ORDER BY sm.created_at DESC
    `).all(req.user.id);

    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// FORWARD MESSAGE
router.post('/:messageId/forward', auth, (req, res) => {
  try {
    const { chatIds } = req.body;
    const messageId = req.params.messageId;

    const original = db.prepare('SELECT * FROM messages WHERE id = ?').get(messageId);
    if (!original) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const insertMsg = db.prepare(`
      INSERT INTO messages (chat_id, sender_id, type, content, file_url, file_name, file_size, file_type, thumbnail_url, duration, forwarded_from, is_forwarded)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    const forwarded = [];
    for (const chatId of chatIds) {
      const result = insertMsg.run(chatId, req.user.id, original.type, original.content, original.file_url, original.file_name, original.file_size, original.file_type, original.thumbnail_url, original.duration, messageId);
      db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);
      const msg = db.prepare(`
        SELECT m.*, u.display_name as sender_name, u.profile_pic as sender_pic
        FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
      `).get(result.lastInsertRowid);
      forwarded.push(msg);
    }

    res.json({ messages: forwarded });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
