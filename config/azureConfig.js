const { BlobServiceClient } = require("@azure/storage-blob");

// Validate Azure configuration
const validateAzureConfig = () => {
  const requiredVars = [
    "AZURE_STORAGE_ACCOUNT_NAME",
    "AZURE_STORAGE_ACCOUNT_KEY",
  ];

  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required Azure environment variables: ${missing.join(", ")}`
    );
  }
};

// Initialize Azure Blob Service Client
const initializeAzureBlobService = () => {
  try {
    validateAzureConfig();

    const connectionString = `DefaultEndpointsProtocol=https;AccountName=${process.env.AZURE_STORAGE_ACCOUNT_NAME};AccountKey=${process.env.AZURE_STORAGE_ACCOUNT_KEY};EndpointSuffix=core.windows.net`;

    const blobServiceClient =
      BlobServiceClient.fromConnectionString(connectionString);

    console.log("Azure Blob Storage client initialized successfully");
    return blobServiceClient;
  } catch (error) {
    console.error("Failed to initialize Azure Blob Storage:", error.message);
    throw error;
  }
};

module.exports = {
  validateAzureConfig,
  initializeAzureBlobService,
  CONTAINER_NAME: process.env.AZURE_CONTAINER_NAME || "lms-files",
};
