// backend/src/constants/majors.js

const PROGRAM_GROUPS = {
  BIT: {
    name: "Bachelor of Information Technology",
    majors: ["BIT_SE", "BIT_IA", "BIT_GD", "BIT_IS", "BIT_CS", "BIT_CY", "BIT_DS"]
  },
  BBA: {
    name: "Bachelor of Business Administration",
    majors: ["BBA_IB", "BBA_MKT", "BBA_FIN", "BBA_HRM", "BBA_DM", "BBA_BA", "BBA_LOG"]
  },
  BLA: {
    name: "Bachelor of Language Arts",
    majors: ["BLA_ELT", "BLA_BC", "BLA_JP", "BLA_KR", "BLA_CN"]
  }
};

/**
 * Validates if the given major is valid for the provided programGroup.
 * @param {string} programGroup 
 * @param {string} major 
 * @returns {boolean}
 */
function isValidProgramMajor(programGroup, major) {
  if (!programGroup || !major) return false;
  const group = PROGRAM_GROUPS[programGroup];
  if (!group) return false;
  return group.majors.includes(major);
}

/**
 * Returns the programGroup for a given major.
 * @param {string} major 
 * @returns {string|null}
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
  isValidProgramMajor,
  getProgramGroupFromMajor
};
