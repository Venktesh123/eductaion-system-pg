const Joi = require("joi");

// User validation schema
const userSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Name is required",
    "any.required": "Name is required",
  }),

  email: Joi.string().email().required().messages({
    "string.email": "Invalid email format",
    "string.empty": "Email is required",
    "any.required": "Email is required",
  }),

  password: Joi.string().min(6).required().messages({
    "string.min": "Password must be at least 6 characters long",
    "string.empty": "Password is required",
    "any.required": "Password is required",
  }),

  role: Joi.string().valid("admin", "teacher", "student").required().messages({
    "any.only": "Role must be either admin, teacher or student",
    "string.empty": "Role is required",
    "any.required": "Role is required",
  }),

  teacherEmail: Joi.string()
    .email()
    .when("role", {
      is: "student",
      then: Joi.required().messages({
        "string.email": "Invalid teacher email format",
        "string.empty": "Teacher email is required for students",
        "any.required": "Teacher email is required for students",
      }),
      otherwise: Joi.optional().allow("", null),
    }),
});

// Course validation schema
const courseSchema = Joi.object({
  title: Joi.string().required().messages({
    "string.empty": "Course title is required",
    "any.required": "Course title is required",
  }),

  aboutCourse: Joi.string().required().messages({
    "string.empty": "Course description is required",
    "any.required": "Course description is required",
  }),

  semesterId: Joi.string().guid({ version: "uuidv4" }).required().messages({
    "string.empty": "Semester ID is required",
    "string.guid": "Invalid semester ID format",
    "any.required": "Semester ID is required",
  }),
});

// Semester validation schema
const semesterSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Semester name is required",
    "any.required": "Semester name is required",
  }),

  startDate: Joi.date().required().messages({
    "date.base": "Start date must be a valid date",
    "any.required": "Start date is required",
  }),

  endDate: Joi.date().greater(Joi.ref("startDate")).required().messages({
    "date.base": "End date must be a valid date",
    "date.greater": "End date must be after start date",
    "any.required": "End date is required",
  }),
});

// Assignment validation schema
const assignmentSchema = Joi.object({
  title: Joi.string().required().messages({
    "string.empty": "Assignment title is required",
    "any.required": "Assignment title is required",
  }),

  description: Joi.string().required().messages({
    "string.empty": "Assignment description is required",
    "any.required": "Assignment description is required",
  }),

  dueDate: Joi.date().required().messages({
    "date.base": "Due date must be a valid date",
    "any.required": "Due date is required",
  }),

  totalPoints: Joi.number().integer().min(1).required().messages({
    "number.base": "Total points must be a number",
    "number.integer": "Total points must be an integer",
    "number.min": "Total points must be at least 1",
    "any.required": "Total points are required",
  }),

  isActive: Joi.boolean().default(true),
});

// Lecture validation schema
const lectureSchema = Joi.object({
  title: Joi.string().required().messages({
    "string.empty": "Lecture title is required",
    "any.required": "Lecture title is required",
  }),

  content: Joi.string().allow("", null),

  videoUrl: Joi.string().uri().allow("", null).messages({
    "string.uri": "Video URL must be a valid URL",
  }),

  isReviewed: Joi.boolean().default(false),

  reviewDeadline: Joi.date().allow(null),
});

// Event validation schema
const eventSchema = Joi.object({
  name: Joi.string().required().messages({
    "string.empty": "Event name is required",
    "any.required": "Event name is required",
  }),

  description: Joi.string().allow("", null),

  date: Joi.date().required().messages({
    "date.base": "Event date must be a valid date",
    "any.required": "Event date is required",
  }),

  time: Joi.string().required().messages({
    "string.empty": "Event time is required",
    "any.required": "Event time is required",
  }),

  image: Joi.string().required().messages({
    "string.empty": "Event image is required",
    "any.required": "Event image is required",
  }),

  location: Joi.string().required().messages({
    "string.empty": "Event location is required",
    "any.required": "Event location is required",
  }),

  link: Joi.string().uri().required().messages({
    "string.uri": "Link must be a valid URL",
    "string.empty": "Link is required",
    "any.required": "Link is required",
  }),
});

// Module for validating user data
const validateUserData = async (data) => {
  try {
    const validatedData = await userSchema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    return validatedData;
  } catch (error) {
    console.error("Validation error for row:", data);
    console.error("Error details:", error.details);
    return null;
  }
};

// Validate course data
const validateCourseData = async (data) => {
  try {
    const validatedData = await courseSchema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    return validatedData;
  } catch (error) {
    console.error("Course validation error:", error.details);
    return null;
  }
};

// Validate semester data
const validateSemesterData = async (data) => {
  try {
    const validatedData = await semesterSchema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    return validatedData;
  } catch (error) {
    console.error("Semester validation error:", error.details);
    return null;
  }
};

// Validate assignment data
const validateAssignmentData = async (data) => {
  try {
    const validatedData = await assignmentSchema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    return validatedData;
  } catch (error) {
    console.error("Assignment validation error:", error.details);
    return null;
  }
};

// Validate lecture data
const validateLectureData = async (data) => {
  try {
    const validatedData = await lectureSchema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    return validatedData;
  } catch (error) {
    console.error("Lecture validation error:", error.details);
    return null;
  }
};

// Validate event data
const validateEventData = async (data) => {
  try {
    const validatedData = await eventSchema.validateAsync(data, {
      abortEarly: false,
      stripUnknown: true,
    });
    return validatedData;
  } catch (error) {
    console.error("Event validation error:", error.details);
    return null;
  }
};

module.exports = {
  validateUserData,
  validateCourseData,
  validateSemesterData,
  validateAssignmentData,
  validateLectureData,
  validateEventData,
};
