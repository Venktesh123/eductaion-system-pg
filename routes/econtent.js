const express = require("express");
const router = express.Router();
const econtentController = require("../controllers/econtentController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Create a new module for a course's EContent (teacher only)
router.post(
  "/course/:courseId/econtent",
  auth,
  checkRole(["teacher"]),
  econtentController.createEContent
);

// Get all EContent for a specific course
router.get(
  "/course/:courseId/econtent",
  auth,
  checkRole(["teacher", "student"]),
  econtentController.getEContentByCourse
);

// Get a specific module by ID
router.get(
  "/course/:courseId/econtent/module/:moduleId",
  auth,
  checkRole(["teacher", "student"]),
  econtentController.getModuleById
);

// Update a module (teacher only)
router.put(
  "/course/:courseId/econtent/module/:moduleId",
  auth,
  checkRole(["teacher"]),
  econtentController.updateModule
);

// Delete a module and all its files (teacher only)
router.delete(
  "/course/:courseId/econtent/module/:moduleId",
  auth,
  checkRole(["teacher"]),
  econtentController.deleteModule
);

// Delete a specific file from a module (teacher only)
router.delete(
  "/course/:courseId/econtent/module/:moduleId/file/:fileId",
  auth,
  checkRole(["teacher"]),
  econtentController.deleteFile
);

module.exports = router;
