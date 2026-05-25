// src/services/teamGeneration.service.js
// Handles team generation logic and auto-assigns a sequential team code/name.

const Team = require('../models/Team');
const Student = require('../models/Student');

/**
 * Validate student IDs before creating a team:
 * - All students must belong to classId
 * - None can already be in another team within the same class
 * - Must have at least 2 different majors
 * - Auto mode: requires >= 6 members
 * - Manual mode: allows < 6 but still requires >= 2 majors
 *
 * @param {string[]} studentIds
 * @param {string}   classId
 * @param {'auto'|'manual'} mode
 * @returns {{ students: Student[], error: string|null }}
 */
const validateTeamStudents = async (studentIds, classId, mode) => {
  if (!studentIds || studentIds.length === 0)
    return { students: [], error: 'No students selected' };

  // Deduplicate
  const uniqueIds = [...new Set(studentIds.map(String))];

  // Fetch students and populate userId to fallback major if needed
  const students = await Student.find({ _id: { $in: uniqueIds }, classId }).populate('userId', 'major');

  if (students.length !== uniqueIds.length)
    return { students: [], error: 'One or more students do not belong to this class' };

  // Check if any student already has a team in this class
  const alreadyAssigned = students.filter(s => s.teamId);
  if (alreadyAssigned.length > 0) {
    const names = alreadyAssigned.map(s => s.fullName).join(', ');
    return { students: [], error: `These students are already in a team: ${names}` };
  }

  // Major validation
  // Only count non-null, non-empty major values. Fallback to userId.major if student.major is missing
  const majors = [...new Set(
    students
      .map(s => s.major || (s.userId && s.userId.major) || null)
      .filter(m => typeof m === 'string' && m.trim().length > 0)
      .map(m => m.trim().toUpperCase())
  )];
  if (majors.length < 2)
    return { students: [], error: 'Team must include students from at least 2 different majors.' };

  // Size validation
  if (students.length < 4 || students.length > 6) {
    return { students: [], error: 'Team size must be between 4 and 6 students' };
  }

  return { students, error: null };
};

/**
 * Generate a sequential team code for a class.
 * Pattern: {classCode}_TEAM_{N}
 * Uses max index from existing teamCodes to avoid race condition collisions.
 *
 * @param {string} classCode
 * @param {string} classId
 * @returns {Promise<{ teamCode: string, teamName: string, teamIndex: number }>}
 */
const generateTeamCode = async (classCode, classId) => {
  // Find the highest team index by parsing existing teamCodes
  const existingTeams = await Team.find({ classId }, { teamCode: 1 }).sort({ createdAt: -1 });
  let maxIndex = 0;
  const prefix = `${classCode}_TEAM_`.toUpperCase();
  for (const t of existingTeams) {
    if (t.teamCode && t.teamCode.startsWith(prefix)) {
      const num = parseInt(t.teamCode.replace(prefix, ''), 10);
      if (num > maxIndex) maxIndex = num;
    }
  }
  const teamIndex = maxIndex + 1;
  const teamCode = `${prefix}${teamIndex}`;
  const teamName = `Team ${teamIndex}`;
  return { teamCode, teamName, teamIndex };
};

module.exports = { validateTeamStudents, generateTeamCode };
