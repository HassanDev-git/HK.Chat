const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database');
const { generateToken } = require('../middleware/auth');

const router = express.Router();

// Generate unique @id
function generateUniqueId(displayName) {
  const base = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
  const random = Math.floor(1000 + Math.random() * 9000);
  let uniqueId = `@${base}${random}`;
  
  // Make sure it's unique
  const existing = db.prepare('SELECT id FROM users WHERE unique_id = ?').get(uniqueId);
  if (existing) {
    return generateUniqueId(displayName); // Retry
  }
  return uniqueId;
}

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { email, password, display_name } = req.body;

    if (!email || !password || !display_name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if email already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique ID
    const unique_id = generateUniqueId(display_name);

    // Insert user
    const result = db.prepare(`
      INSERT INTO users (email, password, display_name, unique_id) 
      VALUES (?, ?, ?, ?)
    `).run(email, hashedPassword, display_name, unique_id);

    // Create default settings
    db.prepare(`INSERT INTO user_settings (user_id) VALUES (?)`).run(result.lastInsertRowid);

    const user = db.prepare('SELECT id, email, display_name, unique_id, about, profile_pic, created_at FROM users WHERE id = ?')
      .get(result.lastInsertRowid);

    const token = generateToken(user);

    res.status(201).json({
      message: 'Account created successfully',
      token,
      user
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Update online status
    db.prepare('UPDATE users SET is_online = 1 WHERE id = ?').run(user.id);

    const token = generateToken(user);

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: 'Login successful',
      token,
      user: userWithoutPassword
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET CURRENT USER
router.get('/me', require('../middleware/auth').auth, (req, res) => {
  try {
    const user = db.prepare('SELECT id, email, display_name, unique_id, about, profile_pic, phone, is_online, last_seen, created_at FROM users WHERE id = ?')
      .get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const settings = db.prepare('SELECT * FROM user_settings WHERE user_id = ?').get(req.user.id);

    res.json({ user, settings });
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
