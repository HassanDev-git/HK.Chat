const express = require('express');
const db = require('../database');
const { auth } = require('../middleware/auth');

const router = express.Router();

// CREATE STATUS
router.post('/', auth, (req, res) => {
  try {
    const { type = 'text', content, background_color, font_style, file_url, thumbnail_url, caption } = req.body;

    const result = db.prepare(`
      INSERT INTO statuses (user_id, type, content, background_color, font_style, file_url, thumbnail_url, caption)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.user.id, type, content || '', background_color || '#128C7E', font_style || 'normal', file_url || null, thumbnail_url || null, caption || '');

    const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json({ status });
  } catch (err) {
    console.error('Create status error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL STATUSES (from contacts)
router.get('/', auth, (req, res) => {
  try {
    // Get my statuses
    const myStatuses = db.prepare(`
      SELECT s.*, u.display_name, u.profile_pic, u.unique_id
      FROM statuses s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id = ? AND s.expires_at > datetime('now')
      ORDER BY s.created_at ASC
    `).all(req.user.id);

    // Get others' statuses (users I have chatted with)
    const otherStatuses = db.prepare(`
      SELECT s.*, u.display_name, u.profile_pic, u.unique_id
      FROM statuses s
      JOIN users u ON s.user_id = u.id
      WHERE s.user_id != ? AND s.expires_at > datetime('now')
      AND s.user_id IN (
        SELECT DISTINCT cm2.user_id
        FROM chat_members cm1
        JOIN chat_members cm2 ON cm1.chat_id = cm2.chat_id
        WHERE cm1.user_id = ? AND cm2.user_id != ?
      )
      ORDER BY s.created_at ASC
    `).all(req.user.id, req.user.id, req.user.id);

    // Group by user
    const groupedStatuses = {};
    for (const status of otherStatuses) {
      if (!groupedStatuses[status.user_id]) {
        groupedStatuses[status.user_id] = {
          user: {
            id: status.user_id,
            display_name: status.display_name,
            profile_pic: status.profile_pic,
            unique_id: status.unique_id
          },
          statuses: []
        };
      }
      groupedStatuses[status.user_id].statuses.push(status);
    }

    res.json({
      myStatuses,
      otherStatuses: Object.values(groupedStatuses)
    });
  } catch (err) {
    console.error('Get statuses error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// VIEW STATUS (mark as seen)
router.post('/:statusId/view', auth, (req, res) => {
  try {
    const status = db.prepare('SELECT * FROM statuses WHERE id = ?').get(req.params.statusId);
    if (!status) {
      return res.status(404).json({ error: 'Status not found' });
    }

    let viewers = JSON.parse(status.viewers || '[]');
    if (!viewers.includes(req.user.id)) {
      viewers.push(req.user.id);
      db.prepare('UPDATE statuses SET viewers = ? WHERE id = ?').run(JSON.stringify(viewers), req.params.statusId);
    }

    res.json({ viewed: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE STATUS
router.delete('/:statusId', auth, (req, res) => {
  try {
    db.prepare('DELETE FROM statuses WHERE id = ? AND user_id = ?').run(req.params.statusId, req.user.id);
    res.json({ message: 'Status deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
