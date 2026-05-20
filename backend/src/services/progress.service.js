// src/services/progress.service.js
const SprintTask = require('../models/SprintTask');
const Milestone = require('../models/Milestone');

/**
 * Recalculate a single milestone's progress from its tasks.
 * Updates milestone.progress and milestone.status in DB.
 */
exports.recalculateMilestoneProgress = async (milestoneId) => {
  if (!milestoneId) return;

  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) return;

  const totalTasks = await SprintTask.countDocuments({ milestoneId });
  const doneTasks = await SprintTask.countDocuments({ milestoneId, status: 'DONE' });

  const progress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);
  milestone.progress = progress;

  // Auto-set status based on progress and dates
  const now = new Date();
  if (progress === 100) {
    milestone.status = 'COMPLETED';
  } else if (progress > 0) {
    milestone.status = 'IN_PROGRESS';
  } else {
    milestone.status = 'PLANNED';
  }

  // Override to OVERDUE if past due and not completed
  if (milestone.dueDate && new Date(milestone.dueDate) < now && progress < 100) {
    milestone.status = 'OVERDUE';
  }

  await milestone.save();
  return milestone;
};

/**
 * Get aggregate progress for a team.
 */
exports.getTeamProgress = async (teamId) => {
  const allTasks = await SprintTask.find({ teamId });
  const totalTasks = allTasks.length;
  const doneTasks = allTasks.filter(t => t.status === 'DONE').length;
  const overallProgress = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  const tasksByStatus = {
    TODO: allTasks.filter(t => t.status === 'TODO').length,
    IN_PROGRESS: allTasks.filter(t => t.status === 'IN_PROGRESS').length,
    REVIEW: allTasks.filter(t => t.status === 'REVIEW').length,
    DONE: doneTasks,
  };

  const milestones = await Milestone.find({ teamId }).sort({ dueDate: 1 });
  const milestoneProgress = await Promise.all(
    milestones.map(async (m) => {
      const mTotalTasks = await SprintTask.countDocuments({ milestoneId: m._id });
      const mDoneTasks = await SprintTask.countDocuments({ milestoneId: m._id, status: 'DONE' });
      const mProgress = mTotalTasks === 0 ? 0 : Math.round((mDoneTasks / mTotalTasks) * 100);

      // Normalize legacy status
      let status = m.status;
      if (status === 'TODO') status = 'PLANNED';
      if (status === 'DONE') status = 'COMPLETED';

      return {
        milestoneId: m._id,
        title: m.title,
        startDate: m.startDate,
        dueDate: m.dueDate,
        totalTasks: mTotalTasks,
        doneTasks: mDoneTasks,
        progress: mProgress,
        status,
      };
    })
  );

  return {
    totalTasks,
    doneTasks,
    overallProgress,
    tasksByStatus,
    milestones: milestoneProgress,
  };
};
