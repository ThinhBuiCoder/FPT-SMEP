// src/routes/user.routes.js
const express = require('express');
const { getUsers, getUserById, updateUser, deleteUser, createUser } = require('../controllers/user.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/', authorize('ADMIN'), getUsers);
router.post('/', authorize('ADMIN'), createUser);
router.get('/:id', authorize('ADMIN'), getUserById);
router.put('/:id', authorize('ADMIN'), updateUser);
router.delete('/:id', authorize('ADMIN'), deleteUser);

module.exports = router;
