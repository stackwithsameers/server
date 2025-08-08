// server/models/Issue.js
const mongoose = require('mongoose');

const IssueSchema = new mongoose.Schema({
  title: { type: String, required: true, maxlength: 100 },
  description: { type: String },
  location: { type: String, required: true, maxlength: 100 },
  department: { type: String, required: true, maxlength: 100 },
  status: { type: String, enum: ['OPEN', 'IN_PROGRESS', 'CLOSED'], default: 'OPEN' },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username: { type: String, required: true },
  user_email: { type: String, required: true },
  user_phone_number: { type: String },
  createdAt: { type: Date, default: Date.now },
});

const Issue = mongoose.model('Issue', IssueSchema);
module.exports = Issue;
