/**
 * Instance Controller — WhatsApp instance management
 */

const Instance = require('../models/Instance');

/**
 * POST /api/instance/create
 * Create a new WhatsApp instance
 */
async function createInstance(req, res) {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Instance name is required.',
        code: 'MISSING_NAME'
      });
    }

    // sessionManager is attached to req in server.js
    const result = await req.sessionManager.createInstance(name.trim(), req.user.id);

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (err) {
    console.error('Create instance error:', err);

    if (err.message.includes('limit reached')) {
      return res.status(429).json({
        success: false,
        error: err.message,
        code: 'INSTANCE_LIMIT_EXCEEDED'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to create instance.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * GET /api/instance/:id/qr
 * Get QR code for an instance
 */
async function getQrCode(req, res) {
  try {
    const { id } = req.params;
    const qrCode = req.sessionManager.getQrCode(id);

    if (!qrCode) {
      return res.status(404).json({
        success: false,
        error: 'QR code not available. Instance may already be connected or not found.',
        code: 'QR_NOT_AVAILABLE'
      });
    }

    res.json({
      success: true,
      data: { instanceId: id, qr: qrCode }
    });
  } catch (err) {
    console.error('Get QR error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get QR code.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * GET /api/instance/:id/status
 * Get instance connection status
 */
async function getStatus(req, res) {
  try {
    const { id } = req.params;
    const status = req.sessionManager.getInstanceStatus(id);

    if (!status) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found.',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    console.error('Get status error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to get status.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * DELETE /api/instance/:id
 * Delete an instance
 */
async function deleteInstance(req, res) {
  try {
    const { id } = req.params;

    // Verify instance exists
    const instance = Instance.findById(id);
    if (!instance) {
      return res.status(404).json({
        success: false,
        error: 'Instance not found.',
        code: 'NOT_FOUND'
      });
    }

    await req.sessionManager.deleteInstance(id);

    res.json({
      success: true,
      data: { message: 'Instance deleted successfully.' }
    });
  } catch (err) {
    console.error('Delete instance error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete instance.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * GET /api/instance/list
 * List all instances
 */
async function listInstances(req, res) {
  try {
    const instances = req.sessionManager.listInstances(req.user.id);

    res.json({
      success: true,
      data: instances
    });
  } catch (err) {
    console.error('List instances error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to list instances.',
      code: 'SERVER_ERROR'
    });
  }
}

module.exports = { createInstance, getQrCode, getStatus, deleteInstance, listInstances };
