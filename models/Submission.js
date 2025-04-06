const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Submission = sequelize.define(
  "Submission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assignmentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    submissionDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
    submissionFile: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    grade: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    feedback: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("submitted", "graded", "returned"),
      defaultValue: "submitted",
    },
    isLate: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Submission;
