/**
 * Auth Routes — /api/auth/*
 */

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateJWT } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

// Public routes (with rate limiting)
router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

// Protected routes (require JWT)
router.post('/api-key', authenticateJWT, authController.generateApiKey);
router.get('/api-keys', authenticateJWT, authController.listApiKeys);
router.delete('/api-key/:id', authenticateJWT, authController.deleteApiKey);

module.exports = router;
