const { Sequelize } = require("sequelize");
require("dotenv").config();

// Ensure pg is explicitly required
let pg;
try {
  pg = require("pg");
  console.log("PostgreSQL driver loaded successfully");
} catch (error) {
  console.error("Failed to load PostgreSQL driver:", error.message);
  throw new Error(
    "PostgreSQL driver (pg) is not available. Please ensure it is properly installed."
  );
}

const sequelize = new Sequelize(
  process.env.POSTGRES_DB,
  process.env.POSTGRES_USER,
  process.env.POSTGRES_PASSWORD,
  {
    host: process.env.POSTGRES_HOST,
    port: process.env.POSTGRES_PORT || 5432,
    dialect: "postgres",
    dialectModule: pg, // Explicitly set the dialect module
    logging: process.env.NODE_ENV === "development" ? console.log : false,
    dialectOptions: {
      ssl:
        process.env.POSTGRES_SSL === "true"
          ? {
              require: true,
              rejectUnauthorized: false,
            }
          : false,
      // Add connection timeout for serverless
      connectTimeout: 60000,
      acquireTimeout: 60000,
      timeout: 60000,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
    // Add retry options for serverless environments
    retry: {
      match: [
        /ETIMEDOUT/,
        /EHOSTUNREACH/,
        /ECONNRESET/,
        /ECONNREFUSED/,
        /ETIMEDOUT/,
        /ESOCKETTIMEDOUT/,
        /EHOSTUNREACH/,
        /EPIPE/,
        /EAI_AGAIN/,
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
      ],
      max: 3,
    },
  }
);

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    console.log("PostgreSQL connected successfully");
  } catch (error) {
    console.error("PostgreSQL connection error:", error);

    // More detailed error logging for debugging
    if (error.original) {
      console.error("Original error:", error.original);
    }

    // Don't exit in serverless environments
    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.error("Database connection failed in serverless environment");
      throw error;
    } else {
      process.exit(1);
    }
  }
};

module.exports = { sequelize, connectDB };
