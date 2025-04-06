const {
  Course,
  Teacher,
  Student,
  Semester,
  Lecture,
  User,
  StudentCourse,
  sequelize,
} = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Logger for better debugging
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
};

// Get courses for the logged-in teacher or student
const getUserCourses = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(`Fetching courses for user with ID: ${req.user.id}`);
    const userRole = req.user.role;

    if (userRole === "teacher") {
      // Get teacher's courses
      const teacher = await Teacher.findOne({
        where: { userId: req.user.id },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (!teacher) {
        logger.error(`Teacher not found for user ID: ${req.user.id}`);
        return next(new ErrorHandler("Teacher not found", 404));
      }

      const courses = await Course.findAll({
        where: { teacherId: teacher.id },
        attributes: ["id", "title", "aboutCourse"],
        include: [
          {
            model: Semester,
            attributes: ["id", "name", "startDate", "endDate"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      // Count students for this teacher
      const studentCount = await Student.count({
        where: { teacherId: teacher.id },
      });

      logger.info(`Found ${courses.length} courses for teacher: ${teacher.id}`);

      res.json({
        user: {
          id: teacher.id,
          name: teacher.User.name,
          email: teacher.email,
          role: "teacher",
          totalStudents: studentCount,
          totalCourses: courses.length || 0,
        },
        courses: courses.map((course) => ({
          id: course.id,
          title: course.title,
          aboutCourse: course.aboutCourse,
          semester: course.Semester
            ? {
                id: course.Semester.id,
                name: course.Semester.name,
                startDate: course.Semester.startDate,
                endDate: course.Semester.endDate,
              }
            : null,
        })),
      });
    } else if (userRole === "student") {
      // Get student's enrolled courses
      const student = await Student.findOne({
        where: { userId: req.user.id },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (!student) {
        logger.error(`Student not found for user ID: ${req.user.id}`);
        return next(new ErrorHandler("Student not found", 404));
      }

      // Get the courses this student is enrolled in
      const enrollments = await StudentCourse.findAll({
        where: { studentId: student.id },
        attributes: ["courseId"],
      });

      const courseIds = enrollments.map((enrollment) => enrollment.courseId);

      // Get course details
      const courses = await Course.findAll({
        where: { id: courseIds },
        attributes: ["id", "title", "aboutCourse"],
        include: [
          {
            model: Semester,
            attributes: ["id", "name", "startDate", "endDate"],
          },
        ],
        order: [["createdAt", "DESC"]],
      });

      logger.info(`Found ${courses.length} courses for student: ${student.id}`);

      res.json({
        user: {
          id: student.id,
          name: student.User.name,
          email: student.User.email,
          role: "student",
          totalCourses: courses.length || 0,
        },
        courses: courses.map((course) => ({
          id: course.id,
          title: course.title,
          aboutCourse: course.aboutCourse,
          semester: course.Semester
            ? {
                id: course.Semester.id,
                name: course.Semester.name,
                startDate: course.Semester.startDate,
                endDate: course.Semester.endDate,
              }
            : null,
        })),
      });
    } else {
      return next(new ErrorHandler("Invalid user role", 403));
    }
  } catch (error) {
    logger.error("Error in getUserCourses:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all courses the student is enrolled in
const getEnrolledCourses = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(
      `Fetching enrolled courses for student with ID: ${req.user.id}`
    );

    // Verify user is a student
    if (req.user.role !== "student") {
      logger.error(`User ${req.user.id} is not a student`);
      return next(
        new ErrorHandler("Access denied. Student role required", 403)
      );
    }

    // Find the student
    const student = await Student.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!student) {
      logger.error(`Student not found for user ID: ${req.user.id}`);
      return next(new ErrorHandler("Student not found", 404));
    }

    // Get the courses this student is enrolled in
    const enrollments = await StudentCourse.findAll({
      where: { studentId: student.id },
      attributes: ["courseId", "enrollmentDate"],
    });

    if (enrollments.length === 0) {
      logger.info(`Student ${student.id} is not enrolled in any courses`);
      return res.json({
        user: {
          id: student.id,
          name: student.User.name,
          email: student.User.email,
          role: "student",
          totalCourses: 0,
        },
        courses: [],
      });
    }

    const courseIds = enrollments.map((enrollment) => enrollment.courseId);

    // Get course details
    const courses = await Course.findAll({
      where: { id: courseIds },
      attributes: ["id", "title", "aboutCourse"],
      include: [
        {
          model: Semester,
          attributes: ["id", "name", "startDate", "endDate"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    logger.info(
      `Found ${courses.length} enrolled courses for student: ${student.id}`
    );

    // Create a map of courseId to enrollment date
    const enrollmentDates = {};
    enrollments.forEach((enrollment) => {
      enrollmentDates[enrollment.courseId] = enrollment.enrollmentDate;
    });

    res.json({
      user: {
        id: student.id,
        name: student.User.name,
        email: student.User.email,
        role: "student",
        totalCourses: courses.length || 0,
      },
      courses: courses.map((course) => ({
        id: course.id,
        title: course.title,
        aboutCourse: course.aboutCourse,
        enrollmentDate: enrollmentDates[course.id],
        semester: course.Semester
          ? {
              id: course.Semester.id,
              name: course.Semester.name,
              startDate: course.Semester.startDate,
              endDate: course.Semester.endDate,
            }
          : null,
      })),
    });
  } catch (error) {
    logger.error("Error in getEnrolledCourses:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get specific course by ID
const getCourseById = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(
      `Fetching course ID: ${req.params.courseId} for user: ${req.user.id}`
    );

    // Find the course with semester details
    const course = await Course.findByPk(req.params.courseId, {
      include: [
        {
          model: Semester,
          attributes: ["id", "name", "startDate", "endDate"],
        },
      ],
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    // Check if user has access to this course
    let hasAccess = false;
    let userDetails = null;
    let students = [];

    if (req.user.role === "teacher") {
      // For teacher: check if they're the course teacher
      const teacher = await Teacher.findOne({
        where: {
          userId: req.user.id,
          id: course.teacherId,
        },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (teacher) {
        hasAccess = true;
        userDetails = {
          id: teacher.id,
          name: teacher.User.name,
          email: teacher.email,
        };

        // Get students for this course
        const enrollments = await StudentCourse.findAll({
          where: { courseId: course.id },
          include: [
            {
              model: Student,
              include: [{ model: User, attributes: ["name", "email"] }],
            },
          ],
        });

        students = enrollments.map((enrollment, index) => ({
          id: enrollment.Student.id,
          rollNo: `CS${String(index + 101).padStart(3, "0")}`,
          name: enrollment.Student.User
            ? enrollment.Student.User.name
            : "Unknown",
          program: enrollment.Student.program || "Computer Science",
          email: enrollment.Student.User ? enrollment.Student.User.email : "",
          enrollmentDate: enrollment.enrollmentDate,
        }));
      }
    } else if (req.user.role === "student") {
      // For student: check if they're enrolled in the course
      const student = await Student.findOne({
        where: { userId: req.user.id },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (student) {
        // Check if student is enrolled in this course
        const enrollment = await StudentCourse.findOne({
          where: {
            studentId: student.id,
            courseId: course.id,
          },
        });

        if (enrollment) {
          hasAccess = true;
          userDetails = {
            id: student.id,
            name: student.User.name,
            email: student.User.email,
          };
        }
      }
    }

    if (!hasAccess) {
      logger.error(
        `User ${req.user.id} does not have access to course ${req.params.courseId}`
      );
      return next(
        new ErrorHandler("You don't have access to this course", 403)
      );
    }

    // Check if lectures are included
    const lectures = await Lecture.findAll({
      where: { courseId: course.id },
      order: [["createdAt", "ASC"]],
    });

    logger.info(`Found course: ${course.title}`);

    // Structure the response
    const response = {
      id: course.id,
      title: course.title,
      aboutCourse: course.aboutCourse,
      semester: course.Semester
        ? {
            id: course.Semester.id,
            name: course.Semester.name,
            startDate: course.Semester.startDate,
            endDate: course.Semester.endDate,
          }
        : null,
      lectures: lectures.map((lecture) => ({
        id: lecture.id,
        title: lecture.title,
        content: lecture.content,
        videoUrl: lecture.videoUrl,
        isReviewed: lecture.isReviewed,
        reviewDeadline: lecture.reviewDeadline,
        createdAt: lecture.createdAt,
      })),
    };

    // Add user-specific data
    if (req.user.role === "teacher") {
      // Get teacher information and include student count
      const teacherData = await Teacher.findByPk(course.teacherId, {
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      response.teacher = {
        id: teacherData.id,
        name: teacherData.User.name,
        email: teacherData.email,
        totalStudents: students.length,
      };

      // Include students for teachers
      response.students = students;
    } else if (req.user.role === "student") {
      response.student = {
        id: userDetails.id,
        name: userDetails.name,
        email: userDetails.email,
      };

      // Include teacher info for students
      const teacherData = await Teacher.findByPk(course.teacherId, {
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (teacherData) {
        response.teacher = {
          id: teacherData.id,
          name: teacherData.User.name,
          email: teacherData.email,
        };
      }
    }

    res.json(response);
  } catch (error) {
    logger.error("Error in getCourseById:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Create new course
const createCourse = catchAsyncErrors(async (req, res, next) => {
  logger.info("Starting createCourse controller function");
  const transaction = await sequelize.transaction();

  try {
    logger.info("Transaction started");

    // Find teacher using the logged-in user ID
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      logger.error(`Teacher not found for user ID: ${req.user.id}`);
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Create main course
    const courseData = {
      title: req.body.title,
      aboutCourse: req.body.aboutCourse,
      semesterId: req.body.semesterId,
      teacherId: teacher.id,
    };

    const course = await Course.create(courseData, { transaction });
    logger.info(`Main course created with ID: ${course.id}`);

    // Create initial lectures if provided
    if (
      req.body.lectures &&
      Array.isArray(req.body.lectures) &&
      req.body.lectures.length > 0
    ) {
      const lecturePromises = req.body.lectures.map((lectureData) => {
        return Lecture.create(
          {
            title: lectureData.title,
            content: lectureData.content || null,
            videoUrl: lectureData.videoUrl || null,
            courseId: course.id,
            isReviewed: lectureData.isReviewed || false,
            reviewDeadline: lectureData.reviewDeadline || null,
          },
          { transaction }
        );
      });

      await Promise.all(lecturePromises);
      logger.info(
        `Created ${req.body.lectures.length} lectures for the course`
      );
    }

    // Find all students under this teacher and enroll them in the course
    logger.info(`Finding students for teacher: ${teacher.id}`);
    const students = await Student.findAll({
      where: { teacherId: teacher.id },
      transaction,
    });

    // Add course ID to all students' enrollments
    if (students && students.length > 0) {
      logger.info(`Enrolling ${students.length} students in the course`);

      const enrollmentPromises = students.map((student) => {
        return StudentCourse.create(
          {
            studentId: student.id,
            courseId: course.id,
            enrollmentDate: new Date(),
          },
          { transaction }
        );
      });

      await Promise.all(enrollmentPromises);
      logger.info("All students enrolled successfully");
    }

    logger.info("Committing transaction");
    await transaction.commit();
    logger.info("Transaction committed successfully");

    // Get the fully populated course
    const createdCourse = await Course.findByPk(course.id, {
      include: [{ model: Semester }, { model: Lecture }],
    });

    logger.info("Sending response with course data");
    res.status(201).json({
      id: createdCourse.id,
      title: createdCourse.title,
      aboutCourse: createdCourse.aboutCourse,
      semester: createdCourse.Semester
        ? {
            id: createdCourse.Semester.id,
            name: createdCourse.Semester.name,
            startDate: createdCourse.Semester.startDate,
            endDate: createdCourse.Semester.endDate,
          }
        : null,
      lectures: createdCourse.Lectures,
    });
  } catch (error) {
    logger.error("Error in createCourse:", error);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 400));
  }
});

// Update course
const updateCourse = catchAsyncErrors(async (req, res, next) => {
  logger.info(`Updating course ID: ${req.params.courseId}`);
  const transaction = await sequelize.transaction();

  try {
    // Find teacher and check authorization
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      logger.error(`Teacher not found for user ID: ${req.user.id}`);
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find the course and verify ownership
    const course = await Course.findOne({
      where: {
        id: req.params.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Update main course fields
    const updateData = {};
    if (req.body.title) updateData.title = req.body.title;
    if (req.body.aboutCourse) updateData.aboutCourse = req.body.aboutCourse;
    if (req.body.semesterId) updateData.semesterId = req.body.semesterId;

    await course.update(updateData, { transaction });
    logger.info("Updated main course fields");

    await transaction.commit();
    logger.info("Transaction committed successfully");

    // Get updated course with all populated fields
    const updatedCourse = await Course.findByPk(course.id, {
      include: [{ model: Semester }, { model: Lecture }],
    });

    res.json({
      id: updatedCourse.id,
      title: updatedCourse.title,
      aboutCourse: updatedCourse.aboutCourse,
      semester: updatedCourse.Semester
        ? {
            id: updatedCourse.Semester.id,
            name: updatedCourse.Semester.name,
            startDate: updatedCourse.Semester.startDate,
            endDate: updatedCourse.Semester.endDate,
          }
        : null,
      lectures: updatedCourse.Lectures,
    });
  } catch (error) {
    logger.error("Error in updateCourse:", error);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 400));
  }
});

// Delete course and all related data
const deleteCourse = catchAsyncErrors(async (req, res, next) => {
  logger.info(`Deleting course ID: ${req.params.courseId}`);
  const transaction = await sequelize.transaction();

  try {
    // Find teacher and check authorization
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      logger.error(`Teacher not found for user ID: ${req.user.id}`);
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find the course and verify ownership
    const course = await Course.findOne({
      where: {
        id: req.params.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Delete the course (cascades to lectures, assignments, etc. due to FK constraints)
    await course.destroy({ transaction });

    await transaction.commit();
    logger.info(`Course deleted: ${req.params.courseId}`);

    res.json({
      success: true,
      message: "Course deleted successfully",
    });
  } catch (error) {
    logger.error("Error in deleteCourse:", error);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 400));
  }
});

module.exports = {
  getUserCourses,
  getEnrolledCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
};
