const { BlobServiceClient } = require("@azure/storage-blob");
const { v4: uuidv4 } = require("uuid");
const { ErrorHandler } = require("../middleware/errorHandler");

// Configure Azure Blob Storage with environment variables
const blobServiceClient = BlobServiceClient.fromConnectionString(
  `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`
);

// Container name for file storage
const CONTAINER_NAME = process.env.AZURE_CONTAINER_NAME || "lms-files";

/**
 * Ensure container exists
 */
const ensureContainer = async () => {
  try {
    const containerClient =
      blobServiceClient.getContainerClient(CONTAINER_NAME);
    const exists = await containerClient.exists();

    if (!exists) {
      await containerClient.create({
        access: "blob", // Public read access for blobs
      });
      console.log(`Container ${CONTAINER_NAME} created successfully`);
    }

    return containerClient;
  } catch (error) {
    console.error("Error ensuring container exists:", error);
    throw new Error(`Failed to ensure container exists: ${error.message}`);
  }
};

/**
 * Upload a file to Azure Blob Storage
 * @param {Object} file - Express-fileupload file object
 * @param {String} folder - Target folder in blob container
 * @returns {Promise<Object>} - File URL and key
 */
const uploadFileToAzure = async (file, folder) => {
  try {
    // Make sure we have the file data
    const fileContent = file.data;
    if (!fileContent) {
      console.log("No file content found");
      throw new Error("No file content found");
    }

    // Ensure container exists
    const containerClient = await ensureContainer();

    // Generate a unique filename
    const fileName = `${folder}/${uuidv4()}-${file.name.replace(/\s+/g, "-")}`;

    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(fileName);

    console.log("Azure Blob upload starting for:", fileName);

    // Upload file
    const uploadResponse = await blockBlobClient.uploadData(fileContent, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype,
      },
    });

    if (uploadResponse.errorCode) {
      throw new Error(`Upload failed: ${uploadResponse.errorCode}`);
    }

    const fileUrl = blockBlobClient.url;

    console.log("File uploaded successfully:", fileName);

    return {
      url: fileUrl,
      key: fileName,
    };
  } catch (error) {
    console.error("Azure Blob upload error:", error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
};

/**
 * Delete a file from Azure Blob Storage
 * @param {String} key - Blob name/key to delete
 * @returns {Promise<Object>} - Deletion result
 */
const deleteFileFromAzure = async (key) => {
  try {
    console.log("Deleting file from Azure Blob:", key);

    if (!key) {
      console.log("No file key provided");
      return { message: "No file key provided" };
    }

    // Ensure container exists
    const containerClient = await ensureContainer();

    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    // Check if blob exists
    const exists = await blockBlobClient.exists();

    if (!exists) {
      console.log("File does not exist:", key);
      return { message: "File does not exist" };
    }

    // Delete the blob
    const deleteResponse = await blockBlobClient.delete();

    if (deleteResponse.errorCode) {
      throw new Error(`Delete failed: ${deleteResponse.errorCode}`);
    }

    console.log("File deleted successfully from Azure Blob");

    return {
      message: "File deleted successfully",
      deleted: true,
    };
  } catch (error) {
    console.error("Azure Blob delete error:", error);
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

/**
 * Get a direct download URL for a file (same as regular URL for public blobs)
 * @param {String} key - Blob name/key
 * @returns {Promise<String>} - Download URL
 */
const getFileUrl = async (key) => {
  try {
    if (!key) {
      throw new Error("No file key provided");
    }

    const containerClient = await ensureContainer();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    return blockBlobClient.url;
  } catch (error) {
    console.error("Error getting file URL:", error);
    throw new Error(`Failed to get file URL: ${error.message}`);
  }
};

/**
 * Check if a file exists in Azure Blob Storage
 * @param {String} key - Blob name/key to check
 * @returns {Promise<Boolean>} - True if file exists
 */
const fileExists = async (key) => {
  try {
    if (!key) {
      return false;
    }

    const containerClient = await ensureContainer();
    const blockBlobClient = containerClient.getBlockBlobClient(key);

    return await blockBlobClient.exists();
  } catch (error) {
    console.error("Error checking if file exists:", error);
    return false;
  }
};

module.exports = {
  uploadFileToAzure,
  deleteFileFromAzure,
  getFileUrl,
  fileExists,
};
