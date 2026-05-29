// src/controllers/chat.controller.js — Handles loading chat history & chat groups listing
const ChatGroup = require('../models/ChatGroup');
const Message = require('../models/Message');
const Student = require('../models/Student');
const Team = require('../models/Team');
const User = require('../models/User');
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

// ─── Get Members of a Chat Group ─────────────────────────────────────────────
const getGroupMembers = async (req, res) => {
  try {
    const { chatGroupId } = req.params;

    const group = await ChatGroup.findById(chatGroupId);
    if (!group) return errorResponse(res, 'Chat group not found.', 404);

    const isMember = req.user.role === 'ADMIN' || group.members.some(
      m => m.userId && m.userId.toString() === req.user.id.toString()
    );
    if (!isMember) return errorResponse(res, 'You are not a member of this chat group.', 403);

    // Enrich each member with User info (name, avatar) or Student info (fullName)
    const enriched = await Promise.all(
      group.members.map(async (m) => {
        let displayName = null;
        let avatar = null;
        let email = null;

        if (m.userId) {
          const userDoc = await User.findById(m.userId).select('name email avatar');
          if (userDoc) {
            displayName = userDoc.name;
            avatar = userDoc.avatar || null;
            email = userDoc.email;
          }
        }

        if (!displayName && m.studentId) {
          const stuDoc = await Student.findById(m.studentId).select('fullName email avatarUrl');
          if (stuDoc) {
            displayName = stuDoc.fullName;
            avatar = stuDoc.avatarUrl || null;
            email = stuDoc.email;
          }
        }

        return {
          userId: m.userId || null,
          studentId: m.studentId || null,
          role: m.role,
          nickname: m.nickname || null,
          displayName,
          avatar,
          email,
        };
      })
    );

    return successResponse(res, { groupName: group.groupName, members: enriched });
  } catch (error) {
    console.error('getGroupMembers error:', error);
    return errorResponse(res, 'Failed to fetch group members.', 500);
  }
};

// ─── Update Member Nickname in a Chat Group ───────────────────────────────────
const updateMemberNickname = async (req, res) => {
  try {
    const { chatGroupId } = req.params;
    const { nickname } = req.body;

    if (nickname !== undefined && nickname !== null && typeof nickname === 'string' && nickname.length > 50) {
      return errorResponse(res, 'Nickname cannot exceed 50 characters.', 400);
    }

    const group = await ChatGroup.findById(chatGroupId);
    if (!group) return errorResponse(res, 'Chat group not found.', 404);

    // Only the user themselves can update their own nickname
    const memberIdx = group.members.findIndex(
      m => m.userId && m.userId.toString() === req.user.id.toString()
    );
    if (memberIdx === -1) return errorResponse(res, 'You are not a member of this chat group.', 403);

    group.members[memberIdx].nickname = nickname ? nickname.trim() || null : null;
    await group.save();

    return successResponse(res, {
      nickname: group.members[memberIdx].nickname,
    }, 'Nickname updated successfully.');
  } catch (error) {
    console.error('updateMemberNickname error:', error);
    return errorResponse(res, 'Failed to update nickname.', 500);
  }
};

const { uploadToCloudinary } = require('../services/cloudinary.service');
const uploadMiddleware = require('../middlewares/upload.middleware');

const uploadChatFile = (req, res) => {
  uploadMiddleware.single('file')(req, res, async (err) => {
    if (err) {
      console.error('File upload error:', err);
      return errorResponse(res, err.message || 'File upload failed.', 400);
    }

    if (!req.file) {
      return errorResponse(res, 'No file uploaded.', 400);
    }

    try {
      // Upload to Cloudinary instead of disk
      const result = await uploadToCloudinary(req.file.buffer, 'fpt_smep/chat_files');

      // Determine type
      let fileType = 'file';
      if (req.file.mimetype.startsWith('image/')) {
        fileType = 'image';
      }

      return successResponse(res, {
        url: result.secure_url,
        name: req.file.originalname,
        fileType,
        publicId: result.public_id,
      }, 'File uploaded successfully.');
    } catch (uploadErr) {
      console.error('Cloudinary upload error:', uploadErr);
      return errorResponse(res, 'Cloudinary upload failed.', 500);
    }
  });
};

module.exports = {
  getGroupMessages,
  getMyChatGroups,
  uploadChatFile,
  getGroupMembers,
  updateMemberNickname,
};
