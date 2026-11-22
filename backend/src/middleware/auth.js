import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import pool from '../config/database.js';

/**
 * Authentication middleware verifying Authorization: Bearer <token>
 * Attaches decoded user payload (id, email, role) to req.user.
 */
export const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 'error',
      message: 'Authorization token required. Please provide a Bearer token.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        status: 'error',
        message: 'Token expired. Please log in again.',
      });
    }

    return res.status(401).json({
      status: 'error',
      message: 'Invalid authorization token.',
    });
  }
};

/**
 * Role-based authorization middleware.
 * Verifies live user record in PostgreSQL for is_active and role permissions.
 * If user is retailer, verifies approval_status is APPROVED.
 */
export const requireRole = (...allowedRoles) => {
  const normalizedAllowedRoles = allowedRoles.map((r) => r.toLowerCase());

  return async (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required before role verification.',
      });
    }

    try {
      const userRes = await pool.query(
        'SELECT id, email, role, is_active FROM users WHERE id = $1',
        [req.user.id]
      );

      if (userRes.rows.length === 0) {
        return res.status(401).json({
          status: 'error',
          message: 'User account not found.',
        });
      }

      const dbUser = userRes.rows[0];

      if (!dbUser.is_active) {
        return res.status(403).json({
          status: 'error',
          message: 'User account is deactivated. Access denied.',
        });
      }

      const userRole = (dbUser.role || '').toLowerCase();
      req.user.role = userRole;
      req.user.is_active = dbUser.is_active;

      if (!normalizedAllowedRoles.includes(userRole)) {
        return res.status(403).json({
          status: 'error',
          message: 'Access denied. Insufficient permissions for this resource.',
        });
      }

      // If role is retailer, verify profile and approval_status
      if (userRole === 'retailer') {
        const profileRes = await pool.query(
          'SELECT id, user_id, assigned_city, approval_status FROM retailer_profiles WHERE user_id = $1',
          [dbUser.id]
        );

        if (profileRes.rows.length === 0) {
          return res.status(403).json({
            status: 'error',
            message: 'Retailer profile not configured. Access denied.',
          });
        }

        const profile = profileRes.rows[0];
        if (profile.approval_status !== 'APPROVED') {
          return res.status(403).json({
            status: 'error',
            message: `Retailer account is ${profile.approval_status}. Access denied.`,
          });
        }

        req.retailer = profile;
        req.user.retailerProfile = profile;
        req.user.assignedCity = profile.assigned_city;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
};

export default requireAuth;
