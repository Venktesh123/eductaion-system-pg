const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const EContentModule = sequelize.define(
  "EContentModule",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    eContentId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    moduleNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    moduleTitle: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = EContentModule;
