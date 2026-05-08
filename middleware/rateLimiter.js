/**
 * Rate Limiting Middleware
 * Protects the API from abuse with configurable limits.
 */

const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Default: 100 requests per minute per IP
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    // Use API key if present, otherwise IP
    return req.headers['x-api-key'] || req.ip;
  }
});

/**
 * Strict limiter for instance creation
 * 10 instance creations per hour per user
 */
const instanceCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Instance creation limit reached. Max 10 per hour.',
    code: 'INSTANCE_LIMIT_EXCEEDED'
  },
  keyGenerator: (req) => {
    return req.headers['x-api-key'] || req.ip;
  }
});

/**
 * Auth endpoint limiter (prevent brute force)
 * 20 attempts per 15 minutes
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts. Try again in 15 minutes.',
    code: 'AUTH_RATE_LIMIT'
  }
});

module.exports = {
  generalLimiter,
  instanceCreationLimiter,
  authLimiter
};
