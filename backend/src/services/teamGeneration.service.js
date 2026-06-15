// src/services/teamGeneration.service.js
// Handles team generation logic and auto-assigns a sequential team code/name.

const Team = require('../models/Team');
const Student = require('../models/Student');
const { getTeamGroupFromMajor } = require('../constants/majors');

/**
 * Validate student IDs before creating a team:
 * - All students must belong to classId
 * - None can already be in another team within the same class
 * - Must include students from BOTH Nhóm 1 (BBA) AND Nhóm 2 (BIT)
 * - Team size must be between 4 and 6 students
 *
 * @param {string[]} studentIds
 * @param {string}   classId
 * @param {'auto'|'manual'|'exception'} mode
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

  // Size validation: 4–6 members (skip for exception mode)
  if (mode !== 'exception' && (students.length < 4 || students.length > 6)) {
    return { students: [], error: 'Team size must be between 4 and 6 students' };
  }

  // Exception mode: only 3 or 7 members are allowed as exceptions
  if (mode === 'exception' && students.length !== 3 && students.length !== 7) {
    return { students: [], error: 'Trường hợp ngoại lệ chỉ cho phép 3 hoặc 7 thành viên' };
  }

  // ── Major group validation ───────────────────────────────────────────────────
  // Each student's major (fallback to userId.major) must be resolved.
  // The team MUST contain at least one student from GROUP_1 (BBA-side)
  // AND at least one student from GROUP_2 (BIT-side).
  const groupsPresent = new Set();

  for (const s of students) {
    const major = s.major || (s.userId && s.userId.major) || null;
    if (!major) continue; // students without a major are ignored in group check
    const group = getTeamGroupFromMajor(major);
    if (group) groupsPresent.add(group);
  }

  if (!groupsPresent.has('GROUP_1') || !groupsPresent.has('GROUP_2')) {
    return {
      students: [],
      error:
        'Nhóm phải có sinh viên từ cả 2 nhóm ngành:\n' +
        '• Nhóm 1: BBA_HM, BBA_IB, BBA_MC, BBA_MKT, BEN, BBA_TM\n' +
        '• Nhóm 2: BIT_AI, BIT_GD, BIT_IA, BIT_SE',
    };
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
