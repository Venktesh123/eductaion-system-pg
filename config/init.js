const { sequelize } = require("./database");
const bcrypt = require("bcryptjs");
const { User, Teacher } = require("../models");

const initializeDatabase = async () => {
  try {
    // Sync all models with database (create tables)
    await sequelize.sync({ force: process.env.DB_FORCE_SYNC === "true" });
    console.log("Database tables created successfully.");

    // Check if admin user already exists
    const adminExists = await User.findOne({
      where: { email: process.env.ADMIN_EMAIL || "admin@example.com" },
    });

    if (!adminExists && !process.env.SKIP_ADMIN_CREATION) {
      console.log("Creating admin user...");

      // Create admin user
      const adminUser = await User.create({
        name: "Admin User",
        email: process.env.ADMIN_EMAIL || "admin@example.com",
        password: await bcrypt.hash(
          process.env.ADMIN_PASSWORD || "admin123",
          10
        ),
        role: "admin",
      });

      console.log(`Admin user created with ID: ${adminUser.id}`);
    }

    console.log("Database initialization completed.");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
};

module.exports = { initializeDatabase };
