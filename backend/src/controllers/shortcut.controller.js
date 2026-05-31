const Shortcut = require('../models/Shortcut');
const Team = require('../models/Team');
const { normalizeUrl } = require('../utils/shortcutUrl');
const workspaceAccess = require('../services/workspaceAccess.service');

const ok = (res, data, message = 'OK', status = 200) =>
  res.status(status).json({ success: true, message, data });

const fail = (res, message = 'Error', status = 500) =>
  res.status(status).json({ success: false, message });

const validateName = (name, emptyMessage = 'Name is required.') => {
  if (typeof name !== 'string' || !name.trim()) {
    const error = new Error(emptyMessage);
    error.statusCode = 400;
    throw error;
  }

  const normalized = name.trim();
  if (normalized.length > 100) {
    const error = new Error('Name must be 100 characters or less.');
    error.statusCode = 400;
    throw error;
  }

  return normalized;
};

const handleShortcutError = (res, err) => {
  if (err.code === 11000) {
    return fail(res, 'A shortcut with this URL already exists in the team.', 409);
  }

  if (err.statusCode) {
    return fail(res, err.message, err.statusCode);
  }

  console.error('[shortcuts]', err);
  return fail(res, 'Server error: ' + err.message);
};

exports.getShortcuts = async (req, res) => {
  try {
    const team = await Team.findById(req.params.teamId).select('lineageId');
    const query = team?.lineageId ? { lineageId: team.lineageId } : { teamId: req.params.teamId };
    const shortcuts = await Shortcut.find(query)
      .populate('createdBy', 'name avatar')
      .sort({ createdAt: -1 })
      .lean();

    return ok(res, shortcuts);
  } catch (err) {
    return handleShortcutError(res, err);
  }
};

exports.createShortcut = async (req, res) => {
  try {
    await workspaceAccess.assertCanMutateWorkspace(req.user, req.params.teamId);
    const name = validateName(req.body.name);
    const url = normalizeUrl(req.body.url);
    const team = await Team.findById(req.params.teamId).select('lineageId');

    const shortcut = await Shortcut.create({
      teamId: req.params.teamId,
      lineageId: team?.lineageId || null,
      name,
      url,
      createdBy: req.user._id,
    });

    await shortcut.populate('createdBy', 'name avatar');
    return ok(res, shortcut, 'Shortcut created.', 201);
  } catch (err) {
    return handleShortcutError(res, err);
  }
};

exports.updateShortcut = async (req, res) => {
  try {
    await workspaceAccess.assertCanMutateWorkspace(req.user, req.params.teamId);
    const shortcut = req.shortcut;

    if (req.body.name !== undefined) {
      shortcut.name = validateName(req.body.name, 'Name cannot be empty.');
    }

    if (req.body.url !== undefined) {
      shortcut.url = normalizeUrl(req.body.url);
    }

    await shortcut.save();
    await shortcut.populate('createdBy', 'name avatar');
    return ok(res, shortcut, 'Shortcut updated.');
  } catch (err) {
    return handleShortcutError(res, err);
  }
};

exports.deleteShortcut = async (req, res) => {
  try {
    await workspaceAccess.assertCanMutateWorkspace(req.user, req.params.teamId);
    await req.shortcut.deleteOne();
    return ok(res, null, 'Shortcut deleted.');
  } catch (err) {
    return handleShortcutError(res, err);
  }
};
