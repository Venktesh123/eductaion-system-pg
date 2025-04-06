const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

// Junction table for many-to-many relationship between students and courses
const StudentCourse = sequelize.define(
  "StudentCourse",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    studentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    courseId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    enrollmentDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = StudentCourse;
