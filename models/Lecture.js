const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Lecture = sequelize.define(
  "Lecture",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    videoUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    videoKey: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    courseId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    isReviewed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    reviewDeadline: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: () => {
        // Set default review deadline to 7 days from creation
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 7);
        return deadline;
      },
    },
  },
  {
    timestamps: true,
    hooks: {
      beforeSave: (lecture) => {
        // Auto-mark as reviewed if deadline has passed
        if (
          !lecture.isReviewed &&
          lecture.reviewDeadline &&
          new Date() >= lecture.reviewDeadline
        ) {
          lecture.isReviewed = true;
        }
      },
    },
  }
);

module.exports = Lecture;
