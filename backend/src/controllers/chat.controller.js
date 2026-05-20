// src/controllers/chat.controller.js — Handles loading chat history & chat groups listing
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
const Student = require('../models/Student');
const Team = require('../models/Team');
const { successResponse, errorResponse } = require('../utils/apiResponse');

// ─── Get Messages History for a Group ───────────────────────────────────────
const getGroupMessages = async (req, res) => {
  try {
    const { chatGroupId } = req.params;
    
    // Authorization check: Make sure user is member of this group
    const group = await ChatGroup.findById(chatGroupId);
    if (!group) {
      return errorResponse(res, 'Chat group not found.', 404);
    }

    const isMember = req.user.role === 'ADMIN' || group.members.some(
      m => m.userId && m.userId.toString() === req.user.id.toString()
    );

    if (!isMember) {
      return errorResponse(res, 'You are not a member of this chat group.', 403);
    }

    const messages = await Message.find({ chatGroupId })
      .populate('senderId', 'name email avatar')
      .sort({ createdAt: 1 })
      .limit(100);

    return successResponse(res, messages);
  } catch (error) {
    console.error('getGroupMessages error:', error);
    return errorResponse(res, 'Failed to fetch messages.', 500);
  }
};

// ─── Centralized Group Chat List (Central Channel Sidebar) ─────────────────────
const getMyChatGroups = async (req, res) => {
  try {
    let groups = [];

    if (req.user.role === 'ADMIN') {
      // Admin sees all chat groups
      groups = await ChatGroup.find()
        .populate('teamId', 'teamName teamCode')
        .populate('classId', 'classCode semester year')
        .sort({ updatedAt: -1 });
    } else {
      // Find chat groups where user is a member
      groups = await ChatGroup.find({ 'members.userId': req.user.id })
        .populate('teamId', 'teamName teamCode')
        .populate('classId', 'classCode semester year')
        .sort({ updatedAt: -1 });
    }

    // Map to include latest message for list view preview
    const mappedGroups = await Promise.all(
      groups.map(async (group) => {
        const lastMsg = await Message.findOne({ chatGroupId: group._id })
          .sort({ createdAt: -1 })
          .select('text senderName createdAt');
        
        return {
          _id: group._id,
          groupName: group.groupName,
          team: group.teamId,
          class: group.classId,
          lastMessage: lastMsg || null,
        };
      })
    );

    return successResponse(res, mappedGroups);
  } catch (error) {
    console.error('getMyChatGroups error:', error);
    return errorResponse(res, 'Failed to load chat channels.', 500);
  }
};

module.exports = {
  getGroupMessages,
  getMyChatGroups,
};
