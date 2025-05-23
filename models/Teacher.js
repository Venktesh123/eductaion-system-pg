const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const Teacher = sequelize.define(
  "Teacher",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
      },
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Teacher;
