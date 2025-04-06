const { Event } = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Get all events
const getAllEvents = catchAsyncErrors(async (req, res, next) => {
  try {
    const events = await Event.findAll({
      order: [["date", "ASC"]],
    });

    res.status(200).json({
      success: true,
      count: events.length,
      data: events,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch events", 500));
  }
});

// Delete event
const deleteEvent = catchAsyncErrors(async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return next(new ErrorHandler("Event not found", 404));
    }

    await event.destroy();

    res.status(200).json({
      success: true,
      data: {},
      message: "Event deleted successfully",
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to delete event", 500));
  }
});

// Get event by ID
const getEventById = catchAsyncErrors(async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return next(new ErrorHandler("Event not found", 404));
    }

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    return next(new ErrorHandler("Failed to fetch event", 500));
  }
});

// Create event (admin only)
const createEvent = catchAsyncErrors(async (req, res, next) => {
  try {
    // Validate required fields
    const { name, date, time, image, location, link } = req.body;
    if (!name || !date || !time || !image || !location || !link) {
      return next(new ErrorHandler("Please provide all required fields", 400));
    }

    // Validate link format
    const urlPattern = /^https?:\/\/.+/;
    if (!urlPattern.test(link)) {
      return next(new ErrorHandler("Link must be a valid URL", 400));
    }

    const event = await Event.create(req.body);

    res.status(201).json({
      success: true,
      data: event,
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((err) => err.message);
      return next(new ErrorHandler(messages.join(", "), 400));
    }
    return next(new ErrorHandler("Failed to create event", 500));
  }
});

// Update event
const updateEvent = catchAsyncErrors(async (req, res, next) => {
  try {
    const event = await Event.findByPk(req.params.id);

    if (!event) {
      return next(new ErrorHandler("Event not found", 404));
    }

    // Check if link is being updated and validate if so
    if (req.body.link) {
      const urlPattern = /^https?:\/\/.+/;
      if (!urlPattern.test(req.body.link)) {
        return next(new ErrorHandler("Link must be a valid URL", 400));
      }
    }

    await event.update(req.body);

    res.status(200).json({
      success: true,
      data: event,
    });
  } catch (error) {
    if (error.name === "SequelizeValidationError") {
      const messages = error.errors.map((err) => err.message);
      return next(new ErrorHandler(messages.join(", "), 400));
    }
    return next(new ErrorHandler("Failed to update event", 500));
  }
});

module.exports = {
  getAllEvents,
  getEventById,
  createEvent,
  updateEvent,
  deleteEvent,
};
