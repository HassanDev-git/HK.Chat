const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const chatRoutes = require('./routes/chats');
const messageRoutes = require('./routes/messages');
const statusRoutes = require('./routes/status');
const uploadRoutes = require('./routes/upload');

// Import socket handler
const { setupSocket } = require('./socket/handler');

const app = express();
const server = http.createServer(app);

// CORS origins - allow all local network IPs
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173', 'http://146.190.49.154'];

// Also allow any IP on common local network ranges
const corsOriginHandler = (origin, callback) => {
  // Allow requests with no origin (mobile apps, curl, etc)
  if (!origin) return callback(null, true);
  // Allow listed origins
  if (allowedOrigins.includes(origin)) return callback(null, true);
  // Allow any local network IP (192.168.x.x, 10.x.x.x, 172.16-31.x.x)
  const localPattern = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|localhost|127\.0\.0\.1)/;
  if (localPattern.test(origin)) return callback(null, true);
  callback(null, true); // Allow all for development
};

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: corsOriginHandler,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// Middleware
app.use(compression()); // Gzip compression - makes ngrok much faster
app.use(cors({
  origin: corsOriginHandler,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'HK Chat Server is running!' });
});

// Serve client build (for ngrok/production - skip in dev when Vite handles it)
const clientDistPath = path.join(__dirname, '..', 'client', 'dist');
const fs = require('fs');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath, {
    maxAge: '1d', // Cache static assets for 1 day 
    etag: true
  }));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads') && !req.path.startsWith('/socket.io')) {
      res.sendFile(path.join(clientDistPath, 'index.html'));
    }
  });
  console.log('  📦 Serving client build from dist/');
}

// Setup Socket.IO
setupSocket(io);

const PORT = process.env.PORT || 5000;

server.listen(PORT, '0.0.0.0', () => {
  // Get local network IP
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
    if (localIP !== 'localhost') break;
  }
  console.log(`
  ╔══════════════════════════════════════════════╗
  ║     🟢 HK Chat Server Running                ║
  ║     Port: ${PORT}                               ║
  ║     Local:   http://localhost:${PORT}             ║
  ║     Network: http://${localIP}:${PORT}       ║
  ╚══════════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
