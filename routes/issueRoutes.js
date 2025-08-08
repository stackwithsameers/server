// server/routes/issueRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const Issue = require('../models/Issue');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';
const router = express.Router();

// Middleware to protect routes
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

// Get all issues (protected route)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role, id } = req.user;
    let issues;

    if (role === 'customer') {
      // Customers only see their own issues
      issues = await Issue.find({ userId: id }).sort({ createdAt: -1 });
    } else {
      // Technicians see all issues
      issues = await Issue.find({}).sort({ createdAt: -1 });
    }
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single issue by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });
    res.json(issue);
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
    const newIssue = new Issue({
      title,
      description,
      location,
      department,
      status: status || 'OPEN',
      userId, // MongoDB ObjectId from JWT
      username,
      user_email,
      user_phone_number
    });
    const savedIssue = await newIssue.save();
    res.status(201).json(savedIssue);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update an issue (protected route)
router.put('/:id', authMiddleware, async (req, res) => {
  const { title, description, location, department, status } = req.body;
  const { role, id: userId } = req.user;

  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    // Check permissions: customer can only update their own issues
    if (role === 'customer' && String(issue.userId) !== String(userId)) {
      return res.status(403).json({ message: 'You are not authorized to update this issue.' });
    }
    
    // Customers can only update specific fields, technicians can update anything
    if (role === 'customer') {
      issue.title = title !== undefined ? title : issue.title;
      issue.description = description !== undefined ? description : issue.description;
      issue.location = location !== undefined ? location : issue.location;
      issue.department = department !== undefined ? department : issue.department;
      // Prevent customers from changing status
      if (req.body.status) {
        return res.status(403).json({ message: 'Customers cannot change the status of an issue.' });
      }
    } else if (role === 'technician') {
      // Technicians can update any field
      issue.title = title !== undefined ? title : issue.title;
      issue.description = description !== undefined ? description : issue.description;
      issue.location = location !== undefined ? location : issue.location;
      issue.department = department !== undefined ? department : issue.department;
      issue.status = status !== undefined ? status : issue.status;
    }

    const updatedIssue = await issue.save();
    res.json(updatedIssue);

  } catch (err) {
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

// Delete an issue (protected route)
router.delete('/:id', authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;
  
  try {
    const issue = await Issue.findById(req.params.id);
    if (!issue) return res.status(404).json({ message: 'Issue not found' });

    // Check permissions: customer can only delete their own issues
    if (role === 'customer' && String(issue.userId) !== String(userId)) {
      return res.status(403).json({ message: 'You are not authorized to delete this issue.' });
    }
    // Technicians cannot delete issues
    if (role === 'technician') {
      return res.status(403).json({ message: 'Technicians cannot delete issues.' });
    }

    await Issue.deleteOne({ _id: req.params.id }); // Use deleteOne with _id
    res.json({ message: 'Issue deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
