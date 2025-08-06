// server/routes/issueRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied.' });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is not valid.' });
  }
};

module.exports = (pool) => {
  const router = express.Router();

  // Get all issues (protected route)
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const { role, id } = req.user;
      let sql = 'SELECT * FROM issues ORDER BY createdAt DESC';
      let params = [];
      
      // Filter by user for customers
      if (role === 'customer') {
        sql = 'SELECT * FROM issues WHERE userId = ? ORDER BY createdAt DESC';
        params.push(id);
      }

      const [rows] = await pool.query(sql, params);
      res.json(rows);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get a single issue by ID
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM issues WHERE id = ?', [req.params.id]);
      if (rows.length === 0) return res.status(404).json({ message: 'Issue not found' });
      res.json(rows[0]);
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  // Create a new issue (protected route)
  router.post('/', authMiddleware, async (req, res) => {
    const { title, description, location, department, status } = req.body;
    const { id: userId, username, email: user_email, phone_number: user_phone_number, role } = req.user;

    // Only customers can create new issues
    if (role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can create issues.' });
    }

    try {
      const [result] = await pool.query(
        'INSERT INTO issues (title, description, location, department, status, userId, username, user_email, user_phone_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [title, description, location, department, status || 'OPEN', userId, username, user_email, user_phone_number]
      );
      const newIssue = { id: result.insertId, title, description, location, department, status: status || 'OPEN', userId, username, user_email, user_phone_number, createdAt: new Date() };
      res.status(201).json(newIssue);
    } catch (err) {
      res.status(400).json({ message: err.message });
    }
  });

  // Update an issue (protected route)
  router.put('/:id', authMiddleware, async (req, res) => {
    const { title, description, location, department, status } = req.body;
    const { role, id: userId } = req.user;

    try {
      const [issueRows] = await pool.query('SELECT * FROM issues WHERE id = ?', [req.params.id]);
      if (issueRows.length === 0) return res.status(404).json({ message: 'Issue not found' });
      const issue = issueRows[0];

      // Check permissions
      if (role === 'customer' && issue.userId !== userId) {
        return res.status(403).json({ message: 'You are not authorized to update this issue.' });
      }

      // Customers can only update specific fields, technicians can update anything
      const updateFields = {};
      if (role === 'customer') {
        updateFields.title = title || issue.title;
        updateFields.description = description || issue.description;
        updateFields.location = location || issue.location;
        updateFields.department = department || issue.department;
        // Prevent customers from changing status
        if (req.body.status) {
          return res.status(403).json({ message: 'Customers cannot change the status of an issue.' });
        }
      } else if (role === 'technician') {
        // Technicians can update any field
        updateFields.title = title !== undefined ? title : issue.title;
        updateFields.description = description !== undefined ? description : issue.description;
        updateFields.location = location !== undefined ? location : issue.location;
        updateFields.department = department !== undefined ? department : issue.department;
        updateFields.status = status !== undefined ? status : issue.status;
      }
      
      const [result] = await pool.query(
        'UPDATE issues SET title = ?, description = ?, location = ?, department = ?, status = ? WHERE id = ?',
        [updateFields.title, updateFields.description, updateFields.location, updateFields.department, updateFields.status, req.params.id]
      );

      if (result.affectedRows === 0) return res.status(404).json({ message: 'Issue not found' });
      const [rows] = await pool.query('SELECT * FROM issues WHERE id = ?', [req.params.id]);
      res.json(rows[0]);
    } catch (err) {
      console.error(err);
      res.status(400).json({ message: err.message });
    }
  });

  // Delete an issue (protected route)
  router.delete('/:id', authMiddleware, async (req, res) => {
    const { role, id: userId } = req.user;
    
    try {
      const [issueRows] = await pool.query('SELECT * FROM issues WHERE id = ?', [req.params.id]);
      if (issueRows.length === 0) return res.status(404).json({ message: 'Issue not found' });
      const issue = issueRows[0];

      // Check permissions
      if (role === 'customer' && issue.userId !== userId) {
        return res.status(403).json({ message: 'You are not authorized to delete this issue.' });
      }
      if (role === 'technician') {
        // Admins cannot delete issues
        return res.status(403).json({ message: 'Technicians cannot delete issues.' });
      }

      const [result] = await pool.query('DELETE FROM issues WHERE id = ?', [req.params.id]);
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Issue not found' });
      res.json({ message: 'Issue deleted' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  });

  return router;
};
