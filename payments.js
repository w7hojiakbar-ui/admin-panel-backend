const express = require('express');
const { body, validationResult } = require('express-validator');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

// @route   GET /api/payments
// @desc    Get all payments (with optional filters)
// @access  Private
router.get('/', async (req, res) => {
  try {
    const { month, student_id, group_id } = req.query;

    let queryText = `
      SELECT p.*, 
             s.full_name as student_name,
             g.name as group_name
      FROM payments p
      LEFT JOIN students s ON p.student_id = s.id
      LEFT JOIN groups g ON p.group_id = g.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramCount = 1;
    
    if (month) {
      queryText += ` AND p.payment_month = $${paramCount}`;
      params.push(month);
      paramCount++;
    }
    
    if (student_id) {
      queryText += ` AND p.student_id = $${paramCount}`;
      params.push(student_id);
      paramCount++;
    }
    
    if (group_id) {
      queryText += ` AND p.group_id = $${paramCount}`;
      params.push(group_id);
      paramCount++;
    }
    
    queryText += ' ORDER BY p.payment_date DESC, p.created_at DESC';

    const result = await query(queryText, params);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   POST /api/payments
// @desc    Create new payment and update student status
// @access  Private
router.post('/',
  [
    body('student_id').isInt().withMessage('Valid student ID is required'),
    body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
    body('payment_month').matches(/^\d{4}-\d{2}$/).withMessage('Payment month must be in YYYY-MM format'),
    body('payment_date').isISO8601().withMessage('Valid payment date is required'),
    body('payment_method').isIn(['cash', 'card', 'transfer']).withMessage('Invalid payment method'),
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
        student_id, 
        amount, 
        payment_month, 
        payment_date,
        payment_method,
        notes 
      } = req.body;

      // Get student and group info
      const studentResult = await query(
        'SELECT group_id FROM students WHERE id = $1',
        [student_id]
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({ 
          success: false, 
          message: 'Student not found' 
        });
      }

      const group_id = studentResult.rows[0].group_id;

      // Insert payment
      const paymentResult = await query(
        `INSERT INTO payments 
         (student_id, group_id, amount, payment_month, payment_date, payment_method, notes) 
         VALUES ($1, $2, $3, $4, $5, $6, $7) 
         RETURNING *`,
        [student_id, group_id, amount, payment_month, payment_date, payment_method, notes || null]
      );

      // Update student payment status to 'paid'
      await query(
        'UPDATE students SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['paid', student_id]
      );

      res.status(201).json({
        success: true,
        message: 'Payment recorded successfully',
        data: paymentResult.rows[0],
      });
    } catch (error) {
      console.error('Create payment error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Server error' 
      });
    }
  }
);

// @route   DELETE /api/payments/:id
// @desc    Delete payment
// @access  Private
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'DELETE FROM payments WHERE id = $1 RETURNING student_id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Payment not found' 
      });
    }

    // Check if student has other payments for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const studentId = result.rows[0].student_id;
    
    const remainingPayments = await query(
      'SELECT COUNT(*) FROM payments WHERE student_id = $1 AND payment_month = $2',
      [studentId, currentMonth]
    );

    // Update student status if no payments remain
    if (parseInt(remainingPayments.rows[0].count) === 0) {
      await query(
        'UPDATE students SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        ['unpaid', studentId]
      );
    }

    res.json({
      success: true,
      message: 'Payment deleted successfully',
    });
  } catch (error) {
    console.error('Delete payment error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;