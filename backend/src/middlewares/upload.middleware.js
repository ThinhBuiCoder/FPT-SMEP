const multer = require('multer');

// Configure multer to use memory storage
// This allows us to access the file buffer and stream it directly to Cloudinary
const storage = multer.memoryStorage();

// Accept any file type up to 15MB
const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB limit
  },
});

module.exports = upload;
