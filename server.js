/**
 * WhatsApp API Server — Main Entry Point
 * 
 * Production-ready WhatsApp Web API with multi-instance support,
 * REST API, real-time Socket.io dashboard, and webhook dispatch.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');

// Config & Database
const { initDatabase, closeDatabase } = require('./config/database');
const User = require('./models/User');
const SessionManager = require('./services/sessionManager');

// Middleware
const { generalLimiter } = require('./middleware/rateLimiter');

// Routes
const authRoutes = require('./routes/auth');
const instanceRoutes = require('./routes/instance');
const messageRoutes = require('./routes/message');

// ============================================
// App Initialization
// ============================================

const app = express();
const server = http.createServer(app);

// Socket.io setup with CORS
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGINS === '*' ? '*' : (process.env.CORS_ORIGINS || '').split(','),
    methods: ['GET', 'POST']
  }
});

// Initialize database
const db = initDatabase();

// Initialize session manager (manages all WhatsApp instances)
const sessionManager = new SessionManager(io);

// ============================================
// Middleware
// ============================================

// Security headers (relaxed for self-hosted dashboard)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

// CORS
const corsOrigins = process.env.CORS_ORIGINS === '*' ? '*' : (process.env.CORS_ORIGINS || '').split(',');
app.use(cors({
  origin: corsOrigins,
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use('/api/', generalLimiter);

// Attach sessionManager to all requests
app.use((req, res, next) => {
  req.sessionManager = sessionManager;
  next();
});

// Serve frontend (static files)
app.use(express.static(path.join(__dirname, 'public')));

// ============================================
// API Routes
// ============================================

// Health check endpoint (public — no auth required)
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'running',
      uptime: process.uptime(),
      activeInstances: sessionManager.getActiveCount(),
      timestamp: new Date().toISOString()
    }
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/instance', instanceRoutes);
app.use('/api', messageRoutes);

// Catch-all for frontend SPA (serve index.html for non-API routes)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found.',
      code: 'NOT_FOUND'
    });
  }
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('💥 Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error.',
    code: 'INTERNAL_ERROR'
  });
});

// ============================================
// Socket.io Connection Handling
// ============================================

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`🔌 Socket disconnected: ${socket.id}`);
  });

  // Client can subscribe to specific instance events
  socket.on('subscribe', (instanceId) => {
    socket.join(instanceId);
    console.log(`📡 Socket ${socket.id} subscribed to ${instanceId}`);
  });
});

// ============================================
// Server Startup
// ============================================

const PORT = process.env.PORT || 3000;

async function startServer() {
  // Create default admin user if none exists
  if (User.count() === 0) {
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'changeme123';

    try {
      User.create(adminUser, adminPass);
      console.log(`👤 Default admin account created: ${adminUser}`);
      console.log(`⚠️  CHANGE THE DEFAULT PASSWORD IMMEDIATELY!`);
    } catch (err) {
      console.error('Failed to create admin user:', err.message);
    }
  }

  // Restore previously active WhatsApp sessions
  await sessionManager.restoreInstances();

  // Start the server
  server.listen(PORT, () => {
    console.log('');
    console.log('╔══════════════════════════════════════════════╗');
    console.log('║        WhatsApp API Server Started           ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log(`║  🌐 Dashboard:  http://localhost:${PORT}         ║`);
    console.log(`║  📡 API Base:   http://localhost:${PORT}/api     ║`);
    console.log(`║  🔌 Socket.io:  ws://localhost:${PORT}           ║`);
    console.log(`║  📦 Mode:       ${(process.env.NODE_ENV || 'development').padEnd(24)}║`);
    console.log('╚══════════════════════════════════════════════╝');
    console.log('');
  });
}

// ============================================
// Graceful Shutdown
// ============================================

async function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);

  // Shut down all WhatsApp instances
  await sessionManager.shutdown();

  // Close database
  closeDatabase();

  // Close HTTP server
  server.close(() => {
    console.log('✅ Server closed. Goodbye!');
    process.exit(0);
  });

  // Force exit after 10 seconds
  setTimeout(() => {
    console.error('⚠️  Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  console.error('💥 Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('💥 Unhandled Rejection:', reason);
});

// Start!
startServer().catch(err => {
  console.error('💥 Failed to start server:', err);
  process.exit(1);
});
