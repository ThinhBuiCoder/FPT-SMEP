// src/routes/chat.routes.js — Central Real-Time Chat Routes
const express = require('express');
const ctrl = require('../controllers/chat.controller');
const { protect } = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(protect);

// central channel listing
router.get('/groups', ctrl.getMyChatGroups);

// message history
router.get('/groups/:chatGroupId/messages', ctrl.getGroupMessages);

// members list for a group
router.get('/groups/:chatGroupId/members', ctrl.getGroupMembers);

// update own nickname in a group
router.patch('/groups/:chatGroupId/nickname', ctrl.updateMemberNickname);

// upload file/image in chat
router.post('/upload', ctrl.uploadChatFile);

module.exports = router;

