const { Sequelize } = require("sequelize");
require("dotenv").config();

// Function to create database URL
const getDatabaseUrl = () => {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const user = process.env.POSTGRES_USER;
  const password = process.env.POSTGRES_PASSWORD;
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || 5432;
  const database = process.env.POSTGRES_DB;

  return `postgres://${user}:${password}@${host}:${port}/${database}`;
};

// Create Sequelize instance
let sequelize;

try {
  if (process.env.DATABASE_URL || process.env.POSTGRES_HOST) {
    // Use connection string for production/Vercel
    const databaseUrl = getDatabaseUrl();

    sequelize = new Sequelize(databaseUrl, {
      dialect: "postgres",
      dialectModule: require("pg"),
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
    });
  } else {
    // Fallback for local development
    sequelize = new Sequelize(
      process.env.POSTGRES_DB,
      process.env.POSTGRES_USER,
      process.env.POSTGRES_PASSWORD,
      {
        host: process.env.POSTGRES_HOST,
        port: process.env.POSTGRES_PORT || 5432,
        dialect: "postgres",
        logging: process.env.NODE_ENV === "development" ? console.log : false,
        pool: {
          max: 5,
          min: 0,
          acquire: 30000,
          idle: 10000,
        },
      }
    );
  }
} catch (error) {
  console.error("Error creating Sequelize instance:", error);
  throw error;
}

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected successfully");
  } catch (error) {
    console.error("PostgreSQL connection error:", error);
    // Don't exit process in production
    if (process.env.NODE_ENV !== "production") {
      process.exit(1);
    }
    throw error;
  }
};

module.exports = { sequelize, connectDB };
