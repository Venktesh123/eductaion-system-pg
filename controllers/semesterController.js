const { Semester, Course } = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Create a new semester
const createSemester = catchAsyncErrors(async (req, res, next) => {
  try {
    const { name, startDate, endDate } = req.body;

    // Validate required fields
    if (!name || !startDate || !endDate) {
      return next(new ErrorHandler("Please provide all required fields", 400));
    }

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new ErrorHandler("Invalid date format", 400));
    }

    if (start >= end) {
      return next(new ErrorHandler("End date must be after start date", 400));
    }

    // Create the semester
    const semester = await Semester.create({
      name,
      startDate,
      endDate,
    });

    res.status(201).json(semester);
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new ErrorHandler("A semester with this name already exists", 400)
      );
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all semesters
const getAllSemesters = catchAsyncErrors(async (req, res, next) => {
  try {
    // Find all semesters and order by most recent
    const semesters = await Semester.findAll({
      order: [["startDate", "DESC"]],
      include: [
        {
          model: Course,
          attributes: ["id", "title"],
        },
      ],
    });

    // Format response
    const formattedSemesters = semesters.map((semester) => ({
      id: semester.id,
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
      courseCount: semester.Courses ? semester.Courses.length : 0,
      courses: semester.Courses
        ? semester.Courses.map((course) => ({
            id: course.id,
            title: course.title,
          }))
        : [],
    }));

    res.json(formattedSemesters);
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get a semester by ID
const getSemesterById = catchAsyncErrors(async (req, res, next) => {
  try {
    const { id } = req.params;

    const semester = await Semester.findByPk(id, {
      include: [
        {
          model: Course,
          attributes: ["id", "title", "aboutCourse"],
        },
      ],
    });

    if (!semester) {
      return next(new ErrorHandler("Semester not found", 404));
    }

    // Format response
    const formattedSemester = {
      id: semester.id,
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
      courseCount: semester.Courses ? semester.Courses.length : 0,
      courses: semester.Courses
        ? semester.Courses.map((course) => ({
            id: course.id,
            title: course.title,
            aboutCourse: course.aboutCourse,
          }))
        : [],
    };

    res.json(formattedSemester);
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update a semester
const updateSemester = catchAsyncErrors(async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, startDate, endDate } = req.body;

    const semester = await Semester.findByPk(id);

    if (!semester) {
      return next(new ErrorHandler("Semester not found", 404));
    }

    // Validate dates if provided
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return next(new ErrorHandler("Invalid date format", 400));
      }

      if (start >= end) {
        return next(new ErrorHandler("End date must be after start date", 400));
      }
    } else if ((startDate && !endDate) || (!startDate && endDate)) {
      return next(
        new ErrorHandler(
          "Both start and end dates must be provided together",
          400
        )
      );
    }

    // Update semester
    const updateData = {};
    if (name) updateData.name = name;
    if (startDate) updateData.startDate = startDate;
    if (endDate) updateData.endDate = endDate;

    await semester.update(updateData);

    res.json({
      id: semester.id,
      name: semester.name,
      startDate: semester.startDate,
      endDate: semester.endDate,
    });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return next(
        new ErrorHandler("A semester with this name already exists", 400)
      );
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete a semester (admin only)
const deleteSemester = catchAsyncErrors(async (req, res, next) => {
  try {
    const { id } = req.params;

    // First check if semester has courses
    const semester = await Semester.findByPk(id, {
      include: [
        {
          model: Course,
          attributes: ["id"],
        },
      ],
    });

    if (!semester) {
      return next(new ErrorHandler("Semester not found", 404));
    }

    // Check if courses are associated
    if (semester.Courses && semester.Courses.length > 0) {
      return next(
        new ErrorHandler(
          `Cannot delete semester with associated courses. Please reassign or delete ${semester.Courses.length} courses first.`,
          400
        )
      );
    }

    // Delete the semester
    await semester.destroy();

    res.json({
      success: true,
      message: "Semester deleted successfully",
    });
  } catch (error) {
    return next(new ErrorHandler(error.message, 500));
  }
});

module.exports = {
  createSemester,
  getAllSemesters,
  getSemesterById,
  updateSemester,
  deleteSemester,
};
