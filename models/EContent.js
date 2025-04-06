const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EContent = sequelize.define(
  "EContent",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    courseId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = EContent;
