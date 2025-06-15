const {
  EContent,
  EContentModule,
  EContentFile,
  Course,
  Teacher,
  Student,
  sequelize,
} = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const { uploadFileToS3, deleteFileFromS3 } = require("../utils/azureUtils");

// Helper function to handle file uploads
const handleFileUploads = async (files, allowedTypes, next) => {
  console.log("Processing file uploads");

  let filesArray = Array.isArray(files) ? files : [files];
  console.log(`Found ${filesArray.length} files`);

  // Validate file types
  for (const file of filesArray) {
    console.log(
      `Validating file: ${file.name}, type: ${file.mimetype}, size: ${file.size}`
    );

    if (!allowedTypes.includes(file.mimetype)) {
      console.log(`Invalid file type: ${file.mimetype}`);
      throw new ErrorHandler(
        `Invalid file type. Allowed types: PDF, PPT, PPTX`,
        400
      );
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      console.log(`File too large: ${file.size} bytes`);
      throw new ErrorHandler(
        `File too large. Maximum size allowed is 10MB`,
        400
      );
    }
  }

  // Upload files to S3
  console.log("Starting file uploads to S3");
  const uploadPromises = filesArray.map((file) =>
    uploadFileToS3(file, "econtent-files")
  );

  const uploadedFiles = await Promise.all(uploadPromises);
  console.log(`Successfully uploaded ${uploadedFiles.length} files`);

  return { filesArray, uploadedFiles };
};

// Create file objects from uploaded files
const createFileObjects = (filesArray, uploadedFiles) => {
  const fileObjects = [];

  for (let i = 0; i < filesArray.length; i++) {
    const file = filesArray[i];
    const uploadedFile = uploadedFiles[i];
    const fileName = file.name;

    // Determine file type
    let fileType = "other";
    if (file.mimetype === "application/pdf") {
      fileType = "pdf";
    } else if (file.mimetype === "application/vnd.ms-powerpoint") {
      fileType = "ppt";
    } else if (
      file.mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      fileType = "pptx";
    }

    fileObjects.push({
      fileType,
      fileUrl: uploadedFile.url,
      fileKey: uploadedFile.key,
      fileName,
    });
  }

  return fileObjects;
};

