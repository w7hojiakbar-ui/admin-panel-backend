const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

// @route   GET /api/groups
// @desc    Get all groups
// @access  Private
router.get('/', async (req, res) => {
  try {
    const result = await query(`
      SELECT g.*, 
             COUNT(DISTINCT s.id) as student_count,
             COUNT(DISTINCT CASE WHEN s.payment_status = 'paid' THEN s.id END) as paid_students
      FROM groups g
      LEFT JOIN students s ON g.id = s.group_id
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/groups/:id
// @desc    Get single group with students
// @access  Private
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get group details
    const groupResult = await query(
      'SELECT * FROM groups WHERE id = $1',
      [id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Group not found' 
      });
    }

    // Get students in this group
    const studentsResult = await query(
      'SELECT * FROM students WHERE group_id = $1 ORDER BY full_name',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...groupResult.rows[0],
        students: studentsResult.rows,
      },
    });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   POST /api/groups
// @desc    Create new group
// @access  Private
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Group name is required'),
    body('monthly_fee').isFloat({ min: 0 }).withMessage('Monthly fee must be a positive number'),
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

      const { name, teacher_name, monthly_fee } = req.body;

      const result = await query(
        'INSERT INTO groups (name, teacher_name, monthly_fee) VALUES ($1, $2, $3) RETURNING *',
        [name, teacher_name || null, monthly_fee]
      );

      res.status(201).json({
        success: true,
        message: 'Group created successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Create group error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

// @route   PUT /api/groups/:id
// @desc    Update group
// @access  Private
router.put('/:id',
  [
    body('name').trim().notEmpty().withMessage('Group name is required'),
    body('monthly_fee').isFloat({ min: 0 }).withMessage('Monthly fee must be a positive number'),
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
      const { name, teacher_name, monthly_fee } = req.body;

      const result = await query(
        `UPDATE groups 
         SET name = $1, teacher_name = $2, monthly_fee = $3, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $4 
         RETURNING *`,
        [name, teacher_name || null, monthly_fee, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Group not found' 
        });
      }

      res.json({
        success: true,
        message: 'Group updated successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Update group error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

// @route   DELETE /api/groups/:id
// @desc    Delete group
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM groups WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Group not found' 
      });
    }

    res.json({
      success: true,
      message: 'Group deleted successfully',
    });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;