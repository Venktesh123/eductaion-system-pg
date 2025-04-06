const express = require("express");
const router = express.Router();
const adminController = require("../controllers/adminController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Test route to verify router is working
router.get("/test", (req, res) => {
  res.json({ message: "Get Students routes working" });
});

// Get students for current teacher
router.get(
  "/my-students",
  auth,
  checkRole(["teacher"]),
  adminController.getMyStudents
);

// Get students for a specific teacher by ID
router.get(
  "/teacher/:teacherId/students",
  auth,
  checkRole(["admin", "teacher"]),
  adminController.getStudentsByTeacherId
);

module.exports = router;
