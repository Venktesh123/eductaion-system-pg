const { Sequelize } = require("sequelize");
const pg = require("pg"); // Add this import
require("dotenv").config();

const sequelize = new Sequelize(
  process.env.POSTGRES_DB,
  process.env.POSTGRES_USER,
  process.env.POSTGRES_PASSWORD,
  {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT || 5432,
    dialect: "postgres",
    dialectModule: pg, // Add this line - explicitly specify the pg module
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    dialectOptions: {
      ssl:
        process.env.POSTGRES_SSL === "true"
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected successfully");
  } catch (error) {
    console.error("PostgreSQL connection error:", error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
