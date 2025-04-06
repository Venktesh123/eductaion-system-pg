const {
  Assignment,
  Course,
  Teacher,
  Student,
  AssignmentAttachment,
  Submission,
  User,
  sequelize,
} = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { uploadFileToS3 } = require("../utils/s3Utils");

// Create new assignment
exports.createAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("createAssignment: Started");
  const transaction = await sequelize.transaction();

  try {
    const { title, description, dueDate, totalPoints } = req.body;
    const { courseId } = req.params; // Extract courseId from URL

    console.log(`Creating assignment for course: ${courseId}`);

    // Validate inputs
    if (!title || !description || !dueDate || !totalPoints) {
      console.log("Missing required fields");
      return next(new ErrorHandler("All fields are required", 400));
    }

    // Check if course exists and belongs to the teacher
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    const course = await Course.findOne({
      where: {
        id: courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log(`Course not found: ${courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }
    console.log("Course found");

    // Create assignment object
    const assignment = await Assignment.create(
      {
        title,
        description,
        courseId,
        dueDate,
        totalPoints,
        isActive: true, // Default value
      },
      { transaction }
    );

    console.log(`Assignment created with ID: ${assignment.id}`);

    // Handle file uploads if any
    if (req.files && req.files.attachments) {
      console.log("Processing file attachments");

      let attachmentsArray = Array.isArray(req.files.attachments)
        ? req.files.attachments
        : [req.files.attachments];

      console.log(`Found ${attachmentsArray.length} attachments`);

      // Validate file types
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      for (const file of attachmentsArray) {
        console.log(
          `Validating file: ${file.name}, type: ${file.mimetype}, size: ${file.size}`
        );

        if (!allowedTypes.includes(file.mimetype)) {
          console.log(`Invalid file type: ${file.mimetype}`);
          await transaction.rollback();
          return next(
            new ErrorHandler(
              `Invalid file type. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX`,
              400
            )
          );
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.log(`File too large: ${file.size} bytes`);
          await transaction.rollback();
          return next(
            new ErrorHandler(`File too large. Maximum size allowed is 5MB`, 400)
          );
        }
      }

      // Upload attachments to S3
      try {
        console.log("Starting file uploads to S3");

        const uploadPromises = attachmentsArray.map((file) =>
          uploadFileToS3(file, "assignment-attachments")
        );

        const uploadedFiles = await Promise.all(uploadPromises);
        console.log(`Successfully uploaded ${uploadedFiles.length} files`);

        // Add attachments to assignment
        const attachmentPromises = uploadedFiles.map((file) =>
          AssignmentAttachment.create(
            {
              assignmentId: assignment.id,
              name: file.key.split("/").pop(), // Extract filename from key
              url: file.url,
            },
            { transaction }
          )
        );

        await Promise.all(attachmentPromises);
        console.log("Attachments added to assignment");
      } catch (uploadError) {
        console.error("Error uploading files:", uploadError);
        await transaction.rollback();
        return next(new ErrorHandler("Failed to upload files", 500));
      }
    }

    await transaction.commit();
    console.log("Transaction committed");

    // Retrieve the assignment with attachments
    const createdAssignment = await Assignment.findByPk(assignment.id, {
      include: [AssignmentAttachment],
    });

    res.status(201).json({
      success: true,
      message: "Assignment created successfully",
      assignment: createdAssignment,
    });
  } catch (error) {
    console.log(`Error in createAssignment: ${error.message}`);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Submit assignment (for students)
exports.submitAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("submitAssignment: Started");
  const transaction = await sequelize.transaction();

  try {
    const { assignmentId } = req.params;

    // Verify student permissions
    const student = await Student.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, attributes: ["name", "email"] }],
      transaction,
    });

    if (!student) {
      console.log("Student not found");
      await transaction.rollback();
      return next(new ErrorHandler("Student not found", 404));
    }
    console.log("Student found:", student.id);

    // Get the assignment
    const assignment = await Assignment.findByPk(assignmentId, { transaction });
    if (!assignment) {
      console.log("Assignment not found");
      await transaction.rollback();
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the student is enrolled in the course
    const studentCourse = await sequelize.models.StudentCourse.findOne({
      where: {
        studentId: student.id,
        courseId: assignment.courseId,
      },
      transaction,
    });

    if (!studentCourse) {
      console.log("Student not enrolled in course");
      await transaction.rollback();
      return next(new ErrorHandler("Not enrolled in this course", 403));
    }
    console.log("Student is enrolled in the course");

    // Check if the assignment is active
    if (!assignment.isActive) {
      console.log("Assignment not active");
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "This assignment is no longer accepting submissions",
          400
        )
      );
    }

    // Check if file is provided
    if (!req.files || !req.files.submissionFile) {
      console.log("No submission file provided");
      await transaction.rollback();
      return next(new ErrorHandler("Please upload your submission file", 400));
    }

    const submissionFile = req.files.submissionFile;
    console.log("Submission file details:", {
      name: submissionFile.name,
      size: submissionFile.size,
      mimetype: submissionFile.mimetype,
    });

    // Validate file type
    const validFileTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "image/jpeg",
      "image/png",
      "application/zip",
      "application/x-zip-compressed",
    ];

    if (!validFileTypes.includes(submissionFile.mimetype)) {
      console.log("Invalid file type:", submissionFile.mimetype);
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "Invalid file type. Please upload a valid document.",
          400
        )
      );
    }

    // Check if past due date
    const now = new Date();
    const isDueDatePassed = now > new Date(assignment.dueDate);
    console.log("Is submission late:", isDueDatePassed);

    try {
      // Upload submission to S3
      console.log("Attempting S3 upload");
      const uploadedFile = await uploadFileToS3(
        submissionFile,
        `assignment-submissions/${assignment.id}`
      );
      console.log("S3 upload successful:", uploadedFile.url);

      // Check if already submitted
      const existingSubmission = await Submission.findOne({
        where: {
          assignmentId: assignment.id,
          studentId: student.id,
        },
        transaction,
      });

      if (existingSubmission) {
        console.log("Updating existing submission");
        // Update existing submission
        existingSubmission.submissionFile = uploadedFile.url;
        existingSubmission.submissionDate = now;
        existingSubmission.status = "submitted";
        existingSubmission.isLate = isDueDatePassed;
        await existingSubmission.save({ transaction });
      } else {
        console.log("Creating new submission");
        // Create new submission
        await Submission.create(
          {
            assignmentId: assignment.id,
            studentId: student.id,
            submissionFile: uploadedFile.url,
            submissionDate: now,
            status: "submitted",
            isLate: isDueDatePassed,
          },
          { transaction }
        );
      }

      await transaction.commit();
      console.log("Transaction committed");

      res.json({
        success: true,
        message: "Assignment submitted successfully",
        isLate: isDueDatePassed,
      });
    } catch (uploadError) {
      console.log("Error during file upload:", uploadError.message);
      await transaction.rollback();
      throw new Error(`File upload failed: ${uploadError.message}`);
    }
  } catch (error) {
    console.log("Error in submitAssignment:", error.message);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Grade a submission (for teachers)
exports.gradeSubmission = catchAsyncErrors(async (req, res, next) => {
  console.log("gradeSubmission: Started");
  const transaction = await sequelize.transaction();

  try {
    const { assignmentId, submissionId } = req.params;

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      console.log("Teacher not found");
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }
    console.log("Teacher found:", teacher.id);

    // Get the assignment
    const assignment = await Assignment.findByPk(assignmentId, { transaction });
    if (!assignment) {
      console.log("Assignment not found");
      await transaction.rollback();
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the teacher owns the course
    const course = await Course.findOne({
      where: {
        id: assignment.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log("Teacher not authorized for this course");
      await transaction.rollback();
      return next(
        new ErrorHandler("Unauthorized to grade this assignment", 403)
      );
    }
    console.log("Teacher authorized for course:", course.id);

    const { grade, feedback } = req.body;
    console.log(
      `Grading with: ${grade} points, feedback: ${
        feedback ? "provided" : "not provided"
      }`
    );

    if (!grade || grade < 0 || grade > assignment.totalPoints) {
      console.log(
        `Invalid grade: ${grade}, total points: ${assignment.totalPoints}`
      );
      await transaction.rollback();
      return next(
        new ErrorHandler(
          `Grade must be between 0 and ${assignment.totalPoints}`,
          400
        )
      );
    }

    // Find the submission
    const submission = await Submission.findOne({
      where: {
        id: submissionId,
        assignmentId: assignment.id,
      },
      transaction,
    });

    if (!submission) {
      console.log(`Submission not found: ${submissionId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Submission not found", 404));
    }
    console.log("Submission found");

    // Update grade and feedback
    submission.grade = grade;
    submission.feedback = feedback;
    submission.status = "graded";
    await submission.save({ transaction });
    console.log("Submission updated with grade and feedback");

    await transaction.commit();
    console.log("Transaction committed");

    res.json({
      success: true,
      message: "Submission graded successfully",
      submission,
    });
  } catch (error) {
    console.log("Error in gradeSubmission:", error.message);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all assignments for a course
exports.getCourseAssignments = catchAsyncErrors(async (req, res, next) => {
  console.log("getCourseAssignments: Started");
  try {
    // Get the course ID from request parameters
    const { courseId } = req.params;
    console.log(`Fetching assignments for course: ${courseId}`);

    // Find the course
    const course = await Course.findByPk(courseId);
    if (!course) {
      console.log("Course not found");
      return next(new ErrorHandler("Course not found", 404));
    }
    console.log("Course found");

    // Verify that the user has access to this course
    if (req.user.role === "teacher") {
      console.log("Verifying teacher access");
      const teacher = await Teacher.findOne({ where: { userId: req.user.id } });
      if (!teacher || course.teacherId !== teacher.id) {
        console.log("Teacher not authorized for this course");
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Teacher authorized");
    } else if (req.user.role === "student") {
      console.log("Verifying student access");
      const student = await Student.findOne({ where: { userId: req.user.id } });

      const studentCourse = await sequelize.models.StudentCourse.findOne({
        where: {
          studentId: student.id,
          courseId: course.id,
        },
      });

      if (!student || !studentCourse) {
        console.log("Student not enrolled in this course");
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Student authorized");
    }

    // Find all assignments for this course
    console.log("Fetching assignments");
    const assignments = await Assignment.findAll({
      where: { courseId },
      include: [AssignmentAttachment],
      order: [["dueDate", "ASC"]],
    });

    console.log(`Found ${assignments.length} assignments`);

    // For students, include their submissions
    if (req.user.role === "student") {
      console.log("Fetching student submissions");
      const student = await Student.findOne({ where: { userId: req.user.id } });

      // Get submissions for this student for these assignments
      const assignmentIds = assignments.map((a) => a.id);
      const submissions = await Submission.findAll({
        where: {
          assignmentId: assignmentIds,
          studentId: student.id,
        },
      });

      // Create a mapping of assignmentId to submission
      const submissionMap = {};
      submissions.forEach((sub) => {
        submissionMap[sub.assignmentId] = sub;
      });

      // Add submission to each assignment
      assignments.forEach((assignment) => {
        assignment.dataValues.submission = submissionMap[assignment.id] || null;
      });

      console.log("Added student submissions to assignments");
    }

    res.status(200).json({
      success: true,
      assignments,
    });
  } catch (error) {
    console.log("Error in getCourseAssignments:", error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get a specific assignment by ID
exports.getAssignmentById = catchAsyncErrors(async (req, res, next) => {
  console.log("getAssignmentById: Started");
  try {
    const { assignmentId } = req.params;
    console.log(`Fetching assignment: ${assignmentId}`);

    // Find the assignment with associated info
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [
        AssignmentAttachment,
        {
          model: Course,
          attributes: ["id", "title"],
        },
      ],
    });

    if (!assignment) {
      console.log("Assignment not found");
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found");

    // Verify that the user has access to this assignment's course
    if (req.user.role === "teacher") {
      console.log("Verifying teacher access");
      const teacher = await Teacher.findOne({ where: { userId: req.user.id } });

      if (!teacher || assignment.Course.teacherId !== teacher.id) {
        console.log("Teacher not authorized for this course");
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Teacher authorized");

      // For teachers, include all submissions
      const submissions = await Submission.findAll({
        where: { assignmentId: assignment.id },
        include: [
          {
            model: Student,
            include: [
              {
                model: User,
                attributes: ["name", "email"],
              },
            ],
          },
        ],
      });

      assignment.dataValues.submissions = submissions;
    } else if (req.user.role === "student") {
      console.log("Verifying student access");
      const student = await Student.findOne({ where: { userId: req.user.id } });

      const studentCourse = await sequelize.models.StudentCourse.findOne({
        where: {
          studentId: student.id,
          courseId: assignment.courseId,
        },
      });

      if (!student || !studentCourse) {
        console.log("Student not enrolled in this course");
        return next(new ErrorHandler("Unauthorized access", 403));
      }
      console.log("Student authorized");

      // For students, include only their submission
      const submission = await Submission.findOne({
        where: {
          assignmentId: assignment.id,
          studentId: student.id,
        },
      });

      assignment.dataValues.submission = submission || null;
    }

    res.status(200).json({
      success: true,
      assignment,
    });
  } catch (error) {
    console.log("Error in getAssignmentById:", error.message);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update an assignment
exports.updateAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("updateAssignment: Started");
  const transaction = await sequelize.transaction();

  try {
    const { assignmentId } = req.params;
    console.log(`Updating assignment: ${assignmentId}`);

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      console.log("Teacher not found");
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }
    console.log("Teacher found:", teacher.id);

    // Get the assignment
    const assignment = await Assignment.findByPk(assignmentId, { transaction });
    if (!assignment) {
      console.log("Assignment not found");
      await transaction.rollback();
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the teacher owns the course
    const course = await Course.findOne({
      where: {
        id: assignment.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log("Teacher not authorized for this course");
      await transaction.rollback();
      return next(
        new ErrorHandler("Unauthorized to update this assignment", 403)
      );
    }
    console.log("Teacher authorized for course:", course.id);

    // Extract update fields
    const { title, description, dueDate, totalPoints, isActive } = req.body;

    // Update assignment fields if provided
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.description = description;
    if (dueDate) updateData.dueDate = dueDate;
    if (totalPoints) updateData.totalPoints = totalPoints;
    if (isActive !== undefined) updateData.isActive = isActive;

    // Update the assignment
    await assignment.update(updateData, { transaction });

    // Handle file uploads if any
    if (req.files && req.files.attachments) {
      console.log("Processing new file attachments");

      let attachmentsArray = Array.isArray(req.files.attachments)
        ? req.files.attachments
        : [req.files.attachments];

      console.log(`Found ${attachmentsArray.length} new attachments`);

      // Validate file types
      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/jpg",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      for (const file of attachmentsArray) {
        console.log(
          `Validating file: ${file.name}, type: ${file.mimetype}, size: ${file.size}`
        );

        if (!allowedTypes.includes(file.mimetype)) {
          console.log(`Invalid file type: ${file.mimetype}`);
          await transaction.rollback();
          return next(
            new ErrorHandler(
              `Invalid file type. Allowed types: PDF, JPEG, PNG, DOC, DOCX, XLS, XLSX`,
              400
            )
          );
        }

        // Validate file size (5MB)
        if (file.size > 5 * 1024 * 1024) {
          console.log(`File too large: ${file.size} bytes`);
          await transaction.rollback();
          return next(
            new ErrorHandler(`File too large. Maximum size allowed is 5MB`, 400)
          );
        }
      }

      // Upload new attachments to S3
      try {
        console.log("Starting file uploads to S3");

        const uploadPromises = attachmentsArray.map((file) =>
          uploadFileToS3(file, "assignment-attachments")
        );

        const uploadedFiles = await Promise.all(uploadPromises);
        console.log(`Successfully uploaded ${uploadedFiles.length} files`);

        // Handle attachment replacement options
        const { replaceAttachments } = req.body;

        if (replaceAttachments === "true") {
          // Delete existing attachments
          await AssignmentAttachment.destroy({
            where: { assignmentId: assignment.id },
            transaction,
          });
          console.log("Deleted existing attachments");
        }

        // Add new attachments
        const attachmentPromises = uploadedFiles.map((file) =>
          AssignmentAttachment.create(
            {
              assignmentId: assignment.id,
              name: file.key.split("/").pop(), // Extract filename from key
              url: file.url,
            },
            { transaction }
          )
        );

        await Promise.all(attachmentPromises);
        console.log("Added new attachments");
      } catch (uploadError) {
        console.error("Error uploading files:", uploadError);
        await transaction.rollback();
        return next(new ErrorHandler("Failed to upload files", 500));
      }
    }

    // Remove specific attachments if requested
    if (req.body.removeAttachments) {
      const attachmentsToRemove = Array.isArray(req.body.removeAttachments)
        ? req.body.removeAttachments
        : [req.body.removeAttachments];

      console.log(`Removing ${attachmentsToRemove.length} attachments`);

      await AssignmentAttachment.destroy({
        where: {
          id: attachmentsToRemove,
          assignmentId: assignment.id,
        },
        transaction,
      });

      console.log("Attachments removed");
    }

    await transaction.commit();
    console.log("Transaction committed");

    // Fetch the updated assignment with attachments
    const updatedAssignment = await Assignment.findByPk(assignment.id, {
      include: [AssignmentAttachment],
    });

    res.status(200).json({
      success: true,
      message: "Assignment updated successfully",
      assignment: updatedAssignment,
    });
  } catch (error) {
    console.log(`Error in updateAssignment: ${error.message}`);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete assignment
exports.deleteAssignment = catchAsyncErrors(async (req, res, next) => {
  console.log("deleteAssignment: Started");
  const transaction = await sequelize.transaction();

  try {
    const { assignmentId } = req.params;
    console.log(`Deleting assignment: ${assignmentId}`);

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      console.log("Teacher not found");
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }
    console.log("Teacher found:", teacher.id);

    // Get the assignment
    const assignment = await Assignment.findByPk(assignmentId, {
      include: [AssignmentAttachment],
      transaction,
    });

    if (!assignment) {
      console.log("Assignment not found");
      await transaction.rollback();
      return next(new ErrorHandler("Assignment not found", 404));
    }
    console.log("Assignment found:", assignment.id);

    // Check if the teacher owns the course
    const course = await Course.findOne({
      where: {
        id: assignment.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log("Teacher not authorized for this course");
      await transaction.rollback();
      return next(
        new ErrorHandler("Unauthorized to delete this assignment", 403)
      );
    }
    console.log("Teacher authorized for course:", course.id);

    // Delete the assignment (cascades to attachments and submissions due to FK constraints)
    await assignment.destroy({ transaction });
    console.log("Assignment deleted");

    await transaction.commit();
    console.log("Transaction committed");

    res.status(200).json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    console.log(`Error in deleteAssignment: ${error.message}`);

    if (transaction) {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});
