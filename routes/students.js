const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Enroll in a course
router.post(
  "/courses/:courseId/enroll",
  auth,
  checkRole(["student"]),
  studentController.enrollCourse
);

// Get enrollment details for a course
router.get(
  "/courses/:courseId/enrollment",
  auth,
  checkRole(["student"]),
  studentController.getEnrollmentDetails
);

// Unenroll from a course
router.delete(
  "/courses/:courseId/enroll",
  auth,
  checkRole(["student"]),
  studentController.unenrollCourse
);

// Update student profile
router.put(
  "/profile",
  auth,
  checkRole(["student"]),
  studentController.updateProfile
);

module.exports = router;
