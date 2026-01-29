const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

// @route   GET /api/students
// @desc    Get all students (with optional group filter)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { group_id } = req.query;

    let queryText = `
      SELECT s.*, g.name as group_name, g.monthly_fee
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
    `;
    
    const params = [];
    
    if (group_id) {
      queryText += ' WHERE s.group_id = $1';
      params.push(group_id);
    }
    
    queryText += ' ORDER BY s.created_at DESC';

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/students/:id
// @desc    Get single student
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(`
      SELECT s.*, g.name as group_name, g.monthly_fee
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE s.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   POST /api/students
// @desc    Create new student
// @access  Private
router.post('/',
  [
    body('group_id').isInt().withMessage('Valid group ID is required'),
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('join_date').isISO8601().withMessage('Valid join date is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { 
        group_id, 
        full_name, 
        phone_number, 
        parent_phone, 
        join_date,
        payment_status 
      } = req.body;

      // Verify group exists
      const groupCheck = await query(
        'SELECT id FROM groups WHERE id = $1',
        [group_id]
      );

      if (groupCheck.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Group not found' 
        });
      }

      const result = await query(
        `INSERT INTO students 
         (group_id, full_name, phone_number, parent_phone, join_date, payment_status) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [
          group_id, 
          full_name, 
          phone_number || null, 
          parent_phone || null, 
          join_date,
          payment_status || 'unpaid'
        ]
      );

      res.status(201).json({
        success: true,
        message: 'Student created successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Create student error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

// @route   PUT /api/students/:id
// @desc    Update student
// @access  Private
router.put('/:id',
  [
    body('full_name').trim().notEmpty().withMessage('Full name is required'),
    body('join_date').isISO8601().withMessage('Valid join date is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          success: false, 
          errors: errors.array() 
        });
      }

      const { id } = req.params;
      const { 
        group_id,
        full_name, 
        phone_number, 
        parent_phone, 
        join_date,
        payment_status 
      } = req.body;

      const result = await query(
        `UPDATE students 
         SET group_id = $1, full_name = $2, phone_number = $3, 
             parent_phone = $4, join_date = $5, payment_status = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7 
         RETURNING *`,
        [
          group_id,
          full_name, 
          phone_number || null, 
          parent_phone || null, 
          join_date,
          payment_status || 'unpaid',
          id
        ]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Student not found' 
        });
      }

      res.json({
        success: true,
        message: 'Student updated successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Update student error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

// @route   DELETE /api/students/:id
// @desc    Delete student
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM students WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Student not found' 
      });
    }

    res.json({
      success: true,
      message: 'Student deleted successfully',
    });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;