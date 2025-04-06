const express = require("express");
const router = express.Router();
const lectureController = require("../controllers/lectureController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Create a new lecture for a course (teacher only)
router.post(
  "/:courseId",
  auth,
  checkRole(["teacher"]),
  lectureController.createLecture
);

// Update a lecture (teacher only)
router.put(
  "/:lectureId",
  auth,
  checkRole(["teacher"]),
  lectureController.updateLecture
);

// Get a specific lecture by ID
router.get(
  "/:lectureId",
  auth,
  checkRole(["teacher", "student"]),
  lectureController.getLectureById
);

// Get all lectures for a course (teacher view)
router.get(
  "/:courseId/lectures",
  auth,
  checkRole(["teacher"]),
  lectureController.getCourseLectures
);

// Get all lectures for a course (student view - only reviewed lectures)
router.get(
  "/student/:courseId/lectures",
  auth,
  checkRole(["student"]),
  lectureController.getCourseLecturesByStudents
);

// Get a specific lecture in a course
router.get(
  "/:courseId/lectures/:lectureId",
  auth,
  checkRole(["teacher", "student"]),
  lectureController.getLectureById
);

// Create a lecture for a course (nested route)
router.post(
  "/:courseId/lectures",
  auth,
  checkRole(["teacher"]),
  lectureController.createLecture
);

// Update a lecture in a course (nested route)
router.put(
  "/:courseId/lectures/:lectureId",
  auth,
  checkRole(["teacher"]),
  lectureController.updateLecture
);

// Delete a lecture from a course
router.delete(
  "/:courseId/lectures/:lectureId",
  auth,
  checkRole(["teacher"]),
  lectureController.deleteLecture
);

// Update review status for a specific lecture
router.put(
  "/:courseId/lectures/:lectureId/review",
  auth,
  checkRole(["teacher"]),
  lectureController.updateLectureReviewStatus
);

// Update review status for all lectures in a course
router.put(
  "/:courseId/lectures/review-all",
  auth,
  checkRole(["teacher"]),
  lectureController.updateAllLectureReviewStatuses
);

module.exports = router;
