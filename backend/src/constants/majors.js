// backend/src/constants/majors.js

/**
 * Two major groups for EXE team formation rules:
 *  - Nhóm 1 (BBA-side): BBA_HM, BBA_IB, BBA_MC, BBA_MKT, BEN, BBA_TM
 *  - Nhóm 2 (BIT-side): BIT_AI, BIT_GD, BIT_IA, BIT_SE
 * A team MUST include students from BOTH groups.
 */
const TEAM_MAJOR_GROUPS = {
  GROUP_1: {
    label: 'Nhóm 1 (BBA)',
    majors: ['BBA_HM', 'BBA_IB', 'BBA_MC', 'BBA_MKT', 'BEN', 'BBA_TM'],
  },
  GROUP_2: {
    label: 'Nhóm 2 (BIT)',
    majors: ['BIT_AI', 'BIT_GD', 'BIT_IA', 'BIT_SE'],
  },
};

// All valid majors across both team groups (for quick lookup)
const ALL_TEAM_MAJORS = [
  ...TEAM_MAJOR_GROUPS.GROUP_1.majors,
  ...TEAM_MAJOR_GROUPS.GROUP_2.majors,
];

/**
 * Full program groups (used for registration / profile selection).
 * Includes all majors a student may hold.
 */
const PROGRAM_GROUPS = {
  BIT: {
    name: 'Bachelor of Information Technology',
    majors: ['BIT_SE', 'BIT_IA', 'BIT_GD', 'BIT_AI', 'BIT_IS', 'BIT_CS', 'BIT_CY', 'BIT_DS'],
  },
  BBA: {
    name: 'Bachelor of Business Administration',
    majors: ['BBA_IB', 'BBA_MKT', 'BBA_HM', 'BBA_MC', 'BBA_TM', 'BBA_FIN', 'BBA_HRM', 'BBA_DM', 'BBA_BA', 'BBA_LOG'],
  },
  BEN: {
    name: 'Business English / Other',
    majors: ['BEN'],
  },
  BLA: {
    name: 'Bachelor of Language Arts',
    majors: ['BLA_ELT', 'BLA_BC', 'BLA_JP', 'BLA_KR', 'BLA_CN'],
  },
};

/**
 * Returns the team group key ('GROUP_1' | 'GROUP_2' | null) for a given major.
 */
function getTeamGroupFromMajor(major) {
  if (!major) return null;
  const m = major.trim().toUpperCase();
  for (const [key, group] of Object.entries(TEAM_MAJOR_GROUPS)) {
    if (group.majors.includes(m)) return key;
  }
  return null;
}

/**
 * Validates if the given major is valid for the provided programGroup.
 */
function isValidProgramMajor(programGroup, major) {
  if (!programGroup || !major) return false;
  const group = PROGRAM_GROUPS[programGroup];
  if (!group) return false;
  return group.majors.includes(major);
}

/**
 * Returns the programGroup for a given major.
 */
function getProgramGroupFromMajor(major) {
  if (!major) return null;
  for (const groupCode in PROGRAM_GROUPS) {
    if (PROGRAM_GROUPS[groupCode].majors.includes(major)) {
      return groupCode;
    }
  }
  return null;
}

module.exports = {
  PROGRAM_GROUPS,
  TEAM_MAJOR_GROUPS,
  ALL_TEAM_MAJORS,
  isValidProgramMajor,
  getProgramGroupFromMajor,
  getTeamGroupFromMajor,
};
