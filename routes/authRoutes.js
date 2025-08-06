// server/routes/authRoutes.js
const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey';

module.exports = (pool) => {
  const router = express.Router();

  // Register a new user
  router.post('/register', async (req, res) => {
    const { username, email, password, role, phone_number } = req.body;
    try {
      const existingUser = await User.findByEmail(pool, email);
      if (existingUser) {
        return res.status(400).json({ message: 'User with this email already exists.' });
      }
      const newUser = await User.create(pool, { username, email, password, role, phone_number });
      res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Registration failed.' });
    }
  });

  // Login a user
  router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await User.findByEmail(pool, email);
      if (!user) {
        return res.status(400).json({ message: 'Invalid credentials.' });
      }
      const isMatch = await User.comparePassword(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Invalid credentials.' });
      }
      const token = jwt.sign({ id: user.id, role: user.role, username: user.username, email: user.email, phone_number: user.phone_number }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token, user: { id: user.id, username: user.username, email: user.email, phone_number: user.phone_number, role: user.role } });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Login failed.' });
    }
  });

  return router;
};
