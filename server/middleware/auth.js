// JWT auth middleware. Validates the Bearer token and attaches req.user
// ({ sub, email, role }). adminRequired gates admin-only routes.
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
}

export function adminRequired(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin privileges required.' });
  }
  next();
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.uid, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}
