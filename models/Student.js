const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Student = sequelize.define(
  "Student",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
    teacherId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    teacherEmail: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    program: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    semester: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Student;
