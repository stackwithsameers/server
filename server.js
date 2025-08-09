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

    // ✅ Root route to test server
    app.get("/", (req, res) => {
      res.send("🚀 Server is live!");
    });

    // API Routes
    const authRoutes = require("./routes/authRoutes");
    const issueRoutes = require("./routes/issueRoutes");

    app.use("/api/auth", authRoutes);
    app.use("/api/issues", issueRoutes);

    // Start the server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Error connecting to the database:", err.message);
    process.exit(1);
  });
