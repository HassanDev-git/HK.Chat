const express = require('express');
const crypto = require('crypto');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// GET ALL CHATS for current user
router.get('/', auth, (req, res) => {
  try {
    const chats = db.prepare(`
      SELECT c.*, cm.unread_count, cm.is_archived as member_archived, 
             cm.is_pinned as member_pinned, cm.is_muted as member_muted
      FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id
      WHERE cm.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(req.user.id);

    // Enrich chats with last message and other member info
    const enrichedChats = chats.map(chat => {
      // Get last message
      const lastMessage = db.prepare(`
        SELECT m.*, u.display_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.chat_id = ? AND m.is_deleted = 0
        ORDER BY m.created_at DESC LIMIT 1
      `).get(chat.id);

      // Get members
      const members = db.prepare(`
        SELECT u.id, u.display_name, u.unique_id, u.profile_pic, u.is_online, u.last_seen, cm.role
        FROM chat_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = ?
      `).all(chat.id);

      // For private chats, get the other user's info
      let otherUser = null;
      if (chat.type === 'private') {
        otherUser = members.find(m => m.id !== req.user.id);
      }

      return {
        ...chat,
        lastMessage,
        members,
        otherUser,
        unread_count: chat.unread_count || 0
      };
    });

    res.json({ chats: enrichedChats });
  } catch (err) {
    console.error('Get chats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE OR GET PRIVATE CHAT
router.post('/private', auth, (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Check if private chat already exists
    const existingChat = db.prepare(`
      SELECT c.id FROM chats c
      JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = ?
      JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = ?
      WHERE c.type = 'private'
    `).get(req.user.id, userId);

    if (existingChat) {
      // Return existing chat
      const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(existingChat.id);
      const members = db.prepare(`
        SELECT u.id, u.display_name, u.unique_id, u.profile_pic, u.is_online, u.last_seen, cm.role
        FROM chat_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = ?
      `).all(chat.id);
      const otherUser = members.find(m => m.id !== req.user.id);

      return res.json({ chat: { ...chat, members, otherUser }, created: false });
    }

    // Create new private chat
    const result = db.prepare(`
      INSERT INTO chats (type, created_by) VALUES ('private', ?)
    `).run(req.user.id);

    const chatId = result.lastInsertRowid;

    // Add both members
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.user.id, 'admin');
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, userId, 'member');

    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    const members = db.prepare(`
      SELECT u.id, u.display_name, u.unique_id, u.profile_pic, u.is_online, u.last_seen, cm.role
      FROM chat_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.chat_id = ?
    `).all(chatId);
    const otherUser = members.find(m => m.id !== req.user.id);

    res.status(201).json({ chat: { ...chat, members, otherUser }, created: true });
  } catch (err) {
    console.error('Create private chat error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// CREATE GROUP CHAT
router.post('/group', auth, (req, res) => {
  try {
    const { name, description, members, group_pic } = req.body;

    if (!name || !members || members.length < 1) {
      return res.status(400).json({ error: 'Group name and at least 1 member required' });
    }

    const result = db.prepare(`
      INSERT INTO chats (type, name, description, group_pic, created_by) 
      VALUES ('group', ?, ?, ?, ?)
    `).run(name, description || '', group_pic || null, req.user.id);

    const chatId = result.lastInsertRowid;

    // Add creator as admin
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.user.id, 'admin');

    // Add other members
    const insertMember = db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)');
    for (const memberId of members) {
      insertMember.run(chatId, memberId, 'member');
    }

    // Add system message
    db.prepare(`
      INSERT INTO messages (chat_id, sender_id, type, content) 
      VALUES (?, ?, 'system', ?)
    `).run(chatId, req.user.id, `Group "${name}" created`);

    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    const chatMembers = db.prepare(`
      SELECT u.id, u.display_name, u.unique_id, u.profile_pic, u.is_online, u.last_seen, cm.role
      FROM chat_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.chat_id = ?
    `).all(chatId);

    res.status(201).json({ chat: { ...chat, members: chatMembers } });
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE GROUP (name, description, pic)
router.put('/group/:chatId', auth, (req, res) => {
  try {
    const { name, description, group_pic } = req.body;
    const chatId = req.params.chatId;

    // Verify user is admin
    const membership = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update group' });
    }

    const updates = [];
    const values = [];
    if (name) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (group_pic !== undefined) { updates.push('group_pic = ?'); values.push(group_pic); }

    if (updates.length > 0) {
      updates.push("updated_at = datetime('now')");
      values.push(chatId);
      db.prepare(`UPDATE chats SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    }

    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    res.json({ chat });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ADD MEMBER TO GROUP
router.post('/group/:chatId/members', auth, (req, res) => {
  try {
    const { userId } = req.body;
    const chatId = parseInt(req.params.chatId);

    const membership = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, userId, 'member');

    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
    db.prepare(`INSERT INTO messages (chat_id, sender_id, type, content) VALUES (?, ?, 'system', ?)`)
      .run(chatId, req.user.id, `${user.display_name} was added to the group`);

    res.json({ message: 'Member added' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// REMOVE MEMBER FROM GROUP
router.delete('/group/:chatId/members/:userId', auth, (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);
    const userId = req.params.userId;

    const membership = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }

    db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(chatId, parseInt(userId));

    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(parseInt(userId));
    db.prepare(`INSERT INTO messages (chat_id, sender_id, type, content) VALUES (?, ?, 'system', ?)`)
      .run(chatId, req.user.id, `${user.display_name} was removed from the group`);

    res.json({ message: 'Member removed' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// LEAVE GROUP
router.post('/group/:chatId/leave', auth, (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);
    db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(chatId, req.user.id);

    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
    db.prepare(`INSERT INTO messages (chat_id, sender_id, type, content) VALUES (?, ?, 'system', ?)`)
      .run(chatId, req.user.id, `${user.display_name} left the group`);

    res.json({ message: 'Left group' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE ALL CHATS for current user (must be before /:chatId to avoid matching)
router.delete('/all/clear', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM chat_members WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'All chats cleared' });
  } catch (err) {
    console.error('Delete all chats error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE CHAT
router.delete('/:chatId', auth, (req, res) => {
  try {
    const chatId = req.params.chatId;
    db.prepare('DELETE FROM chat_members WHERE chat_id = ? AND user_id = ?').run(chatId, req.user.id);
    res.json({ message: 'Chat deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ARCHIVE/UNARCHIVE CHAT
router.put('/:chatId/archive', auth, (req, res) => {
  try {
    const chatId = req.params.chatId;
    const member = db.prepare('SELECT is_archived FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    const newState = member.is_archived ? 0 : 1;
    db.prepare('UPDATE chat_members SET is_archived = ? WHERE chat_id = ? AND user_id = ?').run(newState, chatId, req.user.id);
    res.json({ archived: !!newState });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PIN/UNPIN CHAT
router.put('/:chatId/pin', auth, (req, res) => {
  try {
    const chatId = req.params.chatId;
    const member = db.prepare('SELECT is_pinned FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    const newState = member.is_pinned ? 0 : 1;
    db.prepare('UPDATE chat_members SET is_pinned = ? WHERE chat_id = ? AND user_id = ?').run(newState, chatId, req.user.id);
    res.json({ pinned: !!newState });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// MUTE/UNMUTE CHAT
router.put('/:chatId/mute', auth, (req, res) => {
  try {
    const chatId = req.params.chatId;
    const member = db.prepare('SELECT is_muted FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    const newState = member.is_muted ? 0 : 1;
    db.prepare('UPDATE chat_members SET is_muted = ? WHERE chat_id = ? AND user_id = ?').run(newState, chatId, req.user.id);
    res.json({ muted: !!newState });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================
// GROUP INVITE SYSTEM
// ==================

// GENERATE INVITE LINK for a group
router.post('/group/:chatId/invite', auth, (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);

    // Check group exists and user is a member
    const chat = db.prepare('SELECT * FROM chats WHERE id = ? AND type = ?').get(chatId, 'group');
    if (!chat) return res.status(404).json({ error: 'Group not found' });

    const membership = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can generate invite links' });
    }

    // Check if there's already an active invite
    const existing = db.prepare('SELECT * FROM group_invites WHERE chat_id = ? AND is_active = 1').get(chatId);
    if (existing) {
      return res.json({ invite: existing });
    }

    // Generate new invite code
    const inviteCode = crypto.randomBytes(8).toString('hex');
    const result = db.prepare(`
      INSERT INTO group_invites (chat_id, invite_code, created_by) VALUES (?, ?, ?)
    `).run(chatId, inviteCode, req.user.id);

    const invite = db.prepare('SELECT * FROM group_invites WHERE id = ?').get(result.lastInsertRowid);
    res.json({ invite });
  } catch (err) {
    console.error('Generate invite error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET INVITE LINK for a group
router.get('/group/:chatId/invite', auth, (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);
    
    const membership = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'Not a member' });

    const invite = db.prepare('SELECT * FROM group_invites WHERE chat_id = ? AND is_active = 1').get(chatId);
    res.json({ invite: invite || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// REVOKE INVITE LINK
router.delete('/group/:chatId/invite', auth, (req, res) => {
  try {
    const chatId = parseInt(req.params.chatId);
    
    const membership = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can revoke invite links' });
    }

    db.prepare('UPDATE group_invites SET is_active = 0 WHERE chat_id = ?').run(chatId);
    res.json({ message: 'Invite revoked' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// JOIN GROUP VIA INVITE CODE
router.post('/group/join/:inviteCode', auth, (req, res) => {
  try {
    const { inviteCode } = req.params;

    const invite = db.prepare('SELECT * FROM group_invites WHERE invite_code = ? AND is_active = 1').get(inviteCode);
    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invite link' });
    }

    // Check max uses
    if (invite.max_uses > 0 && invite.use_count >= invite.max_uses) {
      return res.status(400).json({ error: 'This invite link has reached its maximum uses' });
    }

    // Check expiry
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return res.status(400).json({ error: 'This invite link has expired' });
    }

    const chatId = invite.chat_id;

    // Check if already a member
    const existingMember = db.prepare('SELECT * FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (existingMember) {
      // Already a member, just return the chat
      const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
      const members = db.prepare(`
        SELECT u.id, u.display_name, u.unique_id, u.profile_pic, u.is_online, u.last_seen, cm.role
        FROM chat_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.chat_id = ?
      `).all(chatId);
      return res.json({ chat: { ...chat, members }, alreadyMember: true });
    }

    // Add to group
    db.prepare('INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)').run(chatId, req.user.id, 'member');

    // Update invite use count
    db.prepare('UPDATE group_invites SET use_count = use_count + 1 WHERE id = ?').run(invite.id);

    // Add system message
    const joiner = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.user.id);
    db.prepare(`INSERT INTO messages (chat_id, sender_id, type, content) VALUES (?, ?, 'system', ?)`)
      .run(chatId, req.user.id, `${joiner.display_name} joined via invite link`);

    // Return chat info
    const chat = db.prepare('SELECT * FROM chats WHERE id = ?').get(chatId);
    const members = db.prepare(`
      SELECT u.id, u.display_name, u.unique_id, u.profile_pic, u.is_online, u.last_seen, cm.role
      FROM chat_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.chat_id = ?
    `).all(chatId);

    db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);

    res.json({ chat: { ...chat, members }, joined: true });
  } catch (err) {
    console.error('Join via invite error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET INVITE INFO (public - for preview before joining)
router.get('/invite/:inviteCode', auth, (req, res) => {
  try {
    const { inviteCode } = req.params;

    const invite = db.prepare('SELECT * FROM group_invites WHERE invite_code = ? AND is_active = 1').get(inviteCode);
    if (!invite) {
      return res.status(404).json({ error: 'Invalid or expired invite link' });
    }

    const chat = db.prepare('SELECT id, name, description, group_pic, type FROM chats WHERE id = ?').get(invite.chat_id);
    const memberCount = db.prepare('SELECT COUNT(*) as count FROM chat_members WHERE chat_id = ?').get(invite.chat_id);
    const isMember = db.prepare('SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?').get(invite.chat_id, req.user.id);

    res.json({
      group: {
        id: chat.id,
        name: chat.name,
        description: chat.description,
        group_pic: chat.group_pic,
        memberCount: memberCount.count
      },
      isMember: !!isMember
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ADD MEMBERS TO GROUP (admin adds directly)
router.post('/group/:chatId/members/bulk', auth, (req, res) => {
  try {
    const { userIds } = req.body;
    const chatId = parseInt(req.params.chatId);

    const membership = db.prepare('SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, req.user.id);
    if (!membership || membership.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    const insertMember = db.prepare('INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)');
    const addedUsers = [];

    for (const userId of userIds) {
      const existing = db.prepare('SELECT id FROM chat_members WHERE chat_id = ? AND user_id = ?').get(chatId, userId);
      if (!existing) {
        insertMember.run(chatId, userId, 'member');
        const u = db.prepare('SELECT display_name FROM users WHERE id = ?').get(userId);
        if (u) {
          db.prepare(`INSERT INTO messages (chat_id, sender_id, type, content) VALUES (?, ?, 'system', ?)`)
            .run(chatId, req.user.id, `${u.display_name} was added to the group`);
          addedUsers.push(userId);
        }
      }
    }

    db.prepare("UPDATE chats SET updated_at = datetime('now') WHERE id = ?").run(chatId);

    // Return updated members
    const members = db.prepare(`
      SELECT u.id, u.display_name, u.unique_id, u.profile_pic, u.is_online, u.last_seen, cm.role
      FROM chat_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.chat_id = ?
    `).all(chatId);

    res.json({ members, addedUsers });
  } catch (err) {
    console.error('Bulk add members error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
