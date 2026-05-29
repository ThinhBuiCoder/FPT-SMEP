const cloudinary = require('cloudinary').v2;

// Configure Cloudinary using credentials from .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Uploads a file buffer to Cloudinary
 * @param {Buffer} buffer - The file buffer
 * @param {String} folder - Optional folder name in Cloudinary
 * @returns {Promise<Object>} - The Cloudinary upload result
 */
const uploadToCloudinary = (buffer, folder = 'fpt_smep') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto', // Important: 'auto' allows uploading images, pdfs, excel files, etc.
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    // Write buffer to stream
    uploadStream.end(buffer);
  });
};

/**
 * Deletes a file from Cloudinary by its public ID
 * @param {String} publicId - The public ID of the resource
 */
const deleteFromCloudinary = async (publicId) => {
  try {
    return await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    throw error;
  }
};

module.exports = {
  cloudinary,
  uploadToCloudinary,
  deleteFromCloudinary,
};
