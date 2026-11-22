import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../config/database.js';
import config from '../config/index.js';
import { isValidUUID } from '../utils/validation.js';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Register a new customer user.
 * Validates name, normalized email, and password. Role is strictly 'customer'.
 */
export const register = async ({ name, email, password }) => {
  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    const error = new Error('Name must be a valid string of at least 2 characters.');
    error.statusCode = 400;
    throw error;
  }

  if (!email || typeof email !== 'string' || !EMAIL_REGEX.test(email.trim())) {
    const error = new Error('Please provide a valid email address.');
    error.statusCode = 400;
    throw error;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    const error = new Error('Password must be at least 6 characters long.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();

  // Check if email is already registered
  const existingUser = await pool.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
  if (existingUser.rows.length > 0) {
    const error = new Error('Email is already registered.');
    error.statusCode = 409;
    throw error;
  }

  // Hash password with bcrypt
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // Insert user with enforced 'customer' role and is_active = true
  const insertResult = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, is_active)
     VALUES ($1, $2, $3, 'customer', true)
     RETURNING id, name, email, role, is_active, created_at`,
    [trimmedName, normalizedEmail, passwordHash]
  );

  const user = insertResult.rows[0];

  // Sign JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  return { user, token };
};

/**
 * Login user with email and password.
 */
export const login = async ({ email, password }) => {
  if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
    const error = new Error('Email and password are required.');
    error.statusCode = 400;
    throw error;
  }

  const normalizedEmail = email.trim().toLowerCase();

  const userResult = await pool.query(
    `SELECT u.id, u.name, u.email, u.password_hash, u.role, u.is_active, u.created_at,
            rp.assigned_city, rp.approval_status
     FROM users u
     LEFT JOIN retailer_profiles rp ON rp.user_id = u.id
     WHERE LOWER(u.email) = LOWER($1)`,
    [normalizedEmail]
  );

  if (userResult.rows.length === 0) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const user = userResult.rows[0];

  if (!user.is_active) {
    const error = new Error('Account is deactivated. Please contact support.');
    error.statusCode = 403;
    throw error;
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordMatch) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  // Exclude password_hash from response
  delete user.password_hash;

  if (user.assigned_city) {
    user.retailerProfile = {
      assigned_city: user.assigned_city,
      approval_status: user.approval_status,
    };
  }

  return { user, token };
};

/**
 * Fetch current user profile by user ID.
 */
export const getCurrentUser = async (userId) => {
  if (!isValidUUID(userId)) {
    const error = new Error('Invalid user ID.');
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at,
            rp.assigned_city, rp.approval_status
     FROM users u
     LEFT JOIN retailer_profiles rp ON rp.user_id = u.id
     WHERE u.id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    const error = new Error('User not found.');
    error.statusCode = 404;
    throw error;
  }

  const user = result.rows[0];
  if (user.assigned_city) {
    user.retailerProfile = {
      assigned_city: user.assigned_city,
      approval_status: user.approval_status,
    };
  }

  return user;
};
