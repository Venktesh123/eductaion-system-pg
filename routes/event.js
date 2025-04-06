const express = require("express");
const router = express.Router();
const eventController = require("../controllers/eventController");
const auth = require("../middleware/auth");
const { checkRole } = require("../middleware/roleCheck");

// Create a new event (admin only)
router.post("/", auth, checkRole(["admin"]), eventController.createEvent);

// Get all events
router.get(
  "/",
  auth,
  checkRole(["admin", "teacher", "student"]),
  eventController.getAllEvents
);

// Get a specific event by ID
router.get(
  "/:id",
  auth,
  checkRole(["admin", "teacher", "student"]),
  eventController.getEventById
);

// Update an event (admin only)
router.put("/:id", auth, checkRole(["admin"]), eventController.updateEvent);

// Delete an event (admin only)
router.delete("/:id", auth, checkRole(["admin"]), eventController.deleteEvent);

module.exports = router;
