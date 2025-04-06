const { User, Teacher, Student, sequelize } = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");

const uploadUsers = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();
  console.log("Processing user upload from in-memory data");

  try {
    // Get the Excel data that was parsed in the middleware
    if (
      !req.excelData ||
      !Array.isArray(req.excelData) ||
      req.excelData.length === 0
    ) {
      return res.status(400).json({
        error: "No valid data found in the Excel file",
      });
    }

    const users = req.excelData;
    const results = [];
    const teacherMap = new Map();

    // Process teachers first
    const teacherData = users.filter((user) => user.role === "teacher");

    // Process each teacher individually
    for (const userData of teacherData) {
      const email = userData.email.toLowerCase();

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email },
        transaction,
      });

      if (existingUser) {
        throw new Error(`User with email ${email} already exists`);
      }

      // Create user record
      const user = await User.create(
        {
          ...userData,
          email: email,
        },
        { transaction }
      );

      // Create teacher record
      const teacher = await Teacher.create(
        {
          userId: user.id,
          email: email,
        },
        { transaction }
      );

      // Store in map for quick lookup when processing students
      teacherMap.set(email, teacher);

      // Add to results
      results.push({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      });
    }

    // Process students
    const studentData = users.filter((user) => user.role === "student");

    for (const userData of studentData) {
      const email = userData.email.toLowerCase();
      const teacherEmail = userData.teacherEmail.toLowerCase();

      // Check if user already exists
      const existingUser = await User.findOne({
        where: { email },
        transaction,
      });

      if (existingUser) {
        throw new Error(`User with email ${email} already exists`);
      }

      // Find the teacher
      let teacher = teacherMap.get(teacherEmail);
      if (!teacher) {
        teacher = await Teacher.findOne({
          where: { email: teacherEmail },
          transaction,
        });

        if (!teacher) {
          throw new Error(
            `Teacher with email ${teacherEmail} not found for student: ${email}`
          );
        }
      }

      // Create user document
      const user = await User.create(
        {
          ...userData,
          email: email,
        },
        { transaction }
      );

      // Create student document
      const student = await Student.create(
        {
          userId: user.id,
          teacherId: teacher.id,
          teacherEmail: teacher.email,
        },
        { transaction }
      );

      // Add to results
      results.push({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        teacherEmail: teacher.email,
      });
    }

    // Commit transaction
    await transaction.commit();

    // Return results as array
    return res.status(201).json(results);
  } catch (error) {
    // Rollback transaction on error
    await transaction.rollback();
    console.error("Upload error:", error);

    return res.status(400).json({
      error: error.message || "Error processing upload",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
});

// Get students for the currently authenticated teacher
const getMyStudents = catchAsyncErrors(async (req, res, next) => {
  console.log("getMyStudents: Started");

  // Extract user info from JWT token (set by auth middleware)
  const userId = req.user.id;
  console.log(`Authenticated user ID: ${userId}`);

  // Find the teacher profile for this user
  const teacher = await Teacher.findOne({
    where: { userId },
    include: [{ model: User, attributes: ["name", "email"] }],
  });

  if (!teacher) {
    console.log("Teacher profile not found for authenticated user");
    return next(new ErrorHandler("Teacher profile not found", 404));
  }

  console.log(`Found teacher with ID: ${teacher.id}, Email: ${teacher.email}`);

  // Find all students associated with this teacher
  const students = await Student.findAll({
    where: { teacherId: teacher.id },
    include: [
      {
        model: User,
        attributes: ["name", "email"],
      },
    ],
  });

  if (!students || students.length === 0) {
    console.log("No students found for this teacher");
    return res.status(200).json({
      success: true,
      message: "No students found for this teacher",
      teacherInfo: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.User.name,
      },
      students: [],
    });
  }

  console.log(`Found ${students.length} students for teacher ${teacher.email}`);

  // Format student data
  const formattedStudents = students.map((student) => ({
    id: student.id,
    name: student.User ? student.User.name : "Unknown",
    email: student.User ? student.User.email : "",
    program: student.program,
    semester: student.semester,
  }));

  res.status(200).json({
    success: true,
    count: students.length,
    teacherInfo: {
      id: teacher.id,
      email: teacher.email,
      name: teacher.User.name,
    },
    students: formattedStudents,
  });
});

// Admin route to get students for any teacher by teacher ID
const getStudentsByTeacherId = catchAsyncErrors(async (req, res, next) => {
  console.log("getStudentsByTeacherId: Started");

  const { teacherId } = req.params;
  console.log(`Getting students for teacher ID: ${teacherId}`);

  // Check if teacher exists
  const teacher = await Teacher.findByPk(teacherId, {
    include: [{ model: User, attributes: ["name", "email"] }],
  });

  if (!teacher) {
    console.log("Teacher not found");
    return next(new ErrorHandler("Teacher not found", 404));
  }

  // Find all students associated with this teacher
  const students = await Student.findAll({
    where: { teacherId },
    include: [
      {
        model: User,
        attributes: ["name", "email"],
      },
    ],
  });

  if (!students || students.length === 0) {
    console.log("No students found for this teacher");
    return res.status(200).json({
      success: true,
      message: "No students found for this teacher",
      teacherInfo: {
        id: teacher.id,
        email: teacher.email,
        name: teacher.User ? teacher.User.name : "Unknown",
      },
      students: [],
    });
  }

  console.log(`Found ${students.length} students for teacher ${teacher.email}`);

  // Format student data
  const formattedStudents = students.map((student) => ({
    id: student.id,
    name: student.User ? student.User.name : "Unknown",
    email: student.User ? student.User.email : "",
    program: student.program,
    semester: student.semester,
  }));

  res.status(200).json({
    success: true,
    count: students.length,
    teacherInfo: {
      id: teacher.id,
      email: teacher.email,
      name: teacher.User ? teacher.User.name : "Unknown",
    },
    students: formattedStudents,
  });
});

module.exports = {
  uploadUsers,
  getStudentsByTeacherId,
  getMyStudents,
};
