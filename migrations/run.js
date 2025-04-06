require("dotenv").config();
const { Sequelize } = require("sequelize");
const { exec } = require("child_process");
const path = require("path");
const fs = require("fs");

// Get the Sequelize CLI command
const sequelizePath = path.resolve("node_modules", ".bin", "sequelize");

// Run migration command based on arguments
const runMigrations = () => {
  // Check if there are migrations in the migrations folder
  const migrationsFolder = path.join(__dirname);
  const migrationFiles = fs
    .readdirSync(migrationsFolder)
    .filter((file) => file.endsWith(".js") && file !== "run.js");

  if (migrationFiles.length === 0) {
    console.log("No migration files found. Creating initial migration...");

    // Create initial migration
    exec(
      `${sequelizePath} migration:generate --name init`,
      (error, stdout, stderr) => {
        if (error) {
          console.error(`Error creating migration: ${error.message}`);
          return;
        }

        console.log(stdout);
        console.log("Initial migration created. Running migrations...");

        // Run migrations
        runSequelizeCommand();
      }
    );
  } else {
    // Run migrations directly
    runSequelizeCommand();
  }
};

const runSequelizeCommand = () => {
  const command = process.argv[2] || "migrate";

  let sequelizeCommand;
  switch (command) {
    case "migrate":
      sequelizeCommand = "db:migrate";
      break;
    case "undo":
      sequelizeCommand = "db:migrate:undo";
      break;
    case "undo:all":
      sequelizeCommand = "db:migrate:undo:all";
      break;
    case "status":
      sequelizeCommand = "db:migrate:status";
      break;
    case "create":
      const name = process.argv[3];
      if (!name) {
        console.error("Migration name is required for create command");
        process.exit(1);
      }
      sequelizeCommand = `migration:generate --name ${name}`;
      break;
    default:
      console.error(`Unknown command: ${command}`);
      process.exit(1);
  }

  exec(`${sequelizePath} ${sequelizeCommand}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error: ${error.message}`);
      return;
    }

    console.log(stdout);
    console.log("Migration command completed successfully.");
  });
};

runMigrations();
