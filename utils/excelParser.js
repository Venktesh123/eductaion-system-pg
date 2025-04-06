const XLSX = require("xlsx");
const { validateUserData } = require("./validation");

/**
 * Parse an Excel file from a buffer
 * @param {Buffer} buffer - Excel file buffer
 * @returns {Promise<Array>} - Array of validated data objects
 */
const parseExcelBuffer = async (buffer) => {
  try {
    // Read workbook from buffer
    const workbook = XLSX.read(buffer, {
      type: "buffer",
      cellDates: true,
      cellNF: false,
      cellText: false,
    });

    // Verify we have at least one sheet
    if (!workbook.SheetNames.length) {
      throw new Error("Excel file is empty or invalid");
    }

    // Get first sheet
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(firstSheet);

    if (!data || !data.length) {
      throw new Error("No data found in Excel file");
    }

    // Validate and transform each row
    const validatedRows = [];
    const errors = [];

    for (const row of data) {
      try {
        // Basic validation
        if (!row.name || !row.email || !row.password || !row.role) {
          throw new Error(
            `Missing required fields in row: ${JSON.stringify(row)}`
          );
        }

        if (!["teacher", "student", "admin"].includes(row.role)) {
          throw new Error(`Invalid role "${row.role}" for user ${row.email}`);
        }

        if (row.role === "student" && !row.teacherEmail) {
          throw new Error(`Missing teacherEmail for student: ${row.email}`);
        }

        // Use Joi validation
        const validatedData = await validateUserData(row);
        if (validatedData) {
          validatedRows.push({
            name: validatedData.name,
            email: validatedData.email.toLowerCase(),
            password: validatedData.password,
            role: validatedData.role,
            teacherEmail: validatedData.teacherEmail
              ? validatedData.teacherEmail.toLowerCase()
              : undefined,
          });
        } else {
          errors.push(`Validation failed for row: ${JSON.stringify(row)}`);
        }
      } catch (rowError) {
        errors.push(rowError.message);
      }
    }

    // If no valid rows were found, throw error with all validation messages
    if (!validatedRows.length) {
      throw new Error(
        `No valid data found in Excel file. Errors:\n${errors.join("\n")}`
      );
    }

    // If some rows failed but others succeeded, log warnings but continue
    if (errors.length) {
      console.warn("Some rows failed validation:", errors);
    }

    return validatedRows;
  } catch (error) {
    // Add context to error
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
};

/**
 * Parse an Excel file from a path
 * @param {String} filePath - Path to Excel file
 * @returns {Promise<Array>} - Array of validated data objects
 */
const parseExcelFile = async (filePath) => {
  try {
    // Use the fs module from Node.js
    const fs = require("fs").promises;

    // Read file using Node's fs.promises
    const buffer = await fs.readFile(filePath);

    return parseExcelBuffer(buffer);
  } catch (error) {
    // Handle specific file system errors
    if (error.code === "ENOENT") {
      throw new Error(`File not found: ${filePath}`);
    }
    if (error.code === "EACCES") {
      throw new Error(`Permission denied accessing file: ${filePath}`);
    }

    // Re-throw parsed Excel errors with more context
    throw new Error(`Error reading Excel file: ${error.message}`);
  }
};

/**
 * Parse an Excel file from express-fileupload object
 * @param {Object} fileObject - Express-fileupload object
 * @returns {Promise<Array>} - Array of validated data objects
 */
const parseExcelUpload = async (fileObject) => {
  try {
    if (!fileObject || !fileObject.data) {
      throw new Error("Invalid file upload object");
    }

    return parseExcelBuffer(fileObject.data);
  } catch (error) {
    throw new Error(`Error processing uploaded Excel file: ${error.message}`);
  }
};

module.exports = {
  parseExcelBuffer,
  parseExcelFile,
  parseExcelUpload,
};
