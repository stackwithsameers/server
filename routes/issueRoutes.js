// server/routes/issueRoutes.js
const express = require("express");
const jwt = require("jsonwebtoken");
const Issue = require("../models/Issue"); // Mongoose Issue model
const User = require("../models/User"); // Mongoose User model (for user lookup if needed, though not directly used here)
const { stringify } = require("csv-stringify"); // Import csv-stringify for CSV export

const JWT_SECRET = process.env.JWT_SECRET || "supersecretkey";

// Middleware to protect routes and attach user info from token
const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "No token, authorization denied." });
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Attach user info (id, role, username, email, phone_number) to request
    next();
  } catch (err) {
    res.status(401).json({ message: "Token is not valid." });
  }
};

// Middleware to specifically check for admin role
const adminAuthMiddleware = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    res.status(403).json({ message: "Admin access required." });
  }
};

const router = express.Router(); // Initialize router here

// Get all issues (protected route)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { role, id } = req.user;
    let issues;

    // Customers only see their own issues
    if (role === "customer") {
      issues = await Issue.find({ userId: id }).sort({ createdAt: -1 });
    } else {
      // Technicians and Admins see all issues
      issues = await Issue.find({}).sort({ createdAt: -1 });
    }
    res.json(issues);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a single issue by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id); // Mongoose findById
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    res.json(issue);
  } catch (err) {
    // Handle invalid ObjectId format gracefully
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid Issue ID format." });
    }
    res.status(500).json({ message: err.message });
  }
});

// Create a new issue (protected route)
router.post("/", authMiddleware, async (req, res) => {
  const { title, description, location, department, status } = req.body;
  const {
    id: userId,
    username,
    email: user_email_from_token,
    phone_number: user_phone_number,
    role,
  } = req.user;

  // Ensure user_email is a string, even if it's null/undefined from the token
  const user_email = user_email_from_token || "";

  // Only customers can create new issues
  if (role !== "customer") {
    return res
      .status(403)
      .json({ message: "Only customers can create issues." });
  }

  try {
    const newIssue = new Issue({
      title,
      description,
      location,
      department,
      status: status || "OPEN",
      userId: userId, // Mongoose will convert this string ID to ObjectId
      username,
      user_email,
      user_phone_number,
    });
    const savedIssue = await newIssue.save(); // Mongoose save
    res.status(201).json(savedIssue);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// Update an issue (protected route)
router.put("/:id", authMiddleware, async (req, res) => {
  const { title, description, location, department, status } = req.body;
  const { role, id: userId } = req.user;

  try {
    const issue = await Issue.findById(req.params.id); // Mongoose findById
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    // Check permissions:
    // Customers can only update their own issues and cannot change status
    // Technicians and Admins can update any issue and any field
    if (role === "customer" && String(issue.userId) !== String(userId)) {
      // Compare ObjectId as string
      return res
        .status(403)
        .json({ message: "You are not authorized to update this issue." });
    }

    if (role === "customer") {
      issue.title = title !== undefined ? title : issue.title;
      issue.description =
        description !== undefined ? description : issue.description;
      issue.location = location !== undefined ? location : issue.location;
      issue.department =
        department !== undefined ? department : issue.department;
      if (req.body.status) {
        // Prevent customers from changing status
        return res
          .status(403)
          .json({ message: "Customers cannot change the status of an issue." });
      }
      // status remains unchanged for customers
    } else if (role === "technician" || role === "admin") {
      issue.title = title !== undefined ? title : issue.title;
      issue.description =
        description !== undefined ? description : issue.description;
      issue.location = location !== undefined ? location : issue.location;
      issue.department =
        department !== undefined ? department : issue.department;
      issue.status = status !== undefined ? status : issue.status;
    }

    const updatedIssue = await issue.save(); // Mongoose save
    res.json(updatedIssue);
  } catch (err) {
    // Handle invalid ObjectId format gracefully
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid Issue ID format." });
    }
    console.error(err);
    res.status(400).json({ message: err.message });
  }
});

// Delete an issue (protected route)
router.delete("/:id", authMiddleware, async (req, res) => {
  const { role, id: userId } = req.user;

  try {
    const issue = await Issue.findById(req.params.id); // Mongoose findById
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    // Check permissions:
    // Customers can only delete their own issues
    // Technicians cannot delete issues
    // Admins can delete any issue
    if (role === "customer" && String(issue.userId) !== String(userId)) {
      // Compare ObjectId as string
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this issue." });
    }
    if (role === "technician") {
      return res
        .status(403)
        .json({ message: "Technicians cannot delete issues." });
    }
    // If not admin, and not the owner, deny access (this covers customer role already handled above)
    if (role !== "admin" && String(issue.userId) !== String(userId)) {
      return res
        .status(403)
        .json({ message: "You are not authorized to delete this issue." });
    }

    await Issue.deleteOne({ _id: req.params.id }); // Mongoose deleteOne
    res.json({ message: "Issue deleted" });
  } catch (err) {
    // Handle invalid ObjectId format gracefully
    if (err.name === "CastError" && err.kind === "ObjectId") {
      return res.status(400).json({ message: "Invalid Issue ID format." });
    }
    res.status(500).json({ message: err.message });
  }
});

// --- New Admin Route for CSV Export ---
router.get(
  "/admin/export/issues",
  authMiddleware,
  adminAuthMiddleware,
  async (req, res) => {
    try {
      const issues = await Issue.find({}); // Mongoose find all issues
      // You could also export users: const users = await User.find({});

      // Prepare data for CSV stringify
      const issueData = issues.map((issue) => ({
        id: issue._id.toString(), // Convert ObjectId to string for CSV
        title: issue.title,
        description: issue.description,
        location: issue.location,
        department: issue.department,
        status: issue.status,
        userId: issue.userId.toString(), // Convert ObjectId to string for CSV
        username: issue.username,
        user_email: issue.user_email,
        user_phone_number: issue.user_phone_number,
        createdAt: issue.createdAt ? issue.createdAt.toISOString() : "", // Format date for CSV
      }));

      // Generate CSV for issues
      stringify(issueData, { header: true }, (err, csvString) => {
        if (err) {
          console.error("Error generating CSV:", err);
          return res.status(500).json({ message: "Failed to generate CSV." });
        }

        res.setHeader("Content-Type", "text/csv");
        res.setHeader(
          "Content-Disposition",
          'attachment; filename="issues_export.csv"'
        );
        res.status(200).send(csvString);
      });
    } catch (err) {
      console.error("Error exporting data:", err);
      res.status(500).json({ message: "Failed to export data." });
    }
  }
);

module.exports = router;
