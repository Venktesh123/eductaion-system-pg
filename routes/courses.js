const express = require("express");
const router = express.Router();
const courseController = require("../controllers/courseController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Get all courses for the logged-in user (teacher or student)
router.get(
  "/",
  auth,
  checkRole(["teacher", "student"]),
  courseController.getUserCourses
);

// Get all courses the student is enrolled in
router.get(
  "/student",
  auth,
  checkRole(["student"]),
  courseController.getEnrolledCourses
);

// Get specific course by ID
router.get(
  "/:courseId",
  auth,
  checkRole(["teacher", "student"]),
  courseController.getCourseById
);

// Create new course (teacher only)
router.post("/", auth, checkRole(["teacher"]), courseController.createCourse);

// Update course (teacher only)
router.put(
  "/:courseId",
  auth,
  checkRole(["teacher"]),
  courseController.updateCourse
);

// Delete course (teacher only)
router.delete(
  "/:courseId",
  auth,
  checkRole(["teacher"]),
  courseController.deleteCourse
);

module.exports = router;
