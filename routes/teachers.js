const express = require("express");
const router = express.Router();
const teacherController = require("../controllers/teacherController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Get students for the authenticated teacher
router.get(
  "/students",
  auth,
  checkRole(["teacher"]),
  teacherController.getStudents
);

// Assign a student to a teacher (admin function)
router.post(
  "/students/:studentId/assign",
  auth,
  checkRole(["admin", "teacher"]),
  teacherController.assignStudent
);

// Get teacher profile
router.get(
  "/profile",
  auth,
  checkRole(["teacher"]),
  teacherController.getProfile
);

// Update teacher profile
router.put(
  "/profile",
  auth,
  checkRole(["teacher"]),
  teacherController.updateProfile
);

module.exports = router;
