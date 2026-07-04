// Rate limiters for sensitive auth endpoints (express-rate-limit).
//
// Per-IP, in-memory counters. Behind a reverse proxy set `trust proxy` (done in
// index.js for production) so req.ip is the real client, not the proxy.
//   • authLimiter    — credential / token guessing (login, verify, reset, change)
//   • accountLimiter — account creation + email-triggering (register, forgot)
import rateLimit from 'express-rate-limit';

const COMMON = {
  standardHeaders: true,   // emit RateLimit-* headers (current IETF draft)
  legacyHeaders: false,    // drop the deprecated X-RateLimit-* headers
};

// Tight cap on password / token guessing.
export const authLimiter = rateLimit({
  ...COMMON,
  windowMs: 15 * 60 * 1000,  // 15 minutes
  limit: 10,                 // 10 attempts per IP per window
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});

// Looser cap on actions that create accounts or send emails (abuse / enumeration).
export const accountLimiter = rateLimit({
  ...COMMON,
  windowMs: 60 * 60 * 1000,  // 1 hour
  limit: 20,                 // 20 requests per IP per window
  message: { error: 'Too many requests. Please try again later.' },
});
