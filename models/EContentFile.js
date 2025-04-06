const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EContentFile = sequelize.define(
  "EContentFile",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    moduleId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    fileType: {
      type: DataTypes.ENUM("pdf", "ppt", "pptx", "other"),
      allowNull: false,
    },
    fileUrl: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fileKey: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    fileName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    uploadDate: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = EContentFile;
