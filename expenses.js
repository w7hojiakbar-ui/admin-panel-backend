const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

// @route   GET /api/expenses
// @desc    Get all expenses (with optional month filter)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { month } = req.query;

    let queryText = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    
    if (month) {
      queryText += ' AND expense_month = $1';
      params.push(month);
    }
    
    queryText += ' ORDER BY expense_date DESC, created_at DESC';

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   POST /api/expenses
// @desc    Create new expense
// @access  Private
router.post('/',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('expense_date').isISO8601().withMessage('Valid expense date is required'),
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

      const { title, amount, category, expense_date, notes } = req.body;

      // Extract month from expense_date (YYYY-MM)
      const expense_month = expense_date.slice(0, 7);

      const result = await query(
        `INSERT INTO expenses 
         (title, amount, category, expense_date, expense_month, notes) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [title, amount, category || null, expense_date, expense_month, notes || null]
      );

      res.status(201).json({
        success: true,
        message: 'Expense created successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Create expense error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

// @route   PUT /api/expenses/:id
// @desc    Update expense
// @access  Private
router.put('/:id',
  [
    body('title').trim().notEmpty().withMessage('Title is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('expense_date').isISO8601().withMessage('Valid expense date is required'),
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
      const { title, amount, category, expense_date, notes } = req.body;

      // Extract month from expense_date
      const expense_month = expense_date.slice(0, 7);

      const result = await query(
        `UPDATE expenses 
         SET title = $1, amount = $2, category = $3, 
             expense_date = $4, expense_month = $5, notes = $6
         WHERE id = $7 
         RETURNING *`,
        [title, amount, category || null, expense_date, expense_month, notes || null, id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Expense not found' 
        });
      }

      res.json({
        success: true,
        message: 'Expense updated successfully',
        data: result.rows[0],
      });
    } catch (error) {
      console.error('Update expense error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

// @route   DELETE /api/expenses/:id
// @desc    Delete expense
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM expenses WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Expense not found' 
      });
    }

    res.json({
      success: true,
      message: 'Expense deleted successfully',
    });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;