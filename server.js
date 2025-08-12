// server/server.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(express.json());
app.use(cors());

// Database connection
const MONGO_URI = process.env.MONGO_URI;

mongoose
  .connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ Successfully connected to MongoDB.");

    // Routes
    const authRoutes = require("./routes/authRoutes");
    const issueRoutes = require("./routes/issueRoutes");

    app.use("/api/auth", authRoutes);
    app.use("/api/issues", issueRoutes);

    // Root route - useful for testing
    app.get("/", (req, res) => {
      res.json({ message: "✅ API is running." });
    });

    // Catch-all for undefined routes
    app.use((req, res) => {
      res.status(404).json({ error: "❌ Endpoint not found" });
    });

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error connecting to MongoDB:", err.stack);
    process.exit(1);
  });
