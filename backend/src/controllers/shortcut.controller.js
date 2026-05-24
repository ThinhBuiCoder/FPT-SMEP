const Shortcut = require('../models/Shortcut');
const { normalizeUrl } = require('../utils/shortcutUrl');

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
    const shortcuts = await Shortcut.find({ teamId: req.params.teamId })
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
    const name = validateName(req.body.name);
    const url = normalizeUrl(req.body.url);

    const shortcut = await Shortcut.create({
      teamId: req.params.teamId,
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
    await req.shortcut.deleteOne();
    return ok(res, null, 'Shortcut deleted.');
  } catch (err) {
    return handleShortcutError(res, err);
  }
};
