/**
 * Authentication Middleware
 * Supports both JWT Bearer token and X-API-Key header authentication.
 */

const jwt = require('jsonwebtoken');
const ApiKey = require('../models/ApiKey');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-change-me';

/**
 * Middleware: Verify JWT token from Authorization header
 */
function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No token provided.',
      code: 'NO_TOKEN'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token.',
      code: 'INVALID_TOKEN'
    });
  }
}

/**
 * Middleware: Verify API key from X-API-Key header
 */
function authenticateApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'Access denied. No API key provided.',
      code: 'NO_API_KEY'
    });
  }

  try {
    const keyRecord = ApiKey.findByKey(apiKey);

    if (!keyRecord) {
      return res.status(401).json({
        success: false,
        error: 'Invalid API key.',
        code: 'INVALID_API_KEY'
      });
    }

    // Update last used timestamp
    ApiKey.updateLastUsed(keyRecord.id);

    // Attach user info to request
    req.user = {
      id: keyRecord.user_id,
      username: keyRecord.username
    };
    req.apiKey = keyRecord;

    next();
  } catch (err) {
    console.error('API Key auth error:', err);
    return res.status(500).json({
      success: false,
      error: 'Authentication error.',
      code: 'AUTH_ERROR'
    });
  }
}

/**
 * Middleware: Accept EITHER JWT or API Key
 * First checks for X-API-Key, then falls back to JWT Bearer token.
 */
function authenticateAny(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const authHeader = req.headers.authorization;

  // Try API key first
  if (apiKey) {
    return authenticateApiKey(req, res, next);
  }

  // Fall back to JWT
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authenticateJWT(req, res, next);
  }

  return res.status(401).json({
    success: false,
    error: 'Access denied. Provide either X-API-Key header or Bearer token.',
    code: 'NO_AUTH'
  });
}

/**
 * Generate a JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

module.exports = {
  authenticateJWT,
  authenticateApiKey,
  authenticateAny,
  generateToken
};
