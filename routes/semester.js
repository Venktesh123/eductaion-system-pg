const express = require("express");
const router = express.Router();
const semesterController = require("../controllers/semesterController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Create a new semester (admin only)
router.post("/", auth, checkRole(["admin"]), semesterController.createSemester);

// Get all semesters
router.get(
  "/",
  auth,
  checkRole(["admin", "teacher", "student"]),
  semesterController.getAllSemesters
);

// Get a specific semester by ID
router.get(
  "/:id",
  auth,
  checkRole(["admin", "teacher", "student"]),
  semesterController.getSemesterById
);

// Update a semester (admin only)
router.put(
  "/:id",
  auth,
  checkRole(["admin"]),
  semesterController.updateSemester
);

// Delete a semester (admin only)
router.delete(
  "/:id",
  auth,
  checkRole(["admin"]),
  semesterController.deleteSemester
);

module.exports = router;
