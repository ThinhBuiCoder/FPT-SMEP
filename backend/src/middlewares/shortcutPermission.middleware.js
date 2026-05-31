const Shortcut = require('../models/Shortcut');
const workspacePerm = require('../utils/workspacePermission');
const { errorResponse } = require('../utils/apiResponse');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return errorResponse(res, 'Authentication required.', 401);
  }
  return next();
};

const canAccessTeamWorkspace = async (req, res, next) => {
  try {
    const canAccess = await workspacePerm.canAccessTeamWorkspace(req.user, req.params.teamId);
    if (!canAccess) {
      return errorResponse(res, 'Access denied.', 403);
    }
    return next();
  } catch (err) {
    return errorResponse(res, err.message || 'Permission check failed.', 500);
  }
};

const canManageShortcut = async (req, res, next) => {
  try {
    const { teamId, shortcutId } = req.params;
    const shortcut = await Shortcut.findById(shortcutId);

    if (!shortcut) {
      return errorResponse(res, 'Shortcut not found.', 404);
    }

    const canAccess = await workspacePerm.canAccessTeamWorkspace(req.user, teamId);
    if (!canAccess) {
      return errorResponse(res, 'Access denied.', 403);
    }

    const role = req.user.role?.toUpperCase();
    const isPrivileged = ['ADMIN', 'LECTURER', 'MENTOR'].includes(role);
    const isOwner = shortcut.createdBy.toString() === req.user._id.toString();

    if (!isPrivileged && !isOwner) {
      return errorResponse(res, 'You can only manage shortcuts you created.', 403);
    }

    req.shortcut = shortcut;
    return next();
  } catch (err) {
    return errorResponse(res, err.message || 'Permission check failed.', 500);
  }
};

module.exports = {
  requireAuth,
  canAccessTeamWorkspace,
  canManageShortcut,
};
