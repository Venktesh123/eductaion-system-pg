const {
  Course,
  Teacher,
  Student,
  Semester,
  Lecture,
  User,
  StudentCourse,
  CourseOutcome,
  CourseSchedule,
  CourseSyllabus,
  WeeklyPlan,
  CreditPoints,
  CourseAttendance,
  sequelize,
} = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { Op } = require("sequelize");
const {
  uploadFileToAzure,
  deleteFileFromAzure,
} = require("../utils/azureUtils");

// Better logging setup - replace with your preferred logging library
const logger = {
  info: (message) => console.log(`[INFO] ${message}`),
  error: (message, error) => console.error(`[ERROR] ${message}`, error),
};

// Helper function to format course data for consistent API responses
const formatCourseData = async (course) => {
  try {
    // Load associated data if not already loaded
    if (!course.Semester && course.semester_id) {
      await course.reload({
        include: [
          { model: Semester, as: "Semester" },
          { model: CourseOutcome, as: "Outcomes" },
          { model: CourseSchedule, as: "Schedule" },
          { model: CourseSyllabus, as: "Syllabus" },
          { model: WeeklyPlan, as: "WeeklyPlan" },
          { model: CreditPoints, as: "CreditPoints" },
          { model: CourseAttendance, as: "Attendance" },
          { model: Lecture, as: "Lectures" },
        ],
      });
    }

    // Convert attendance sessions from JSON to object if needed
    let attendanceSessions = {};
    if (course.Attendance && course.Attendance.sessions) {
      attendanceSessions =
        typeof course.Attendance.sessions === "string"
          ? JSON.parse(course.Attendance.sessions)
          : course.Attendance.sessions;
    }

    // Process lectures
    let lectures = [];
    if (course.Lectures && Array.isArray(course.Lectures)) {
      lectures = course.Lectures.map((lecture) => ({
        id: lecture.id,
        title: lecture.title,
        content: lecture.content,
        videoUrl: lecture.video_url,
        isReviewed: lecture.is_reviewed,
        reviewDeadline: lecture.review_deadline,
        createdAt: lecture.created_at,
        updatedAt: lecture.updated_at,
      }));
    }

    return {
      id: course.id,
      title: course.title,
      aboutCourse: course.about_course,
      semester: course.Semester
        ? {
            id: course.Semester.id,
            name: course.Semester.name,
            startDate: course.Semester.start_date,
            endDate: course.Semester.end_date,
          }
        : null,
      creditPoints: course.CreditPoints
        ? {
            lecture: course.CreditPoints.lecture_hours,
            tutorial: course.CreditPoints.tutorial_hours,
            practical: course.CreditPoints.practical_hours,
            project: course.CreditPoints.project_hours,
          }
        : {
            lecture: 0,
            tutorial: 0,
            practical: 0,
            project: 0,
          },
      learningOutcomes: course.Outcomes
        ? JSON.parse(course.Outcomes.outcomes || "[]")
        : [],
      weeklyPlan: course.WeeklyPlan
        ? JSON.parse(course.WeeklyPlan.weeks || "[]").map((week) => ({
            weekNumber: week.weekNumber,
            topics: week.topics,
          }))
        : [],
      syllabus: course.Syllabus
        ? JSON.parse(course.Syllabus.modules || "[]").map((module) => ({
            moduleNumber: module.moduleNumber,
            moduleTitle: module.moduleTitle,
            topics: module.topics,
          }))
        : [],
      courseSchedule: course.Schedule
        ? {
            classStartDate: course.Schedule.class_start_date,
            classEndDate: course.Schedule.class_end_date,
            midSemesterExamDate: course.Schedule.mid_semester_exam_date,
            endSemesterExamDate: course.Schedule.end_semester_exam_date,
            classDaysAndTimes: JSON.parse(
              course.Schedule.class_days_and_times || "[]"
            ),
          }
        : {
            classStartDate: null,
            classEndDate: null,
            midSemesterExamDate: null,
            endSemesterExamDate: null,
            classDaysAndTimes: [],
          },
      lectures: lectures,
      attendance: {
        sessions: attendanceSessions,
      },
    };
  } catch (error) {
    logger.error("Error in formatCourseData:", error);
    throw error;
  }
};

