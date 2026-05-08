/**
 * Message Routes — /api/message/*, /api/chats/*, /api/messages/*, /api/webhook/*
 */

const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateAny } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateAny);

// Messaging
router.post('/message/send', messageController.sendMessage);
router.post('/message/send-media', messageController.sendMedia);

// Chats & Messages
router.get('/chats/:instanceId', messageController.getChats);
router.get('/messages/:instanceId/:chatId', messageController.getMessages);

// Webhooks
router.post('/webhook/set', messageController.setWebhook);

module.exports = router;
