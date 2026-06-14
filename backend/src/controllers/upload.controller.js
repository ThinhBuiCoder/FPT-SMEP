const { uploadToCloudinary } = require('../services/cloudinary.service');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// POST /api/upload
const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return errorResponse(res, 'No file uploaded', 400);
    }

    const result = await uploadToCloudinary(req.file.buffer);

    return successResponse(res, {
      url: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
    }, 'File uploaded successfully', 201);
  } catch (error) {
    console.error('Upload Error:', error);
    if (error.code === 'CLOUDINARY_NOT_CONFIGURED') {
      return errorResponse(
        res,
        'File storage is not configured on the server. Please contact the administrator.',
        503
      );
    }
    return errorResponse(res, 'File upload failed', 500);
  }
};

module.exports = {
  uploadFile,
};
