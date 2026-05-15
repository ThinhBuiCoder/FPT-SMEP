// src/routes/class.routes.js
const express = require('express');
const { createClass, getClasses, getClassById, updateClass, deleteClass, addMembers, removeMember } = require('../controllers/class.controller');
const { protect } = require('../middlewares/auth.middleware');
const { authorize } = require('../middlewares/role.middleware');

const router = express.Router();
router.use(protect);

router.post('/',                          authorize('LECTURER', 'ADMIN'), createClass);
router.get('/',                           getClasses);
router.get('/:id',                        getClassById);
router.put('/:id',                        authorize('LECTURER', 'ADMIN'), updateClass);
router.delete('/:id',                     authorize('LECTURER', 'ADMIN'), deleteClass);
router.post('/:id/members',               authorize('LECTURER', 'ADMIN'), addMembers);
router.delete('/:id/members/:userId',     authorize('LECTURER', 'ADMIN'), removeMember);

module.exports = router;
