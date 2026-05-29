const express = require('express');
const router = express.Router();
const upload = require('../middlewares/upload.middleware');
const uploadController = require('../controllers/upload.controller');
const { protect } = require('../middlewares/auth.middleware');

// Route for uploading a single file. 
// protect ensures only logged-in users can upload files.
// upload.single('file') expects the form-data key to be 'file'.
router.post('/', protect, upload.single('file'), uploadController.uploadFile);

module.exports = router;
