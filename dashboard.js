const express = require('express');
const { query } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes are protected
router.use(authenticateToken);

// @route   GET /api/dashboard/stats
// @desc    Get dashboard statistics
// @access  Private
router.get('/stats', async (req, res) => {
  try {
    const { month } = req.query;
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    // Total income for the month
    const incomeResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_month = $1',
      [currentMonth]
    );

    // Total expenses for the month
    const expensesResult = await query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM expenses WHERE expense_month = $1',
      [currentMonth]
    );

    // Total groups
    const groupsResult = await query(
      'SELECT COUNT(*) as total FROM groups'
    );

    // Total students
    const studentsResult = await query(
      'SELECT COUNT(*) as total FROM students'
    );

    // Paid vs unpaid students
    const paymentStatusResult = await query(`
      SELECT 
        payment_status,
        COUNT(*) as count
      FROM students
      GROUP BY payment_status
    `);

    const totalIncome = parseFloat(incomeResult.rows[0].total);
    const totalExpenses = parseFloat(expensesResult.rows[0].total);
    const netProfit = totalIncome - totalExpenses;

    res.json({
      success: true,
      data: {
        month: currentMonth,
        totalIncome,
        totalExpenses,
        netProfit,
        totalGroups: parseInt(groupsResult.rows[0].total),
        totalStudents: parseInt(studentsResult.rows[0].total),
        paymentStatus: paymentStatusResult.rows,
      },
    });
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/dashboard/monthly-chart
// @desc    Get monthly income vs expenses data for chart
// @access  Private
router.get('/monthly-chart', async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();

    // Get monthly income
    const incomeResult = await query(`
      SELECT 
        payment_month as month,
        SUM(amount) as total
      FROM payments
      WHERE payment_month LIKE $1
      GROUP BY payment_month
      ORDER BY payment_month
    `, [`${currentYear}%`]);

    // Get monthly expenses
    const expensesResult = await query(`
      SELECT 
        expense_month as month,
        SUM(amount) as total
      FROM expenses
      WHERE expense_month LIKE $1
      GROUP BY expense_month
      ORDER BY expense_month
    `, [`${currentYear}%`]);

    // Create complete year data (all 12 months)
    const months = [];
    for (let i = 1; i <= 12; i++) {
      const month = `${currentYear}-${String(i).padStart(2, '0')}`;
      
      const incomeData = incomeResult.rows.find(r => r.month === month);
      const expenseData = expensesResult.rows.find(r => r.month === month);
      
      months.push({
        month,
        income: incomeData ? parseFloat(incomeData.total) : 0,
        expenses: expenseData ? parseFloat(expenseData.total) : 0,
        profit: (incomeData ? parseFloat(incomeData.total) : 0) - 
                (expenseData ? parseFloat(expenseData.total) : 0),
      });
    }

    res.json({
      success: true,
      data: months,
    });
  } catch (error) {
    console.error('Get monthly chart error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/dashboard/unpaid-students
// @desc    Get list of unpaid students
// @access  Private
router.get('/unpaid-students', async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, g.name as group_name, g.monthly_fee
      FROM students s
      LEFT JOIN groups g ON s.group_id = g.id
      WHERE s.payment_status = 'unpaid'
      ORDER BY s.join_date DESC
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get unpaid students error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

// @route   GET /api/dashboard/top-groups
// @desc    Get best performing groups (by student count and payment rate)
// @access  Private
router.get('/top-groups', async (req, res) => {
  try {
    const result = await query(`
      SELECT 
        g.id,
        g.name,
        g.teacher_name,
        g.monthly_fee,
        COUNT(DISTINCT s.id) as student_count,
        COUNT(DISTINCT CASE WHEN s.payment_status = 'paid' THEN s.id END) as paid_students,
        ROUND(
          CASE 
            WHEN COUNT(DISTINCT s.id) > 0 
            THEN (COUNT(DISTINCT CASE WHEN s.payment_status = 'paid' THEN s.id END)::float / COUNT(DISTINCT s.id)::float) * 100
            ELSE 0
          END, 2
        ) as payment_rate
      FROM groups g
      LEFT JOIN students s ON g.id = s.group_id
      GROUP BY g.id, g.name, g.teacher_name, g.monthly_fee
      ORDER BY student_count DESC, payment_rate DESC
      LIMIT 10
    `);

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get top groups error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error' 
    });
  }
});

module.exports = router;