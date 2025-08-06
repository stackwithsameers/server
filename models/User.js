// server/models/User.js
const bcrypt = require('bcryptjs');

const saltRounds = 10;

exports.findByEmail = async (pool, email) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0];
};

exports.create = async (pool, userData) => {
  const { username, email, password, phone_number, role } = userData;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  const [result] = await pool.query(
    'INSERT INTO users (username, email, password, phone_number, role) VALUES (?, ?, ?, ?, ?)',
    [username, email, hashedPassword, phone_number, role]
  );
  return { id: result.insertId, username, email, phone_number, role };
};

exports.comparePassword = async (password, hashedPassword) => {
  return bcrypt.compare(password, hashedPassword);
};

exports.findById = async (pool, id) => {
  const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
  return rows[0];
};
