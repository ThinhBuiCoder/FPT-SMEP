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

module.exports = router;
