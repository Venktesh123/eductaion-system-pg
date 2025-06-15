const express = require("express");
const cors = require("cors");
const { connectDB, sequelize } = require("./config/database");
const bodyParser = require("body-parser");
require("dotenv").config();
const path = require("path");
const fileUpload = require("express-fileupload");
const { errorMiddleware } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(bodyParser.urlencoded({ limit: "50mb", extended: true }));

// Configure express-fileupload globally to handle file uploads
app.use(
  fileUpload({
    createParentPath: true,
    limits: {
      fileSize: 2000 * 1024 * 1024, // 2GB
    },
    abortOnLimit: true,
    useTempFiles: false,
    debug: process.env.NODE_ENV === "development",
  })
);

// Database Connection
connectDB();

// Routes
app.get("/", (req, res) => {
  res.send("<h1>Backend Working</h1>");
});

// API routes
app.use("/api/admin", require("./routes/admin"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/courses", require("./routes/courses"));
app.use("/api/lectures", require("./routes/lecture"));
app.use("/api/semesters", require("./routes/semester"));
app.use("/api/students", require("./routes/students"));
app.use("/api/teachers", require("./routes/teachers"));
app.use("/api/events", require("./routes/event"));
app.use("/api/assignment", require("./routes/assignment"));
app.use("/api/econtent", require("./routes/econtent"));
app.use("/api/students", require("./routes/getStudents"));

// Error handling middleware
app.use(errorMiddleware);

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Sync database and start server
const startServer = async () => {
  try {
    // Sync all models with database
    // Note: In production, you would typically use migrations instead
    if (process.env.NODE_ENV === "development") {
      console.log("Syncing database models...");
      await sequelize.sync({ alter: true });
      console.log("Database synced!");
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
