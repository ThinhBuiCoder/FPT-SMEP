// src/controllers/checkpoint.controller.js
const path = require('path');

const Team                 = require('../models/Team');
const CheckpointSubmission = require('../models/CheckpointSubmission');
const CheckpointFile       = require('../models/CheckpointFile');
const CheckpointFeedback   = require('../models/CheckpointFeedback');
const workspacePerm        = require('../utils/workspacePermission');
const { CHECKPOINTS, getCheckpointConfig } = require('../config/checkpointConfig');

const MAX_FILE_BYTES = CheckpointFile.MAX_FILE_BYTES;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ok  = (res, data, message = '') => res.status(200).json({ success: true, data, message });
const err = (res, message, status = 500) => res.status(status).json({ success: false, error: message });

const sanitizeFilename = (name) => {
  const ext  = path.extname(name).toLowerCase();
  const base = path.basename(name, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${base}${ext}`;
};

const buildDownloadUrl = (teamId, checkpointNumber, fileId) =>
  `/api/workspace/checkpoints/teams/${teamId}/checkpoints/${checkpointNumber}/files/${fileId}/download`;

const populateSubmissionFiles = (query) =>
  query.populate({
    path: 'files',
    select: '-data',
    populate: { path: 'uploadedBy', select: 'name email avatar role' },
  });

const attachFileUrls = (submission) => {
  if (!submission) return submission;
  const doc = submission.toObject ? submission.toObject() : { ...submission };
  const teamId = doc.teamId?._id?.toString() || doc.teamId?.toString();
  const cpNum = doc.checkpointNumber;
  if (doc.files?.length) {
    doc.files = doc.files.map((f) => ({
      ...f,
      fileUrl: buildDownloadUrl(teamId, cpNum, f._id),
    }));
  }
  return doc;
};

const formatSubmissions = (submissions) =>
  submissions.map((s) => attachFileUrls(s));

const buildUploader = () => {
  const multer = require('multer');

  const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx'];
  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.ms-powerpoint',
  ];

  const fileFilter = (_req, file, cb) => {
    const ext    = path.extname(file.originalname).toLowerCase();
    const extOk  = ALLOWED_EXTENSIONS.includes(ext);
    const mimeOk = ALLOWED_MIME_TYPES.includes(file.mimetype);

    if (!extOk || !mimeOk) {
      return cb(
        new Error(`Invalid file type. Allowed formats: ${ALLOWED_EXTENSIONS.join(', ')}`),
        false
      );
    }
    cb(null, true);
  };

  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_BYTES },
    fileFilter,
  }).single('file');
};

// ─── GET /api/workspace/checkpoints/config ────────────────────────────────────
exports.getConfig = (_req, res) => {
  return ok(res, CHECKPOINTS);
};

// ─── GET /api/workspace/checkpoints/teams/:teamId ─────────────────────────────
exports.getCheckpointData = async (req, res) => {
  try {
    const { teamId } = req.params;
    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const submissions = await populateSubmissionFiles(
      CheckpointSubmission.find({ teamId })
    );

    const feedbacks = await CheckpointFeedback.find({ teamId })
      .populate('user', 'name email avatar role')
      .sort({ createdAt: 1 });

    return ok(res, {
      submissions: formatSubmissions(submissions),
      feedbacks,
    });
  } catch (e) {
    if (e.statusCode === 403) return err(res, e.message, 403);
    console.error('getCheckpointData:', e);
    return err(res, 'Server error: ' + e.message);
  }
};

// ─── GET /api/workspace/checkpoints/teams/:teamId/history ────────────────────
exports.getFeedbackHistory = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { checkpointNumber } = req.query;

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const query = { teamId };
    if (checkpointNumber) {
      query.checkpointNumber = parseInt(checkpointNumber, 10);
    }

    const feedbacks = await CheckpointFeedback.find(query)
      .populate('user', 'name email avatar role')
      .sort({ createdAt: 1 });

    return ok(res, { feedbacks }, 'Feedback history loaded');
  } catch (e) {
    if (e.statusCode === 403) return err(res, e.message, 403);
    console.error('getFeedbackHistory:', e);
    return err(res, 'Server error: ' + e.message);
  }
};

// ─── POST .../upload ───────────────────────────────────────────────────────────
exports.uploadCheckpointFile = (req, res) => {
  const role = req.user?.role?.toUpperCase();
  if (role !== 'STUDENT') {
    return err(
      res,
      'Access Denied: Only student team members can upload checkpoint files.',
      403
    );
  }

  const uploader = buildUploader();

  uploader(req, res, async (uploadErr) => {
    if (uploadErr) return err(res, uploadErr.message, 400);
    if (!req.file) return err(res, 'No file uploaded.', 400);

    try {
      const { teamId, checkpointNumber } = req.params;
      const cpNum = parseInt(checkpointNumber, 10);

      await workspacePerm.assertCanEditTeamWorkspace(req.user, teamId);

      const team = await Team.findById(teamId);
      if (!team) return err(res, 'Team not found.', 404);

      const cpConfig = getCheckpointConfig(cpNum);
      if (!cpConfig) return err(res, 'Invalid checkpoint number.', 400);

      const timestamp = Date.now();
      const cleanName = sanitizeFilename(req.file.originalname);
      const storedName = `${teamId}_cp${cpNum}_${timestamp}_${cleanName}`;

      const checkpointFile = await CheckpointFile.create({
        teamId,
        classId: team.classId,
        checkpointNumber: cpNum,
        fileName: storedName,
        originalName: req.file.originalname,
        fileSize: req.file.size,
        fileType: path.extname(req.file.originalname).substring(1).toLowerCase(),
        mimeType: req.file.mimetype,
        data: req.file.buffer,
        uploadedBy: req.user._id,
      });

      let submission = await CheckpointSubmission.findOne({ teamId, checkpointNumber: cpNum });
      if (!submission) {
        submission = new CheckpointSubmission({
          teamId,
          classId: team.classId,
          checkpointNumber: cpNum,
          files: [],
        });
      }

      submission.files.push(checkpointFile._id);
      await submission.save();

      const populated = await populateSubmissionFiles(
        CheckpointSubmission.findById(submission._id)
      );

      return ok(res, attachFileUrls(populated), 'File uploaded successfully');
    } catch (dbErr) {
      if (dbErr.statusCode === 403) return err(res, dbErr.message, 403);
      console.error('uploadCheckpointFile:', dbErr);
      return err(res, 'Database error: ' + dbErr.message);
    }
  });
};

// ─── DELETE .../files/:fileId ──────────────────────────────────────────────────
exports.deleteCheckpointFile = async (req, res) => {
  try {
    const { teamId, checkpointNumber, fileId } = req.params;
    const cpNum = parseInt(checkpointNumber, 10);

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const checkpointFile = await CheckpointFile.findOne({
      _id: fileId,
      teamId,
      checkpointNumber: cpNum,
    });

    if (!checkpointFile) return err(res, 'File not found.', 404);

    const role = req.user.role.toUpperCase();
    const isOwner = checkpointFile.uploadedBy.toString() === req.user._id.toString();
    const isAdmin = role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return err(res, 'Access Denied: You can only delete your own files.', 403);
    }

    const submission = await CheckpointSubmission.findOne({ teamId, checkpointNumber: cpNum });
    if (!submission) return err(res, 'Submission not found.', 404);

    await CheckpointFile.findByIdAndDelete(fileId);

    submission.files = submission.files.filter((id) => id.toString() !== fileId);
    await submission.save();

    const populated = await populateSubmissionFiles(
      CheckpointSubmission.findById(submission._id)
    );

    return ok(res, attachFileUrls(populated), 'File deleted successfully');
  } catch (e) {
    if (e.statusCode === 403) return err(res, e.message, 403);
    console.error('deleteCheckpointFile:', e);
    return err(res, 'Server error: ' + e.message);
  }
};

// ─── GET .../files/:fileId/download ────────────────────────────────────────────
exports.downloadCheckpointFile = async (req, res) => {
  try {
    const { teamId, checkpointNumber, fileId } = req.params;
    const cpNum = parseInt(checkpointNumber, 10);

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const file = await CheckpointFile.findOne({
      _id: fileId,
      teamId,
      checkpointNumber: cpNum,
    }).select('+data');

    if (!file || !file.data) {
      return err(res, 'File not found.', 404);
    }

    res.setHeader('Content-Type', file.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`
    );
    res.setHeader('Content-Length', file.data.length);
    return res.send(file.data);
  } catch (e) {
    if (e.statusCode === 403) return err(res, e.message, 403);
    console.error('downloadCheckpointFile:', e);
    return err(res, 'Server error: ' + e.message);
  }
};

// ─── POST .../feedback ─────────────────────────────────────────────────────────
exports.addFeedback = async (req, res) => {
  try {
    const { teamId, checkpointNumber } = req.params;
    const cpNum = parseInt(checkpointNumber, 10);
    const { comment, parentFeedbackId } = req.body;

    if (!comment || !comment.trim()) {
      return err(res, 'Comment cannot be empty.', 400);
    }

    await workspacePerm.assertCanAccessTeamWorkspace(req.user, teamId);

    const feedback = await CheckpointFeedback.create({
      teamId,
      checkpointNumber: cpNum,
      user: req.user._id,
      comment: comment.trim(),
      parentFeedbackId: parentFeedbackId || null,
    });

    const populated = await CheckpointFeedback.findById(feedback._id)
      .populate('user', 'name email avatar role');

    return ok(res, populated, 'Feedback added successfully');
  } catch (e) {
    if (e.statusCode === 403) return err(res, e.message, 403);
    console.error('addFeedback:', e);
    return err(res, 'Server error: ' + e.message);
  }
};
