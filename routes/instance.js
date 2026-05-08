/**
 * Instance Routes — /api/instance/*
 */

const express = require('express');
const router = express.Router();
const instanceController = require('../controllers/instanceController');
const { authenticateAny } = require('../middleware/auth');
const { instanceCreationLimiter } = require('../middleware/rateLimiter');

// All routes require authentication (JWT or API Key)
router.use(authenticateAny);

// Instance CRUD
router.post('/create', instanceCreationLimiter, instanceController.createInstance);
router.get('/list', instanceController.listInstances);
router.get('/:id/qr', instanceController.getQrCode);
router.get('/:id/status', instanceController.getStatus);
router.delete('/:id', instanceController.deleteInstance);

module.exports = router;
