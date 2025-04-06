const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Course = sequelize.define(
  "Course",
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
    aboutCourse: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    semesterId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    teacherId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Course;
