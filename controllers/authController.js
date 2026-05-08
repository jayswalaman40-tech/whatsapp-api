/**
 * Auth Controller — Registration, Login, API Key management
 */

const User = require('../models/User');
const ApiKey = require('../models/ApiKey');
const { generateToken } = require('../middleware/auth');
const validator = require('validator');

/**
 * POST /api/auth/register
 * Create a new admin account
 */
async function register(req, res) {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.',
        code: 'MISSING_FIELDS'
      });
    }

    if (username.length < 3 || username.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Username must be 3-50 characters.',
        code: 'INVALID_USERNAME'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters.',
        code: 'WEAK_PASSWORD'
      });
    }

    // Create user
    const user = User.create(username, password);
    const token = generateToken(user);

    console.log(`👤 New user registered: ${username}`);

    res.status(201).json({
      success: true,
      data: {
        user: { id: user.id, username: user.username },
        token
      }
    });
  } catch (err) {
    if (err.message.includes('already exists')) {
      return res.status(409).json({
        success: false,
        error: 'Username already exists.',
        code: 'USER_EXISTS'
      });
    }
    console.error('Registration error:', err);
    res.status(500).json({
      success: false,
      error: 'Registration failed.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * POST /api/auth/login
 * Login and get JWT token
 */
async function login(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required.',
        code: 'MISSING_FIELDS'
      });
    }

    // Find user
    const user = User.findByUsername(username);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Verify password
    const isValid = User.verifyPassword(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid username or password.',
        code: 'INVALID_CREDENTIALS'
      });
    }

    // Generate token
    const token = generateToken({ id: user.id, username: user.username });

    console.log(`🔑 User logged in: ${username}`);

    res.json({
      success: true,
      data: {
        user: { id: user.id, username: user.username },
        token
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Login failed.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * POST /api/auth/api-key
 * Generate a new API key (requires JWT auth)
 */
async function generateApiKey(req, res) {
  try {
    const { name } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'API key name is required.',
        code: 'MISSING_NAME'
      });
    }

    const apiKey = ApiKey.create(name.trim(), req.user.id);

    console.log(`🔑 New API key created: ${name} (user: ${req.user.username})`);

    res.status(201).json({
      success: true,
      data: apiKey
    });
  } catch (err) {
    console.error('API key generation error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to generate API key.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * GET /api/auth/api-keys
 * List all API keys for the current user
 */
async function listApiKeys(req, res) {
  try {
    const keys = ApiKey.findByUserId(req.user.id);

    res.json({
      success: true,
      data: keys
    });
  } catch (err) {
    console.error('List API keys error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys.',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * DELETE /api/auth/api-key/:id
 * Delete an API key
 */
async function deleteApiKey(req, res) {
  try {
    const { id } = req.params;
    const deleted = ApiKey.delete(parseInt(id), req.user.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'API key not found.',
        code: 'NOT_FOUND'
      });
    }

    res.json({
      success: true,
      data: { message: 'API key deleted.' }
    });
  } catch (err) {
    console.error('Delete API key error:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to delete API key.',
      code: 'SERVER_ERROR'
    });
  }
}

module.exports = { register, login, generateApiKey, listApiKeys, deleteApiKey };
