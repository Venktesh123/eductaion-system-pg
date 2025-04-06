const { User, Student, Teacher, Course, sequelize } = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

// Get all students assigned to the logged-in teacher
const getStudents = catchAsyncErrors(async (req, res, next) => {
  try {
    // Find teacher profile
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!teacher) {
      return next(new ErrorHandler("Teacher profile not found", 404));
    }

    // Find students
    const students = await Student.findAll({
      where: { teacherId: teacher.id },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    // Format response
    const formattedStudents = students.map((student) => ({
      id: student.id,
      userId: student.userId,
      name: student.User ? student.User.name : "Unknown",
      email: student.User ? student.User.email : "",
      program: student.program,
      semester: student.semester,
      createdAt: student.createdAt,
    }));

    res.json(formattedStudents);
  } catch (error) {
    console.error("Error in getStudents:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Assign a student to a teacher (admin function)
const assignStudent = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { studentId } = req.params;
    const teacherId = req.user.role === "admin" ? req.body.teacherId : null;

    // If not admin, user must be a teacher assigning to themselves
    let teacher;
    if (req.user.role === "admin" && teacherId) {
      teacher = await Teacher.findByPk(teacherId, {
        include: [{ model: User, attributes: ["name", "email"] }],
        transaction,
      });
    } else {
      teacher = await Teacher.findOne({
        where: { userId: req.user.id },
        include: [{ model: User, attributes: ["name", "email"] }],
        transaction,
      });
    }

    if (!teacher) {
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find student
    let student;
    if (req.user.role === "admin") {
      // Admin can provide any student ID
      student = await Student.findByPk(studentId, {
        include: [{ model: User, attributes: ["name", "email"] }],
        transaction,
      });
    } else {
      // Teacher can only assign students who have their userId
      student = await Student.findOne({
        where: {
          id: studentId,
          teacherId: null, // Only allow assigning unassigned students
        },
        include: [{ model: User, attributes: ["name", "email"] }],
        transaction,
      });
    }

    if (!student) {
      await transaction.rollback();
      return next(
        new ErrorHandler("Student not found or already assigned", 404)
      );
    }

    // Update student with teacher association
    await student.update(
      {
        teacherId: teacher.id,
        teacherEmail: teacher.email,
      },
      { transaction }
    );

    // Find all courses by this teacher
    const teacherCourses = await Course.findAll({
      where: { teacherId: teacher.id },
      transaction,
    });

    // Enroll student in all courses of this teacher
    const enrollmentPromises = teacherCourses.map((course) => {
      return sequelize.models.StudentCourse.create(
        {
          studentId: student.id,
          courseId: course.id,
          enrollmentDate: new Date(),
        },
        { transaction }
      );
    });

    if (enrollmentPromises.length > 0) {
      await Promise.all(enrollmentPromises);
    }

    await transaction.commit();

    res.json({
      success: true,
      message: "Student assigned successfully",
      student: {
        id: student.id,
        name: student.User ? student.User.name : "Unknown",
        email: student.User ? student.User.email : "",
        teacher: {
          id: teacher.id,
          name: teacher.User ? teacher.User.name : "Unknown",
          email: teacher.email,
        },
        coursesEnrolled: teacherCourses.length,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in assignStudent:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get teacher profile
const getProfile = catchAsyncErrors(async (req, res, next) => {
  try {
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ["name", "email"] }],
    });

    if (!teacher) {
      return next(new ErrorHandler("Teacher profile not found", 404));
    }

    // Count students and courses
    const studentCount = await Student.count({
      where: { teacherId: teacher.id },
    });

    const courseCount = await Course.count({
      where: { teacherId: teacher.id },
    });

    res.json({
      id: teacher.id,
      name: teacher.User ? teacher.User.name : "Unknown",
      email: teacher.email,
      totalStudents: studentCount,
      totalCourses: courseCount,
      createdAt: teacher.createdAt,
    });
  } catch (error) {
    console.error("Error in getProfile:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update teacher profile
const updateProfile = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;

    // Find the teacher
    const teacher = await Teacher.findOne({
      where: { userId },
      include: [
        {
          model: User,
          attributes: ["name", "email"],
        },
      ],
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return next(new ErrorHandler("Teacher profile not found", 404));
    }

    // If user data is being updated
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

    // Get the updated teacher
    const updatedTeacher = await Teacher.findOne({
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
      teacher: {
        id: updatedTeacher.id,
        name: updatedTeacher.User.name,
        email: updatedTeacher.email,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateProfile:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

module.exports = {
  getStudents,
  assignStudent,
  getProfile,
  updateProfile,
};
