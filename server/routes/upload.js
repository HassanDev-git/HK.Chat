const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '..', 'uploads');
const dirs = ['images', 'videos', 'audio', 'voice', 'documents', 'profiles', 'status'];
dirs.forEach(dir => {
  const dirPath = path.join(uploadsDir, dir);
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
});

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let folder = 'documents';
    const mime = file.mimetype;
    
    if (req.query.type === 'profile') folder = 'profiles';
    else if (req.query.type === 'status') folder = 'status';
    else if (req.query.type === 'voice') folder = 'voice';
    else if (mime.startsWith('image/')) folder = 'images';
    else if (mime.startsWith('video/')) folder = 'videos';
    else if (mime.startsWith('audio/')) folder = 'audio';

    cb(null, path.join(uploadsDir, folder));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
  fileFilter: (req, file, cb) => {
    cb(null, true); // Allow all file types
  }
});

// UPLOAD FILE
router.post('/', auth, upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileType = req.query.type || 'document';
    let folder = 'documents';
    const mime = req.file.mimetype;
    
    if (fileType === 'profile') folder = 'profiles';
    else if (fileType === 'status') folder = 'status';
    else if (fileType === 'voice') folder = 'voice';
    else if (mime.startsWith('image/')) folder = 'images';
    else if (mime.startsWith('video/')) folder = 'videos';
    else if (mime.startsWith('audio/')) folder = 'audio';

    const fileUrl = `/uploads/${folder}/${req.file.filename}`;

    res.json({
      url: fileUrl,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

// UPLOAD VOICE MESSAGE
router.post('/voice', auth, upload.single('voice'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No voice file uploaded' });
    }

    const fileUrl = `/uploads/voice/${req.file.filename}`;

    res.json({
      url: fileUrl,
      name: req.file.originalname || 'voice-message.webm',
      size: req.file.size,
      type: req.file.mimetype,
      duration: req.body.duration || 0
    });
  } catch (err) {
    console.error('Voice upload error:', err);
    res.status(500).json({ error: 'Upload failed' });
  }
});

module.exports = router;
