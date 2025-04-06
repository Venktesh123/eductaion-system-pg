const {
  Course,
  Student,
  Teacher,
  User,
  StudentCourse,
  sequelize,
} = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Enroll a student in a course
const enrollCourse = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the course
    const course = await Course.findByPk(courseId, { transaction });
    if (!course) {
      await transaction.rollback();
      return next(new ErrorHandler("Course not found", 404));
    }

    // Find the student
    const student = await Student.findOne({
      where: { userId },
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return next(new ErrorHandler("Student not found", 404));
    }

    // Check if student's teacher matches course's teacher
    if (course.teacherId !== student.teacherId) {
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "You can only enroll in courses taught by your assigned teacher",
          403
        )
      );
    }

    // Check if student is already enrolled
    const existingEnrollment = await StudentCourse.findOne({
      where: {
        studentId: student.id,
        courseId,
      },
      transaction,
    });

    if (existingEnrollment) {
      await transaction.rollback();
      return next(new ErrorHandler("Already enrolled in this course", 400));
    }

    // Create enrollment
    await StudentCourse.create(
      {
        studentId: student.id,
        courseId,
        enrollmentDate: new Date(),
      },
      { transaction }
    );

    await transaction.commit();

    // Get the course details to return
    const enrolledCourse = await Course.findByPk(courseId, {
      include: [
        {
          model: Teacher,
          include: [
            {
              model: User,
              attributes: ["name", "email"],
            },
          ],
        },
        {
          model: Student,
          where: { id: student.id },
          required: false,
          through: { attributes: ["enrollmentDate"] },
        },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Successfully enrolled in the course",
      course: {
        id: enrolledCourse.id,
        title: enrolledCourse.title,
        aboutCourse: enrolledCourse.aboutCourse,
        teacher: enrolledCourse.Teacher
          ? {
              id: enrolledCourse.Teacher.id,
              name: enrolledCourse.Teacher.User
                ? enrolledCourse.Teacher.User.name
                : "Unknown",
              email: enrolledCourse.Teacher.email,
            }
          : null,
        enrollmentDate:
          enrolledCourse.Students && enrolledCourse.Students[0]
            ? enrolledCourse.Students[0].StudentCourse.enrollmentDate
            : new Date(),
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in enrollCourse:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get student's enrollment details for a course
const getEnrollmentDetails = catchAsyncErrors(async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the student
    const student = await Student.findOne({
      where: { userId },
      include: [
        {
          model: User,
          attributes: ["name", "email"],
        },
      ],
    });

    if (!student) {
      return next(new ErrorHandler("Student not found", 404));
    }

    // Find the enrollment
    const enrollment = await StudentCourse.findOne({
      where: {
        studentId: student.id,
        courseId,
      },
      include: [
        {
          model: Course,
          include: [
            {
              model: Teacher,
              include: [
                {
                  model: User,
                  attributes: ["name", "email"],
                },
              ],
            },
          ],
        },
      ],
    });

    if (!enrollment) {
      return next(new ErrorHandler("Not enrolled in this course", 404));
    }

    // Format the response
    const response = {
      studentId: student.id,
      studentName: student.User.name,
      studentEmail: student.User.email,
      courseId: enrollment.Course.id,
      courseTitle: enrollment.Course.title,
      enrollmentDate: enrollment.enrollmentDate,
      teacher: enrollment.Course.Teacher
        ? {
            id: enrollment.Course.Teacher.id,
            name: enrollment.Course.Teacher.User
              ? enrollment.Course.Teacher.User.name
              : "Unknown",
            email: enrollment.Course.Teacher.email,
          }
        : null,
    };

    res.json({
      success: true,
      enrollment: response,
    });
  } catch (error) {
    console.error("Error in getEnrollmentDetails:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Unenroll from a course
const unenrollCourse = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Find the student
    const student = await Student.findOne({
      where: { userId },
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return next(new ErrorHandler("Student not found", 404));
    }

    // Find the enrollment
    const enrollment = await StudentCourse.findOne({
      where: {
        studentId: student.id,
        courseId,
      },
      transaction,
    });

    if (!enrollment) {
      await transaction.rollback();
      return next(new ErrorHandler("Not enrolled in this course", 404));
    }

    // Delete the enrollment
    await enrollment.destroy({ transaction });

    await transaction.commit();

    res.json({
      success: true,
      message: "Successfully unenrolled from the course",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in unenrollCourse:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update student profile
const updateProfile = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const { program, semester } = req.body;

    // Find the student
    const student = await Student.findOne({
      where: { userId },
      include: [
        {
          model: User,
          attributes: ["name", "email"],
        },
      ],
      transaction,
    });

    if (!student) {
      await transaction.rollback();
      return next(new ErrorHandler("Student not found", 404));
    }

    // Update student fields
    const updateData = {};
    if (program !== undefined) updateData.program = program;
    if (semester !== undefined) updateData.semester = semester;

    // Only update if there are changes
    if (Object.keys(updateData).length > 0) {
      await student.update(updateData, { transaction });
    }

    // If user data is also being updated
    if (req.body.name) {
      await User.update(
        { name: req.body.name },
        {
          where: { id: userId },
          transaction,
        }
      );
    }

    await transaction.commit();

    // Get the updated student
    const updatedStudent = await Student.findOne({
      where: { userId },
      include: [
        {
          model: User,
          attributes: ["name", "email"],
        },
      ],
    });

    res.json({
      success: true,
      message: "Profile updated successfully",
      student: {
        id: updatedStudent.id,
        name: updatedStudent.User.name,
        email: updatedStudent.User.email,
        program: updatedStudent.program,
        semester: updatedStudent.semester,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateProfile:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

module.exports = {
  enrollCourse,
  getEnrollmentDetails,
  unenrollCourse,
  updateProfile,
};
