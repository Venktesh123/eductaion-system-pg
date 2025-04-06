const AWS = require("aws-sdk");
const { v4: uuidv4 } = require("uuid");
const { ErrorHandler } = require("../middleware/errorHandler");

// Configure AWS with environment variables
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

/**
 * Upload a file to AWS S3
 * @param {Object} file - Express-fileupload file object
 * @param {String} folder - Target folder in S3 bucket
 * @returns {Promise<Object>} - File URL and key
 */
const uploadFileToS3 = async (file, folder) => {
  return new Promise((resolve, reject) => {
    // Make sure we have the file data in the right format for S3
    const fileContent = file.data;
    if (!fileContent) {
      console.log("No file content found");
      return reject(new Error("No file content found"));
    }

    // Generate a unique filename
    const fileName = `${folder}/${uuidv4()}-${file.name.replace(/\\s+/g, "-")}`;

    // Set up the S3 upload parameters
    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: fileName,
      Body: fileContent,
      ContentType: file.mimetype,
    };

    console.log("S3 upload params prepared");

    // Upload to S3
    s3.upload(params, (err, data) => {
      if (err) {
        console.log("S3 upload error:", err);
        return reject(err);
      }
      console.log("File uploaded successfully:", fileName);
      resolve({
        url: data.Location,
        key: data.Key,
      });
    });
  });
};

/**
 * Delete a file from AWS S3
 * @param {String} key - S3 object key to delete
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFileFromS3 = async (key) => {
  console.log("Deleting file from S3:", key);
  return new Promise((resolve, reject) => {
    if (!key) {
      console.log("No file key provided");
      return resolve({ message: "No file key provided" });
    }

    const params = {
      Bucket: process.env.AWS_S3_BUCKET_NAME,
      Key: key,
    };

    s3.deleteObject(params, (err, data) => {
      if (err) {
        console.log("S3 delete error:", err);
        return reject(err);
      }
      console.log("File deleted successfully from S3");
      resolve(data);
    });
  });
};

module.exports = {
  uploadFileToS3,
  deleteFileFromS3,
};
