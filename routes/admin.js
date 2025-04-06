const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");
const uploadMiddleware = require("../middleware/upload");

// Test route to verify router is working
router.get("/test", (req, res) => {
  res.json({ message: "Admin routes working" });
});

// Upload users from Excel file
router.post(
  "/upload-users",
  auth,
  checkRole(["admin"]),
  uploadMiddleware,
  adminController.uploadUsers
);

// Get my students (for teacher)
router.get(
  "/my-students",
  auth,
  checkRole(["teacher"]),
  adminController.getMyStudents
);

// Admin route to get students for any teacher by ID
router.get(
  "/teacher/:teacherId/students",
  auth,
  checkRole(["admin", "teacher"]),
  adminController.getStudentsByTeacherId
);

module.exports = router;
