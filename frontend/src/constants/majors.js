// frontend/src/constants/majors.js

export const PROGRAM_GROUPS = [
  {
    code: "BIT",
    name: "Bachelor of Information Technology",
    majors: [
      { code: "BIT_SE", name: "Software Engineering" },
      { code: "BIT_IA", name: "Information Assurance" },
      { code: "BIT_GD", name: "Graphic Design" },
      { code: "BIT_IS", name: "Information Systems" },
      { code: "BIT_CS", name: "Computer Science" },
      { code: "BIT_CY", name: "Cyber Security" },
      { code: "BIT_DS", name: "Data Science" }
    ]
  },
  {
    code: "BBA",
    name: "Bachelor of Business Administration",
    majors: [
      { code: "BBA_IB", name: "International Business" },
      { code: "BBA_MKT", name: "Marketing" },
      { code: "BBA_FIN", name: "Finance" },
      { code: "BBA_HRM", name: "Human Resource Management" },
      { code: "BBA_DM", name: "Digital Marketing" },
      { code: "BBA_BA", name: "Business Administration" },
      { code: "BBA_LOG", name: "Logistics" }
    ]
  },
  {
    code: "BLA",
    name: "Bachelor of Language Arts",
    majors: [
      { code: "BLA_ELT", name: "English Language Teaching" },
      { code: "BLA_BC", name: "Business Communication" },
      { code: "BLA_JP", name: "Japanese Language" },
      { code: "BLA_KR", name: "Korean Language" },
      { code: "BLA_CN", name: "Chinese Language" }
    ]
  }
];

export function getMajorName(majorCode) {
  if (!majorCode) return null;
  for (const group of PROGRAM_GROUPS) {
    const major = group.majors.find(m => m.code === majorCode);
    if (major) return major.name;
  }
  return null;
}