// Create new EContent module
exports.createEContent = catchAsyncErrors(async (req, res, next) => {
  console.log("createEContent: Started");
  const transaction = await sequelize.transaction();

  try {
    const { moduleNumber, moduleTitle, link } = req.body;
    const { courseId } = req.params;

    console.log(`Creating EContent for course: ${courseId}`);

    // Validate inputs
    if (!moduleNumber || !moduleTitle) {
      console.log("Missing required fields");
      await transaction.rollback();
      return next(
        new ErrorHandler("Module number and title are required", 400)
      );
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

    // Find existing EContent document for this course or create new one
    let eContent = await EContent.findOne({
      where: { courseId },
      transaction,
    });

    if (!eContent) {
      console.log("Creating new EContent document");
      eContent = await EContent.create(
        {
          courseId,
        },
        { transaction }
      );
    } else {
      console.log("Found existing EContent document");
    }

    // Create new module
    const newModule = await EContentModule.create(
      {
        eContentId: eContent.id,
        moduleNumber,
        moduleTitle,
        link: link || "", // Default empty string if not provided
      },
      { transaction }
    );

    console.log(`E-content module created with ID: ${newModule.id}`);

    // Handle file uploads if any
    if (req.files && req.files.files) {
      try {
        const allowedTypes = [
          "application/pdf",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ];

        const { filesArray, uploadedFiles } = await handleFileUploads(
          req.files.files,
          allowedTypes
        );

        const fileObjects = createFileObjects(filesArray, uploadedFiles);

        // Add files to the new module
        for (const fileObj of fileObjects) {
          await EContentFile.create(
            {
              moduleId: newModule.id,
              ...fileObj,
              uploadDate: new Date(),
            },
            { transaction }
          );
        }

        console.log("Files added to new module");
      } catch (uploadError) {
        console.error("Error handling file uploads:", uploadError);
        await transaction.rollback();
        return next(
          new ErrorHandler(
            uploadError.message || "Failed to upload files",
            uploadError.statusCode || 500
          )
        );
      }
    }

    await transaction.commit();
    console.log("Transaction committed");

    // Get the complete EContent with the new module and files
    const createdModule = await EContentModule.findByPk(newModule.id, {
      include: [EContentFile],
    });

    res.status(201).json({
      success: true,
      message: "EContent module created successfully",
      courseId: courseId,
      module: createdModule,
    });
  } catch (error) {
    console.log(`Error in createEContent: ${error.message}`);

    if (transaction.finished !== "commit") {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Get EContent for a course
exports.getEContentByCourse = catchAsyncErrors(async (req, res, next) => {
  console.log("getEContentByCourse: Started");
  const { courseId } = req.params;

  try {
    console.log(`Fetching EContent for course: ${courseId}`);

    // Check if course exists
    const course = await Course.findByPk(courseId);
    if (!course) {
      console.log(`Course not found: ${courseId}`);
      return next(new ErrorHandler("Course not found", 404));
    }

    // If user is a teacher, verify they own the course
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({
        where: { userId: req.user.id },
      });

      if (!teacher || course.teacherId !== teacher.id) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }
    }
    // If user is a student, verify they're enrolled in the course
    else if (req.user.role === "student") {
      const student = await Student.findOne({
        where: { userId: req.user.id },
      });

      if (!student) {
        return next(new ErrorHandler("Student not found", 404));
      }

      const enrollment = await sequelize.models.StudentCourse.findOne({
        where: {
          studentId: student.id,
          courseId,
        },
      });

      if (!enrollment) {
        return next(new ErrorHandler("Not enrolled in this course", 403));
      }
    }

    // Find EContent with modules and files
    const eContent = await EContent.findOne({
      where: { courseId },
      include: [
        {
          model: EContentModule,
          include: [EContentFile],
        },
      ],
    });

    if (!eContent) {
      console.log(`No EContent found for course: ${courseId}`);
      // Return empty structure instead of error
      return res.status(200).json({
        success: true,
        courseId: courseId,
        eContent: {
          id: null,
          courseId,
          modules: [],
        },
      });
    }

    res.status(200).json({
      success: true,
      courseId: courseId,
      eContent,
    });
  } catch (error) {
    console.log(`Error in getEContentByCourse: ${error.message}`);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get specific module by ID
exports.getModuleById = catchAsyncErrors(async (req, res, next) => {
  console.log("getModuleById: Started");
  const { courseId, moduleId } = req.params;

  try {
    console.log(`Fetching module ${moduleId} for course: ${courseId}`);

    // Check course access
    const course = await Course.findByPk(courseId);
    if (!course) {
      return next(new ErrorHandler("Course not found", 404));
    }

    // Verify access rights
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({
        where: { userId: req.user.id },
      });

      if (!teacher || course.teacherId !== teacher.id) {
        return next(new ErrorHandler("Unauthorized access", 403));
      }
    } else if (req.user.role === "student") {
      const student = await Student.findOne({
        where: { userId: req.user.id },
      });

      if (!student) {
        return next(new ErrorHandler("Student not found", 404));
      }

      const enrollment = await sequelize.models.StudentCourse.findOne({
        where: {
          studentId: student.id,
          courseId,
        },
      });

      if (!enrollment) {
        return next(new ErrorHandler("Not enrolled in this course", 403));
      }
    }

    // Find EContent for this course
    const eContent = await EContent.findOne({
      where: { courseId },
    });

    if (!eContent) {
      console.log(`No EContent found for course: ${courseId}`);
      return next(new ErrorHandler("No EContent found for this course", 404));
    }

    // Find specific module
    const module = await EContentModule.findOne({
      where: {
        id: moduleId,
        eContentId: eContent.id,
      },
      include: [EContentFile],
    });

    if (!module) {
      console.log(`Module not found: ${moduleId}`);
      return next(new ErrorHandler("Module not found", 404));
    }

    res.status(200).json({
      success: true,
      courseId: courseId,
      moduleId: moduleId,
      module,
    });
  } catch (error) {
    console.log(`Error in getModuleById: ${error.message}`);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update module
exports.updateModule = catchAsyncErrors(async (req, res, next) => {
  console.log("updateModule: Started");
  const transaction = await sequelize.transaction();

  try {
    const { moduleNumber, moduleTitle, link } = req.body;
    const { courseId, moduleId } = req.params;

    console.log(`Updating module ${moduleId} for course: ${courseId}`);

    // Check course access
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
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Find EContent for this course
    const eContent = await EContent.findOne({
      where: { courseId },
      transaction,
    });

    if (!eContent) {
      console.log(`No EContent found for course: ${courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("No EContent found for this course", 404));
    }

    // Find specific module
    const module = await EContentModule.findOne({
      where: {
        id: moduleId,
        eContentId: eContent.id,
      },
      transaction,
    });

    if (!module) {
      console.log(`Module not found: ${moduleId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Module not found", 404));
    }

    // Update module details
    const updateData = {};
    if (moduleNumber) updateData.moduleNumber = moduleNumber;
    if (moduleTitle) updateData.moduleTitle = moduleTitle;
    if (link !== undefined) updateData.link = link;

    await module.update(updateData, { transaction });

    // Handle file uploads if any
    if (req.files && req.files.files) {
      try {
        const allowedTypes = [
          "application/pdf",
          "application/vnd.ms-powerpoint",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        ];

        const { filesArray, uploadedFiles } = await handleFileUploads(
          req.files.files,
          allowedTypes
        );

        const fileObjects = createFileObjects(filesArray, uploadedFiles);

        // Add files to the module
        for (const fileObj of fileObjects) {
          await EContentFile.create(
            {
              moduleId: module.id,
              ...fileObj,
              uploadDate: new Date(),
            },
            { transaction }
          );
        }

        console.log("New files added to module");
      } catch (uploadError) {
        console.error("Error handling file uploads:", uploadError);
        await transaction.rollback();
        return next(
          new ErrorHandler(
            uploadError.message || "Failed to upload files",
            uploadError.statusCode || 500
          )
        );
      }
    }

    await transaction.commit();
    console.log("Transaction committed");

    // Get the updated module with files
    const updatedModule = await EContentModule.findByPk(module.id, {
      include: [EContentFile],
    });

    res.status(200).json({
      success: true,
      message: "Module updated successfully",
      courseId: courseId,
      moduleId: moduleId,
      module: updatedModule,
    });
  } catch (error) {
    console.log(`Error in updateModule: ${error.message}`);

    if (transaction.finished !== "commit") {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete module
exports.deleteModule = catchAsyncErrors(async (req, res, next) => {
  console.log("deleteModule: Started");
  const transaction = await sequelize.transaction();

  try {
    const { courseId, moduleId } = req.params;

    console.log(`Deleting module ${moduleId} for course: ${courseId}`);

    // Check course access
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
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Find EContent for this course
    const eContent = await EContent.findOne({
      where: { courseId },
      transaction,
    });

    if (!eContent) {
      console.log(`No EContent found for course: ${courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("No EContent found for this course", 404));
    }

    // Find specific module with its files
    const module = await EContentModule.findOne({
      where: {
        id: moduleId,
        eContentId: eContent.id,
      },
      include: [EContentFile],
      transaction,
    });

    if (!module) {
      console.log(`Module not found: ${moduleId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Module not found", 404));
    }

    // Delete all module files from S3 if there are any
    if (module.EContentFiles && module.EContentFiles.length > 0) {
      console.log(`Deleting ${module.EContentFiles.length} files from S3`);

      try {
        const deletePromises = module.EContentFiles.map((file) =>
          deleteFileFromS3(file.fileKey)
        );

        await Promise.all(deletePromises);
        console.log("All files deleted from S3");
      } catch (s3Error) {
        console.error("Error deleting files from S3:", s3Error);
        // Continue with the database deletion even if S3 deletion fails
      }
    }

    // Delete the module (will cascade delete files due to foreign key constraints)
    await module.destroy({ transaction });
    console.log("Module removed");

    await transaction.commit();
    console.log("Transaction committed");

    res.status(200).json({
      success: true,
      message: "Module deleted successfully",
      courseId: courseId,
      moduleId: moduleId,
    });
  } catch (error) {
    console.log(`Error in deleteModule: ${error.message}`);

    if (transaction.finished !== "commit") {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete file from module
exports.deleteFile = catchAsyncErrors(async (req, res, next) => {
  console.log("deleteFile: Started");
  const transaction = await sequelize.transaction();

  try {
    const { courseId, moduleId, fileId } = req.params;

    console.log(
      `Deleting file ${fileId} from module ${moduleId} for course: ${courseId}`
    );

    // Check course access
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
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Find EContent
    const eContent = await EContent.findOne({
      where: { courseId },
      transaction,
    });

    if (!eContent) {
      console.log(`No EContent found for course: ${courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("No EContent found for this course", 404));
    }

    // Find specific module
    const module = await EContentModule.findOne({
      where: {
        id: moduleId,
        eContentId: eContent.id,
      },
      transaction,
    });

    if (!module) {
      console.log(`Module not found: ${moduleId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Module not found", 404));
    }

    // Find the file
    const file = await EContentFile.findOne({
      where: {
        id: fileId,
        moduleId: module.id,
      },
      transaction,
    });

    if (!file) {
      console.log(`File not found: ${fileId}`);
      await transaction.rollback();
      return next(new ErrorHandler("File not found", 404));
    }

    // Delete from S3
    try {
      console.log(`Deleting file from S3: ${file.fileKey}`);
      await deleteFileFromS3(file.fileKey);
      console.log("File deleted from S3");
    } catch (s3Error) {
      console.error("Error deleting file from S3:", s3Error);
      // Continue with the database deletion even if S3 deletion fails
    }

    // Delete file from database
    await file.destroy({ transaction });
    console.log("File removed from module");

    await transaction.commit();
    console.log("Transaction committed");

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
      courseId: courseId,
      moduleId: moduleId,
      fileId: fileId,
    });
  } catch (error) {
    console.log(`Error in deleteFile: ${error.message}`);

    if (transaction.finished !== "commit") {
      await transaction.rollback();
    }

    return next(new ErrorHandler(error.message, 500));
  }
});

module.exports = exports;