// Get enrolled courses for the logged-in student
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
      where: { user_id: req.user.id },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!student) {
      logger.error(`Student not found for user ID: ${req.user.id}`);
      return next(new ErrorHandler("Student not found", 404));
    }

    // Get the courses this student is enrolled in
    const enrollments = await StudentCourse.findAll({
      where: { student_id: student.id },
      attributes: ["course_id", "enrollment_date"],
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

    const courseIds = enrollments.map((enrollment) => enrollment.course_id);

    // Get course details
    const courses = await Course.findAll({
      where: { id: courseIds },
      attributes: ["id", "title", "about_course"],
      include: [
        {
          model: Semester,
          attributes: ["id", "name", "start_date", "end_date"],
        },
      ],
      order: [["created_at", "DESC"]],
    });

    logger.info(
      `Found ${courses.length} enrolled courses for student: ${student.id}`
    );

    // Create a map of courseId to enrollment date
    const enrollmentDates = {};
    enrollments.forEach((enrollment) => {
      enrollmentDates[enrollment.course_id] = enrollment.enrollment_date;
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
        aboutCourse: course.about_course,
        enrollmentDate: enrollmentDates[course.id],
        semester: course.Semester
          ? {
              id: course.Semester.id,
              name: course.Semester.name,
              startDate: course.Semester.start_date,
              endDate: course.Semester.end_date,
            }
          : null,
      })),
    });
  } catch (error) {
    logger.error("Error in getEnrolledCourses:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get courses for the logged-in teacher or student
const getUserCourses = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(`Fetching courses for user with ID: ${req.user.id}`);
    const userRole = req.user.role;

    if (userRole === "teacher") {
      // Get teacher's courses
      const teacher = await Teacher.findOne({
        where: { user_id: req.user.id },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (!teacher) {
        logger.error(`Teacher not found for user ID: ${req.user.id}`);
        return next(new ErrorHandler("Teacher not found", 404));
      }

      const courses = await Course.findAll({
        where: { teacher_id: teacher.id },
        attributes: ["id", "title", "about_course"],
        include: [
          {
            model: Semester,
            attributes: ["id", "name", "start_date", "end_date"],
          },
        ],
        order: [["created_at", "DESC"]],
      });

      // Count students for this teacher
      const studentCount = await Student.count({
        where: { teacher_id: teacher.id },
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
          aboutCourse: course.about_course,
          semester: course.Semester
            ? {
                id: course.Semester.id,
                name: course.Semester.name,
                startDate: course.Semester.start_date,
                endDate: course.Semester.end_date,
              }
            : null,
        })),
      });
    } else if (userRole === "student") {
      // Get student's enrolled courses - reuse the existing function
      return await getEnrolledCourses(req, res, next);
    } else {
      return next(new ErrorHandler("Invalid user role", 403));
    }
  } catch (error) {
    logger.error("Error in getUserCourses:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get specific course by ID with all its related data
const getCourseById = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(
      `Fetching course ID: ${req.params.courseId} for user: ${req.user.id}`
    );

    // Find the course with all its related data
    const course = await Course.findByPk(req.params.courseId, {
      include: [
        { model: Semester },
        { model: CourseOutcome, as: "Outcomes" },
        { model: CourseSchedule, as: "Schedule" },
        { model: CourseSyllabus, as: "Syllabus" },
        { model: WeeklyPlan, as: "WeeklyPlan" },
        { model: CreditPoints, as: "CreditPoints" },
        { model: CourseAttendance, as: "Attendance" },
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
          user_id: req.user.id,
          id: course.teacher_id,
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
          where: { course_id: course.id },
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
          enrollmentDate: enrollment.enrollment_date,
        }));
      }
    } else if (req.user.role === "student") {
      // For student: check if they're enrolled in the course
      const student = await Student.findOne({
        where: { user_id: req.user.id },
        include: [{ model: User, attributes: ["name", "email"] }],
      });

      if (student) {
        // Check if student is enrolled in this course
        const enrollment = await StudentCourse.findOne({
          where: {
            student_id: student.id,
            course_id: course.id,
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

    // Get lectures for this course
    const lectures = await Lecture.findAll({
      where: { course_id: course.id },
      order: [["created_at", "ASC"]],
    });

    // Add lectures to the course object
    course.Lectures = lectures;

    logger.info(`Found course: ${course.title}`);

    // Format the course data for API response
    const formattedCourse = await formatCourseData(course);

    // Prepare the response
    const response = { ...formattedCourse };

    // Add user-specific data
    if (req.user.role === "teacher") {
      // Get teacher information and include student count
      const teacherData = await Teacher.findByPk(course.teacher_id, {
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
      const teacherData = await Teacher.findByPk(course.teacher_id, {
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

// Create new course with all its related data
const createCourse = catchAsyncErrors(async (req, res, next) => {
  logger.info("Starting createCourse controller function");
  const transaction = await sequelize.transaction();

  try {
    logger.info("Transaction started");

    // Find teacher using the logged-in user ID
    const teacher = await Teacher.findOne({
      where: { user_id: req.user.id },
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
      about_course: req.body.aboutCourse,
      semester_id: req.body.semesterId,
      teacher_id: teacher.id,
    };

    const course = await Course.create(courseData, { transaction });
    logger.info(`Main course created with ID: ${course.id}`);

    // Create learning outcomes
    if (req.body.learningOutcomes && req.body.learningOutcomes.length > 0) {
      logger.info("Creating learning outcomes");
      await CourseOutcome.create(
        {
          course_id: course.id,
          outcomes: JSON.stringify(req.body.learningOutcomes),
        },
        { transaction }
      );
    }

    // Create course schedule
    if (req.body.courseSchedule) {
      logger.info("Creating course schedule");
      const scheduleData = {
        course_id: course.id,
        class_start_date: req.body.courseSchedule.classStartDate,
        class_end_date: req.body.courseSchedule.classEndDate,
        mid_semester_exam_date: req.body.courseSchedule.midSemesterExamDate,
        end_semester_exam_date: req.body.courseSchedule.endSemesterExamDate,
        class_days_and_times: JSON.stringify(
          req.body.courseSchedule.classDaysAndTimes || []
        ),
      };
      await CourseSchedule.create(scheduleData, { transaction });
    }

    // Create syllabus
    if (req.body.syllabus && req.body.syllabus.length > 0) {
      logger.info("Creating course syllabus");
      await CourseSyllabus.create(
        {
          course_id: course.id,
          modules: JSON.stringify(req.body.syllabus),
        },
        { transaction }
      );
    }

    // Create weekly plan
    if (req.body.weeklyPlan && req.body.weeklyPlan.length > 0) {
      logger.info("Creating weekly plan");
      await WeeklyPlan.create(
        {
          course_id: course.id,
          weeks: JSON.stringify(req.body.weeklyPlan),
        },
        { transaction }
      );
    }

    // Create credit points
    if (req.body.creditPoints) {
      logger.info("Creating credit points");
      await CreditPoints.create(
        {
          course_id: course.id,
          lecture_hours: req.body.creditPoints.lecture || 0,
          tutorial_hours: req.body.creditPoints.tutorial || 0,
          practical_hours: req.body.creditPoints.practical || 0,
          project_hours: req.body.creditPoints.project || 0,
        },
        { transaction }
      );
    }

    // Create attendance if provided
    if (req.body.attendance && req.body.attendance.sessions) {
      logger.info("Creating course attendance");
      await CourseAttendance.create(
        {
          course_id: course.id,
          sessions: JSON.stringify(req.body.attendance.sessions),
        },
        { transaction }
      );
    }

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
            video_url: lectureData.videoUrl || null,
            course_id: course.id,
            is_reviewed: lectureData.isReviewed || false,
            review_deadline: lectureData.reviewDeadline || null,
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
      where: { teacher_id: teacher.id },
      transaction,
    });

    // Add course ID to all students' enrollments
    if (students && students.length > 0) {
      logger.info(`Enrolling ${students.length} students in the course`);

      const enrollmentPromises = students.map((student) => {
        return StudentCourse.create(
          {
            student_id: student.id,
            course_id: course.id,
            enrollment_date: new Date(),
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

    // Fetch the fully populated course
    const createdCourse = await Course.findByPk(course.id, {
      include: [
        { model: Semester },
        { model: CourseOutcome, as: "Outcomes" },
        { model: CourseSchedule, as: "Schedule" },
        { model: CourseSyllabus, as: "Syllabus" },
        { model: WeeklyPlan, as: "WeeklyPlan" },
        { model: CreditPoints, as: "CreditPoints" },
        { model: CourseAttendance, as: "Attendance" },
        { model: Lecture },
      ],
    });

    // Format the course data for API response
    const formattedCourse = await formatCourseData(createdCourse);

    logger.info("Sending response with course data");
    res.status(201).json(formattedCourse);
  } catch (error) {
    logger.error("Error in createCourse:", error);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 400));
  }
});

// Update course and its related data
const updateCourse = catchAsyncErrors(async (req, res, next) => {
  logger.info(`Updating course ID: ${req.params.courseId}`);
  const transaction = await sequelize.transaction();

  try {
    // Find teacher and check authorization
    const teacher = await Teacher.findOne({
      where: { user_id: req.user.id },
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
        teacher_id: teacher.id,
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
    if (req.body.aboutCourse) updateData.about_course = req.body.aboutCourse;
    if (req.body.semesterId) updateData.semester_id = req.body.semesterId;

    await course.update(updateData, { transaction });
    logger.info("Updated main course fields");

    // Update learning outcomes
    if (req.body.learningOutcomes) {
      const [outcome, created] = await CourseOutcome.findOrCreate({
        where: { course_id: course.id },
        defaults: {
          course_id: course.id,
          outcomes: JSON.stringify(req.body.learningOutcomes),
        },
        transaction,
      });

      if (!created) {
        await outcome.update(
          {
            outcomes: JSON.stringify(req.body.learningOutcomes),
          },
          { transaction }
        );
      }
      logger.info("Updated learning outcomes");
    }

    // Update course schedule
    if (req.body.courseSchedule) {
      const scheduleData = {
        class_start_date: req.body.courseSchedule.classStartDate,
        class_end_date: req.body.courseSchedule.classEndDate,
        mid_semester_exam_date: req.body.courseSchedule.midSemesterExamDate,
        end_semester_exam_date: req.body.courseSchedule.endSemesterExamDate,
        class_days_and_times: JSON.stringify(
          req.body.courseSchedule.classDaysAndTimes || []
        ),
      };

      const [schedule, created] = await CourseSchedule.findOrCreate({
        where: { course_id: course.id },
        defaults: { ...scheduleData, course_id: course.id },
        transaction,
      });

      if (!created) {
        await schedule.update(scheduleData, { transaction });
      }
      logger.info("Updated course schedule");
    }

    // Update syllabus
    if (req.body.syllabus) {
      const [syllabus, created] = await CourseSyllabus.findOrCreate({
        where: { course_id: course.id },
        defaults: {
          course_id: course.id,
          modules: JSON.stringify(req.body.syllabus),
        },
        transaction,
      });

      if (!created) {
        await syllabus.update(
          {
            modules: JSON.stringify(req.body.syllabus),
          },
          { transaction }
        );
      }
      logger.info("Updated course syllabus");
    }

    // Update weekly plan
    if (req.body.weeklyPlan) {
      const [weeklyPlan, created] = await WeeklyPlan.findOrCreate({
        where: { course_id: course.id },
        defaults: {
          course_id: course.id,
          weeks: JSON.stringify(req.body.weeklyPlan),
        },
        transaction,
      });

      if (!created) {
        await weeklyPlan.update(
          {
            weeks: JSON.stringify(req.body.weeklyPlan),
          },
          { transaction }
        );
      }
      logger.info("Updated weekly plan");
    }

    // Update credit points
    if (req.body.creditPoints) {
      const creditPointsData = {
        lecture_hours: req.body.creditPoints.lecture || 0,
        tutorial_hours: req.body.creditPoints.tutorial || 0,
        practical_hours: req.body.creditPoints.practical || 0,
        project_hours: req.body.creditPoints.project || 0,
      };

      const [creditPoints, created] = await CreditPoints.findOrCreate({
        where: { course_id: course.id },
        defaults: { ...creditPointsData, course_id: course.id },
        transaction,
      });

      if (!created) {
        await creditPoints.update(creditPointsData, { transaction });
      }
      logger.info("Updated credit points");
    }

    // Update attendance if provided
    if (req.body.attendance && req.body.attendance.sessions) {
      const [attendance, created] = await CourseAttendance.findOrCreate({
        where: { course_id: course.id },
        defaults: {
          course_id: course.id,
          sessions: JSON.stringify(req.body.attendance.sessions),
        },
        transaction,
      });

      if (!created) {
        await attendance.update(
          {
            sessions: JSON.stringify(req.body.attendance.sessions),
          },
          { transaction }
        );
      }
      logger.info("Updated course attendance");
    }

    await transaction.commit();
    logger.info("Transaction committed successfully");

    // Get updated course with all populated fields
    const updatedCourse = await Course.findByPk(course.id, {
      include: [
        { model: Semester },
        { model: CourseOutcome, as: "Outcomes" },
        { model: CourseSchedule, as: "Schedule" },
        { model: CourseSyllabus, as: "Syllabus" },
        { model: WeeklyPlan, as: "WeeklyPlan" },
        { model: CreditPoints, as: "CreditPoints" },
        { model: CourseAttendance, as: "Attendance" },
        { model: Lecture },
      ],
    });

    // Format the course data for API response
    const formattedCourse = await formatCourseData(updatedCourse);

    res.json(formattedCourse);
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
      where: { user_id: req.user.id },
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
        teacher_id: teacher.id,
      },
      transaction,
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Before deleting course, get lectures to delete videos from Azure
    const lectures = await Lecture.findAll({
      where: { course_id: course.id },
      transaction,
    });

    // Delete videos from Azure for each lecture
    for (const lecture of lectures) {
      if (lecture.video_key) {
        try {
          await deleteFileFromAzure(lecture.video_key);
          logger.info(`Deleted video from Azure: ${lecture.video_key}`);
        } catch (deleteError) {
          logger.error("Error deleting video file:", deleteError);
          // Continue with deletion even if Azure delete fails
        }
      }
    }

    // Delete all related data
    await Promise.all([
      CourseOutcome.destroy({ where: { course_id: course.id }, transaction }),
      CourseSchedule.destroy({ where: { course_id: course.id }, transaction }),
      CourseSyllabus.destroy({ where: { course_id: course.id }, transaction }),
      WeeklyPlan.destroy({ where: { course_id: course.id }, transaction }),
      CreditPoints.destroy({ where: { course_id: course.id }, transaction }),
      CourseAttendance.destroy({
        where: { course_id: course.id },
        transaction,
      }),
      Lecture.destroy({ where: { course_id: course.id }, transaction }),
      StudentCourse.destroy({ where: { course_id: course.id }, transaction }),
    ]);

    logger.info("Deleted all related course data");

    // Delete the course itself (should be after related data is deleted)
    await course.destroy({ transaction });
    logger.info(`Course deleted: ${req.params.courseId}`);

    await transaction.commit();
    logger.info("Transaction committed successfully");

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

// Add a new lecture to a course
const addLecture = catchAsyncErrors(async (req, res, next) => {
  logger.info(`Adding lecture to course ID: ${req.params.courseId}`);
  const transaction = await sequelize.transaction();

  try {
    // Find teacher and check authorization
    const teacher = await Teacher.findOne({
      where: { user_id: req.user.id },
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
        teacher_id: teacher.id,
      },
      transaction,
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Handle video file upload if present
    let videoUrl = req.body.videoUrl;
    let videoKey = null;

    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        return next(new ErrorHandler("Uploaded file must be a video", 400));
      }

      // Upload to Azure
      const uploadPath = `courses/${course.id}/lectures`;
      const uploadResult = await uploadFileToAzure(videoFile, uploadPath);

      videoUrl = uploadResult.url;
      videoKey = uploadResult.key;
    }

    // Create new lecture
    const newLecture = await Lecture.create(
      {
        title: req.body.title,
        content: req.body.content || req.body.title,
        video_url: videoUrl,
        video_key: videoKey,
        course_id: course.id,
        is_reviewed: req.body.isReviewed || false,
        review_deadline: req.body.reviewDeadline || null,
      },
      { transaction }
    );

    logger.info(`Created new lecture: ${newLecture.id}`);

    await transaction.commit();
    logger.info("Transaction committed successfully");

    // Return the new lecture with camelCase keys for the API
    res.status(201).json({
      id: newLecture.id,
      title: newLecture.title,
      content: newLecture.content,
      videoUrl: newLecture.video_url,
      videoKey: newLecture.video_key,
      courseId: newLecture.course_id,
      isReviewed: newLecture.is_reviewed,
      reviewDeadline: newLecture.review_deadline,
      createdAt: newLecture.created_at,
      updatedAt: newLecture.updated_at,
    });
  } catch (error) {
    logger.error("Error in addLecture:", error);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 400));
  }
});

// Update a specific lecture in a course
const updateCourseLecture = catchAsyncErrors(async (req, res, next) => {
  logger.info(
    `Updating lecture ID: ${req.params.lectureId} in course ID: ${req.params.courseId}`
  );
  const transaction = await sequelize.transaction();

  try {
    // Find teacher and check authorization
    const teacher = await Teacher.findOne({
      where: { user_id: req.user.id },
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
        teacher_id: teacher.id,
      },
      transaction,
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Find the lecture
    const lecture = await Lecture.findOne({
      where: {
        id: req.params.lectureId,
        course_id: course.id,
      },
      transaction,
    });

    if (!lecture) {
      logger.error(`Lecture not found with ID: ${req.params.lectureId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Update lecture fields
    const updateData = {};
    if (req.body.title) updateData.title = req.body.title;
    if (req.body.content) updateData.content = req.body.content;
    if (req.body.isReviewed !== undefined)
      updateData.is_reviewed = req.body.isReviewed;
    if (req.body.reviewDeadline)
      updateData.review_deadline = req.body.reviewDeadline;

    // Handle video file update if provided
    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        return next(new ErrorHandler("Uploaded file must be a video", 400));
      }

      // Delete old video from Azure if it exists
      if (lecture.video_key) {
        try {
          await deleteFileFromAzure(lecture.video_key);
        } catch (deleteError) {
          logger.error("Error deleting old video file:", deleteError);
          // Continue with upload even if delete fails
        }
      }

      // Upload new video to Azure
      const uploadPath = `courses/${course.id}/lectures`;
      const uploadResult = await uploadFileToAzure(videoFile, uploadPath);

      updateData.video_url = uploadResult.url;
      updateData.video_key = uploadResult.key;
    } else if (req.body.videoUrl) {
      updateData.video_url = req.body.videoUrl;
    }

    await lecture.update(updateData, { transaction });
    logger.info(`Updated lecture: ${lecture.id}`);

    await transaction.commit();
    logger.info("Transaction committed successfully");

    // Return the updated lecture with camelCase keys for the API
    res.json({
      id: lecture.id,
      title: lecture.title,
      content: lecture.content,
      videoUrl: lecture.video_url,
      videoKey: lecture.video_key,
      courseId: lecture.course_id,
      isReviewed: lecture.is_reviewed,
      reviewDeadline: lecture.review_deadline,
      createdAt: lecture.created_at,
      updatedAt: lecture.updated_at,
    });
  } catch (error) {
    logger.error("Error in updateCourseLecture:", error);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 400));
  }
});

// Delete a lecture from a course
const deleteCourseLecture = catchAsyncErrors(async (req, res, next) => {
  logger.info(
    `Deleting lecture ID: ${req.params.lectureId} from course ID: ${req.params.courseId}`
  );
  const transaction = await sequelize.transaction();

  try {
    // Find teacher and check authorization
    const teacher = await Teacher.findOne({
      where: { user_id: req.user.id },
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
        teacher_id: teacher.id,
      },
      transaction,
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Find the lecture
    const lecture = await Lecture.findOne({
      where: {
        id: req.params.lectureId,
        course_id: course.id,
      },
      transaction,
    });

    if (!lecture) {
      logger.error(`Lecture not found with ID: ${req.params.lectureId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Delete video from Azure if it exists
    if (lecture.video_key) {
      try {
        await deleteFileFromAzure(lecture.video_key);
        logger.info(`Deleted video from Azure: ${lecture.video_key}`);
      } catch (deleteError) {
        logger.error("Error deleting video file:", deleteError);
        // Continue with lecture deletion even if Azure delete fails
      }
    }

    // Delete the lecture
    await lecture.destroy({ transaction });
    logger.info(`Deleted lecture: ${lecture.id}`);

    await transaction.commit();
    logger.info("Transaction committed successfully");

    res.json({
      success: true,
      message: "Lecture deleted successfully",
    });
  } catch (error) {
    logger.error("Error in deleteCourseLecture:", error);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 400));
  }
});

// Get all lectures for a course
const getCourseLectures = catchAsyncErrors(async (req, res, next) => {
  try {
    logger.info(`Getting all lectures for course ID: ${req.params.courseId}`);

    // Verify user has access to the course
    const course = await Course.findByPk(req.params.courseId);

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    let hasAccess = false;

    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({
        where: {
          user_id: req.user.id,
          id: course.teacher_id,
        },
      });

      if (teacher) {
        hasAccess = true;
      }
    } else if (req.user.role === "student") {
      const student = await Student.findOne({
        where: { user_id: req.user.id },
      });

      if (student) {
        const enrollment = await StudentCourse.findOne({
          where: {
            student_id: student.id,
            course_id: course.id,
          },
        });

        if (enrollment) {
          hasAccess = true;
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

    // Get lectures for this course
    const lectures = await Lecture.findAll({
      where: { course_id: course.id },
      order: [["created_at", "ASC"]],
    });

    // Check and update review status for all lectures
    const now = new Date();
    const updatedLectures = [];

    for (const lecture of lectures) {
      if (
        !lecture.is_reviewed &&
        lecture.review_deadline &&
        now >= lecture.review_deadline
      ) {
        await lecture.update({ is_reviewed: true });
      }

      updatedLectures.push({
        id: lecture.id,
        title: lecture.title,
        content: lecture.content,
        videoUrl: lecture.video_url,
        isReviewed: lecture.is_reviewed,
        reviewDeadline: lecture.review_deadline,
        createdAt: lecture.created_at,
        updatedAt: lecture.updated_at,
      });
    }

    logger.info(`Returning ${lectures.length} lectures`);
    res.json(updatedLectures);
  } catch (error) {
    logger.error("Error in getCourseLectures:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update attendance only
const updateCourseAttendance = catchAsyncErrors(async (req, res, next) => {
  logger.info(`Updating attendance for course ID: ${req.params.courseId}`);
  const transaction = await sequelize.transaction();

  try {
    // Find teacher and check authorization
    const teacher = await Teacher.findOne({
      where: { user_id: req.user.id },
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
        teacher_id: teacher.id,
      },
      transaction,
    });

    if (!course) {
      logger.error(`Course not found with ID: ${req.params.courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    if (req.body.sessions) {
      const sessionsJson = JSON.stringify(req.body.sessions);

      const [attendance, created] = await CourseAttendance.findOrCreate({
        where: { course_id: course.id },
        defaults: {
          course_id: course.id,
          sessions: sessionsJson,
        },
        transaction,
      });

      if (!created) {
        await attendance.update(
          {
            sessions: sessionsJson,
          },
          { transaction }
        );
      }
      logger.info(`Updated attendance for course: ${course.id}`);
    }

    await transaction.commit();
    logger.info("Transaction committed successfully");

    // Get updated course attendance
    const updatedAttendance = await CourseAttendance.findOne({
      where: { course_id: course.id },
    });

    // Format attendance for response
    const attendanceSessions = updatedAttendance
      ? JSON.parse(updatedAttendance.sessions || "{}")
      : {};

    res.json({
      id: course.id,
      attendance: {
        sessions: attendanceSessions,
      },
    });
  } catch (error) {
    logger.error("Error in updateCourseAttendance:", error);

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
  updateCourseAttendance,
  addLecture,
  updateCourseLecture,
  deleteCourseLecture,
  getCourseLectures,
};
