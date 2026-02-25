const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// SEARCH USERS by @unique_id or name
router.get('/search', auth, (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 1) {
      return res.json({ users: [] });
    }

    let users;
    if (q.startsWith('@')) {
      // Search by unique ID
      users = db.prepare(`
        SELECT id, display_name, unique_id, about, profile_pic, is_online, last_seen 
        FROM users 
        WHERE unique_id LIKE ? AND id != ?
        LIMIT 20
      `).all(`%${q}%`, req.user.id);
    } else {
      // Search by name or unique ID
      users = db.prepare(`
        SELECT id, display_name, unique_id, about, profile_pic, is_online, last_seen 
        FROM users 
        WHERE (display_name LIKE ? OR unique_id LIKE ?) AND id != ?
        LIMIT 20
      `).all(`%${q}%`, `%@${q}%`, req.user.id);
    }

    res.json({ users });
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET USER PROFILE
router.get('/:id', auth, (req, res) => {
  try {
    const user = db.prepare(`
      SELECT id, display_name, unique_id, about, profile_pic, phone, is_online, last_seen, created_at 
      FROM users WHERE id = ?
    `).get(req.params.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE PROFILE
router.put('/profile', auth, (req, res) => {
  try {
    const { display_name, about, phone, profile_pic } = req.body;
    
    const updates = [];
    const values = [];

    if (display_name !== undefined) { updates.push('display_name = ?'); values.push(display_name); }
    if (about !== undefined) { updates.push('about = ?'); values.push(about); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (profile_pic !== undefined) { updates.push('profile_pic = ?'); values.push(profile_pic); }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push("updated_at = datetime('now')");
    values.push(req.user.id);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT id, email, display_name, unique_id, about, profile_pic, phone, is_online, last_seen, created_at FROM users WHERE id = ?')
      .get(req.user.id);

    res.json({ message: 'Profile updated', user });
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// UPDATE SETTINGS
router.put('/settings', auth, (req, res) => {
  try {
    const allowedFields = [
      'last_seen_visibility', 'profile_photo_visibility', 'about_visibility',
      'read_receipts', 'notifications', 'notification_sound', 'theme',
      'wallpaper', 'font_size', 'enter_to_send', 'media_auto_download'
    ];

    const updates = [];
    const values = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(req.body[field]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.id);

    db.prepare(`UPDATE user_settings SET ${updates.join(', ')} WHERE user_id = ?`).run(...values);

    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);

    res.json({ message: 'Settings updated', settings });
  } catch (err) {
    console.error('Update settings error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET SETTINGS
router.get('/settings/me', auth, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// BLOCK/UNBLOCK USER
router.post('/block/:userId', auth, (req, res) => {
  try {
    const targetId = parseInt(req.params.userId);
    const settings = db.prepare('SELECT blocked_users FROM user_settings WHERE user_id = ?').get(req.user.id);
    let blocked = JSON.parse(settings.blocked_users || '[]');

    if (blocked.includes(targetId)) {
      blocked = blocked.filter(id => id !== targetId);
    } else {
      blocked.push(targetId);
    }

    db.prepare('UPDATE user_settings SET blocked_users = ? WHERE user_id = ?')
      .run(JSON.stringify(blocked), req.user.id);

    res.json({ message: blocked.includes(targetId) ? 'User blocked' : 'User unblocked', blocked });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL USERS (for contacts)
router.get('/', auth, (req, res) => {
  try {
    const users = db.prepare(`
      SELECT id, display_name, unique_id, about, profile_pic, is_online, last_seen 
      FROM users WHERE id != ?
      ORDER BY display_name ASC
    `).all(req.user.id);

    res.json({ users });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
