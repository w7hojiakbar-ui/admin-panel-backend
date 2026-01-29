const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const pool = require('../database');

const router = express.Router();

/**
 * POST /api/auth/login
 */
router.post(
  '/login',
  [
    body('username').notEmpty().withMessage('Username required'),
    body('password').notEmpty().withMessage('Password required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array(),
        });
      }

      const { username, password } = req.body;

      const result = await pool.query(
        'SELECT * FROM admins WHERE username = $1',
        [username]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const admin = result.rows[0];
      const isMatch = await bcrypt.compare(password, admin.password);

      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid credentials',
        });
      }

      const token = jwt.sign(
        { id: admin.id, username: admin.username },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({
        success: true,
        token,
        user: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
        },
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error' });
    }
  }
);

/**
 * POST /api/auth/register
 * (faqat bir marta ishlat, keyin o‘chir)
 */
router.post(
  '/register',
  [
    body('username').isLength({ min: 3 }),
    body('password').isLength({ min: 6 }),
    body('email').isEmail(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { username, password, email } = req.body;

      const exists = await pool.query(
        'SELECT id FROM admins WHERE username=$1 OR email=$2',
        [username, email]
      );

      if (exists.rows.length > 0) {
        return res
          .status(400)
          .json({ success: false, message: 'User exists' });
      }

      const hashed = await bcrypt.hash(password, 10);

      const result = await pool.query(
        'INSERT INTO admins(username,password,email) VALUES($1,$2,$3) RETURNING id,username,email',
        [username, hashed, email]
      );

      res.status(201).json({
        success: true,
        user: result.rows[0],
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  }
);

module.exports = router;
