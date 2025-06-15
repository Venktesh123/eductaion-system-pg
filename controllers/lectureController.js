const {
  Course,
  Teacher,
  Student,
  Lecture,
  User,
  sequelize,
} = require("../models");
const { ErrorHandler } = require("../middleware/errorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const {
  uploadFileToAzure,
  deleteFileFromAzure,
} = require("../utils/azureUtils");

// Create a new lecture
const createLecture = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    console.log(
      `Creating lecture for course ID: ${
        req.params.courseId || req.body.courseId
      }`
    );

    // Get course ID
    const courseId = req.params.courseId || req.body.courseId;
    if (!courseId) {
      await transaction.rollback();
      return next(new ErrorHandler("Course ID is required", 400));
    }

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      console.log(`Teacher not found for user ID: ${req.user.id}`);
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Get the course and verify ownership
    const course = await Course.findOne({
      where: {
        id: courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log(`Course not found with ID: ${courseId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Create lecture data object
    let lectureData = {
      title: req.body.title,
      content: req.body.content || null,
      courseId: course.id,
      isReviewed: req.body.isReviewed || false,
    };

    // Add review deadline if provided
    if (req.body.reviewDeadline) {
      lectureData.reviewDeadline = new Date(req.body.reviewDeadline);
    }

    // Handle video file upload if provided
    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        return next(new ErrorHandler("Uploaded file must be a video", 400));
      }

      try {
        // Upload to Azure
        const uploadPath = `courses/${course.id}/lectures`;
        const uploadResult = await uploadFileToAzure(videoFile, uploadPath);

        lectureData.videoUrl = uploadResult.url;
        lectureData.videoKey = uploadResult.key;
      } catch (uploadError) {
        console.error("Error uploading video:", uploadError);
        await transaction.rollback();
        return next(new ErrorHandler("Failed to upload video", 500));
      }
    } else if (req.body.videoUrl) {
      // If video URL is provided directly (e.g., external URL)
      lectureData.videoUrl = req.body.videoUrl;
    }

    // Create the lecture
    const lecture = await Lecture.create(lectureData, { transaction });

    await transaction.commit();

    console.log(`Created lecture ID: ${lecture.id}`);
    res.status(201).json({
      success: true,
      message: "Lecture created successfully",
      lecture,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in createLecture:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update an existing lecture
const updateLecture = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const lectureId = req.params.lectureId || req.params.id;
    console.log(`Updating lecture ID: ${lectureId}`);

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      console.log(`Teacher not found for user ID: ${req.user.id}`);
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find lecture
    const lecture = await Lecture.findByPk(lectureId, { transaction });
    if (!lecture) {
      console.log(`Lecture not found with ID: ${lectureId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Verify course belongs to teacher
    const course = await Course.findOne({
      where: {
        id: lecture.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log(
        `Teacher does not have access to course for lecture: ${lectureId}`
      );
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "You don't have permission to update this lecture",
          403
        )
      );
    }

    // Create update data object
    const updateData = {};
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.content !== undefined) updateData.content = req.body.content;
    if (req.body.isReviewed !== undefined)
      updateData.isReviewed = req.body.isReviewed;
    if (req.body.reviewDeadline)
      updateData.reviewDeadline = new Date(req.body.reviewDeadline);

    // Handle video file update if provided
    if (req.files && req.files.video) {
      const videoFile = req.files.video;

      // Validate file type
      if (!videoFile.mimetype.startsWith("video/")) {
        await transaction.rollback();
        return next(new ErrorHandler("Uploaded file must be a video", 400));
      }

      try {
        // Delete old video from Azure if it exists
        if (lecture.videoKey) {
          await deleteFileFromAzure(lecture.videoKey);
        }

        // Upload new video to Azure
        const uploadPath = `courses/${course.id}/lectures`;
        const uploadResult = await uploadFileToAzure(videoFile, uploadPath);

        updateData.videoUrl = uploadResult.url;
        updateData.videoKey = uploadResult.key;
      } catch (uploadError) {
        console.error("Error handling video file:", uploadError);
        await transaction.rollback();
        return next(new ErrorHandler("Failed to update video file", 500));
      }
    } else if (req.body.videoUrl !== undefined) {
      // If video URL is provided directly (e.g., external URL)
      updateData.videoUrl = req.body.videoUrl;
    }

    // Update lecture
    await lecture.update(updateData, { transaction });

    await transaction.commit();

    console.log(`Updated lecture ID: ${lecture.id}`);

    // Get the updated lecture
    const updatedLecture = await Lecture.findByPk(lecture.id);

    res.json({
      success: true,
      message: "Lecture updated successfully",
      lecture: updatedLecture,
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateLecture:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all lectures for a course (teacher view)
const getCourseLectures = catchAsyncErrors(async (req, res, next) => {
  try {
    console.log(`Fetching lectures for course ID: ${req.params.courseId}`);

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
    });

    if (!teacher) {
      console.log(`Teacher not found for user ID: ${req.user.id}`);
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Verify course belongs to teacher
    const course = await Course.findOne({
      where: {
        id: req.params.courseId,
        teacherId: teacher.id,
      },
    });

    if (!course) {
      console.log(`Course not found with ID: ${req.params.courseId}`);
      return next(new ErrorHandler("Course not found or unauthorized", 404));
    }

    // Get lectures for this course
    const lectures = await Lecture.findAll({
      where: { courseId: course.id },
      order: [["createdAt", "ASC"]],
    });

    // Check if review deadlines have passed
    const now = new Date();
    for (const lecture of lectures) {
      if (
        !lecture.isReviewed &&
        lecture.reviewDeadline &&
        now >= lecture.reviewDeadline
      ) {
        await lecture.update({ isReviewed: true });
      }
    }

    console.log(`Found ${lectures.length} lectures for course: ${course.id}`);
    res.json({
      success: true,
      courseId: course.id,
      courseTitle: course.title,
      lectures,
    });
  } catch (error) {
    console.error("Error in getCourseLectures:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get all lectures for a course (student view)
const getCourseLecturesByStudents = catchAsyncErrors(async (req, res, next) => {
  try {
    console.log(
      `Student fetching lectures for course ID: ${req.params.courseId}`
    );

    // Verify student permissions
    const student = await Student.findOne({
      where: { userId: req.user.id },
    });

    if (!student) {
      console.log(`Student not found for user ID: ${req.user.id}`);
      return next(new ErrorHandler("Student not found", 404));
    }

    // Verify student is enrolled in the course
    const enrollment = await sequelize.models.StudentCourse.findOne({
      where: {
        studentId: student.id,
        courseId: req.params.courseId,
      },
    });

    if (!enrollment) {
      console.log(
        `Student is not enrolled in course with ID: ${req.params.courseId}`
      );
      return next(new ErrorHandler("You are not enrolled in this course", 403));
    }

    // Get lectures that are reviewed (students can only see reviewed lectures)
    const lectures = await Lecture.findAll({
      where: {
        courseId: req.params.courseId,
        isReviewed: true,
      },
      attributes: [
        "id",
        "title",
        "content",
        "videoUrl",
        "createdAt",
        "updatedAt",
      ],
      order: [["createdAt", "ASC"]],
    });

    console.log(`Found ${lectures.length} reviewed lectures for student`);
    res.json({
      success: true,
      courseId: req.params.courseId,
      lectures,
    });
  } catch (error) {
    console.error("Error in getCourseLecturesByStudents:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Get a specific lecture
const getLectureById = catchAsyncErrors(async (req, res, next) => {
  try {
    const lectureId = req.params.lectureId || req.params.id;
    console.log(`Fetching lecture ID: ${lectureId}`);

    // Get the lecture
    const lecture = await Lecture.findByPk(lectureId, {
      include: [
        {
          model: Course,
          attributes: ["id", "title", "teacherId"],
        },
      ],
    });

    if (!lecture) {
      console.log(`Lecture not found with ID: ${lectureId}`);
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Verify permissions based on role
    if (req.user.role === "teacher") {
      const teacher = await Teacher.findOne({
        where: { userId: req.user.id },
      });

      if (!teacher || lecture.Course.teacherId !== teacher.id) {
        console.log(`Teacher does not have access to lecture: ${lectureId}`);
        return next(
          new ErrorHandler(
            "You don't have permission to view this lecture",
            403
          )
        );
      }
    } else if (req.user.role === "student") {
      const student = await Student.findOne({
        where: { userId: req.user.id },
      });

      if (!student) {
        return next(new ErrorHandler("Student not found", 404));
      }

      // Verify student is enrolled in the course
      const enrollment = await sequelize.models.StudentCourse.findOne({
        where: {
          studentId: student.id,
          courseId: lecture.courseId,
        },
      });

      if (!enrollment) {
        console.log(
          `Student is not enrolled in course for lecture: ${lectureId}`
        );
        return next(
          new ErrorHandler(
            "You don't have permission to view this lecture",
            403
          )
        );
      }

      // Students can only see reviewed lectures
      if (!lecture.isReviewed) {
        console.log(
          `Lecture ${lectureId} is not yet reviewed and cannot be viewed by students`
        );
        return next(
          new ErrorHandler("This lecture is not yet available for viewing", 403)
        );
      }
    }

    // Check if review deadline has passed
    const now = new Date();
    if (
      !lecture.isReviewed &&
      lecture.reviewDeadline &&
      now >= lecture.reviewDeadline
    ) {
      await lecture.update({ isReviewed: true });
    }

    res.json({
      success: true,
      lecture,
    });
  } catch (error) {
    console.error("Error in getLectureById:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Delete a lecture
const deleteLecture = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    console.log(`Deleting lecture ID: ${req.params.lectureId}`);

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      console.log(`Teacher not found for user ID: ${req.user.id}`);
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find lecture
    const lecture = await Lecture.findByPk(req.params.lectureId, {
      transaction,
    });
    if (!lecture) {
      console.log(`Lecture not found with ID: ${req.params.lectureId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Verify course belongs to teacher
    const course = await Course.findOne({
      where: {
        id: lecture.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log(
        `Teacher does not have access to course for lecture: ${req.params.lectureId}`
      );
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "You don't have permission to delete this lecture",
          403
        )
      );
    }

    // Delete video from Azure if it exists
    if (lecture.videoKey) {
      try {
        await deleteFileFromAzure(lecture.videoKey);
        console.log(`Deleted video from Azure: ${lecture.videoKey}`);
      } catch (deleteError) {
        console.error("Error deleting video file:", deleteError);
        // Continue with lecture deletion even if Azure delete fails
      }
    }

    // Delete the lecture
    await lecture.destroy({ transaction });

    await transaction.commit();

    console.log(`Deleted lecture ID: ${req.params.lectureId}`);
    res.json({
      success: true,
      message: "Lecture deleted successfully",
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in deleteLecture:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

// Update review status for all lectures in a course
const updateAllLectureReviewStatuses = catchAsyncErrors(
  async (req, res, next) => {
    try {
      console.log(
        `Updating review status for all lectures in course ID: ${req.params.courseId}`
      );

      // Verify teacher permissions
      const teacher = await Teacher.findOne({
        where: { userId: req.user.id },
      });

      if (!teacher) {
        console.log(`Teacher not found for user ID: ${req.user.id}`);
        return next(new ErrorHandler("Teacher not found", 404));
      }

      // Verify course belongs to teacher
      const course = await Course.findOne({
        where: {
          id: req.params.courseId,
          teacherId: teacher.id,
        },
      });

      if (!course) {
        console.log(`Course not found with ID: ${req.params.courseId}`);
        return next(new ErrorHandler("Course not found or unauthorized", 404));
      }

      // Update all lectures with passed review deadlines
      const now = new Date();
      const [updatedCount] = await Lecture.update(
        { isReviewed: true },
        {
          where: {
            courseId: course.id,
            isReviewed: false,
            reviewDeadline: { [sequelize.Op.lte]: now },
          },
        }
      );

      console.log(`Updated ${updatedCount} lectures to reviewed status`);
      res.json({
        success: true,
        message: `${updatedCount} lectures were marked as reviewed automatically`,
        updatedCount,
      });
    } catch (error) {
      console.error("Error in updateAllLectureReviewStatuses:", error);
      return next(new ErrorHandler(error.message, 500));
    }
  }
);

// Update review status for a specific lecture
const updateLectureReviewStatus = catchAsyncErrors(async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    console.log(
      `Updating review status for lecture ID: ${req.params.lectureId}`
    );

    // Verify teacher permissions
    const teacher = await Teacher.findOne({
      where: { userId: req.user.id },
      transaction,
    });

    if (!teacher) {
      console.log(`Teacher not found for user ID: ${req.user.id}`);
      await transaction.rollback();
      return next(new ErrorHandler("Teacher not found", 404));
    }

    // Find lecture
    const lecture = await Lecture.findByPk(req.params.lectureId, {
      transaction,
    });
    if (!lecture) {
      console.log(`Lecture not found with ID: ${req.params.lectureId}`);
      await transaction.rollback();
      return next(new ErrorHandler("Lecture not found", 404));
    }

    // Verify course belongs to teacher
    const course = await Course.findOne({
      where: {
        id: lecture.courseId,
        teacherId: teacher.id,
      },
      transaction,
    });

    if (!course) {
      console.log(
        `Teacher does not have access to course for lecture: ${req.params.lectureId}`
      );
      await transaction.rollback();
      return next(
        new ErrorHandler(
          "You don't have permission to update this lecture",
          403
        )
      );
    }

    // Update review status
    const updateData = {
      isReviewed: req.body.isReviewed,
    };

    // Update review deadline if provided
    if (req.body.reviewDeadline) {
      updateData.reviewDeadline = new Date(req.body.reviewDeadline);
    }

    await lecture.update(updateData, { transaction });

    await transaction.commit();

    console.log(`Updated review status for lecture ID: ${lecture.id}`);
    res.json({
      success: true,
      message: "Lecture review status updated successfully",
      lecture: await Lecture.findByPk(lecture.id),
    });
  } catch (error) {
    await transaction.rollback();
    console.error("Error in updateLectureReviewStatus:", error);
    return next(new ErrorHandler(error.message, 500));
  }
});

module.exports = {
  createLecture,
  updateLecture,
  getCourseLectures,
  getLectureById,
  deleteLecture,
  updateLectureReviewStatus,
  updateAllLectureReviewStatuses,
  getCourseLecturesByStudents,
};
