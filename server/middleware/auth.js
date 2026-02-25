const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'hkchat_super_secret_key_2024';

function auth(req, res, next) {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, unique_id: user.unique_id },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

module.exports = { auth, generateToken, JWT_SECRET };
