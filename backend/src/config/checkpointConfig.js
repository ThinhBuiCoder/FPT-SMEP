// src/config/checkpointConfig.js
// Static definitions for all 4 startup checkpoints.
// No database required — easy to update and maintain.

const LEVEL_GUIDE = [
  {
    key: 'EXCELLENT',
    label: 'Excellent',
    range: '8.5–10',
    description: 'Outstanding evidence, clearly exceeds expectations.',
  },
  {
    key: 'GOOD',
    label: 'Good',
    range: '7.0–8.4',
    description: 'Solid evidence, meets expectations well.',
  },
  {
    key: 'FAIR',
    label: 'Fair',
    range: '5.0–6.9',
    description: 'Partial evidence, meets the baseline only.',
  },
  {
    key: 'POOR',
    label: 'Poor',
    range: '< 5.0',
    description: 'Insufficient evidence or weak execution.',
  },
];

const buildCriteria = (criteria) =>
  criteria.map((item) => ({
    ...item,
    levels: LEVEL_GUIDE,
  }));

const CHECKPOINTS = [
  {
    number: 1,
    title: 'Startup Idea & Team Formation',
    shortDescription:
      'Define your startup concept, choose your field, establish your team structure and member roles.',
    icon: 'Users',
    requirements: [
      'Team Name',
      'Startup Idea',
      'Startup Field',
      'Member Roles',
    ],
    rubrics: buildCriteria([
      {
        key: 'startupIdeaClarity',
        label: 'Startup Idea Clarity',
        weight: 30,
        description: 'How clear, focused, and understandable the idea is.',
      },
      {
        key: 'problemIdentification',
        label: 'Problem Identification',
        weight: 20,
        description: 'How well the team identifies a real and important problem.',
      },
      {
        key: 'teamRolesContribution',
        label: 'Team Roles & Contribution',
        weight: 20,
        description: 'How balanced and accountable the team roles and contributions are.',
      },
      {
        key: 'presentationQuality',
        label: 'Presentation Quality',
        weight: 20,
        description: 'Structure, clarity, visual quality, and delivery of the presentation.',
      },
      {
        key: 'qaDiscussion',
        label: 'Q&A / Discussion',
        weight: 10,
        description: 'Ability to respond to questions and defend the idea.',
      },
    ]),
    supportedExtensions: ['.pdf', '.docx', '.pptx'],
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint',
    ],
  },
  {
    number: 2,
    title: 'Market Validation',
    shortDescription:
      'Conduct surveys and interviews, analyze the market landscape, validate your value proposition and product-market fit.',
    icon: 'BarChart2',
    requirements: [
      'Survey / Interview',
      'Market Analysis',
      'Industry Outlook',
      'Market Trend',
      'Pricing',
      'Competitor Analysis',
      'Value Proposition',
      'Product-Market Fit',
    ],
    rubrics: buildCriteria([
      {
        key: 'targetCustomerDefinition',
        label: 'Target Customer Definition',
        weight: 20,
        description: 'How clearly the target users/customers are defined.',
      },
      {
        key: 'marketProblemAnalysis',
        label: 'Market Problem Analysis',
        weight: 20,
        description: 'Depth of analysis of the market pain points and opportunity.',
      },
      {
        key: 'marketResearchQuality',
        label: 'Market Research Quality',
        weight: 20,
        description: 'Quality and credibility of the research evidence.',
      },
      {
        key: 'problemSolutionFit',
        label: 'Problem-Solution Fit',
        weight: 20,
        description: 'How well the proposed solution matches the identified problem.',
      },
      {
        key: 'presentationLogic',
        label: 'Presentation & Logic',
        weight: 10,
        description: 'How logically and clearly the case is presented.',
      },
      {
        key: 'qaDiscussion',
        label: 'Q&A / Discussion',
        weight: 10,
        description: 'Ability to answer questions and defend the analysis.',
      },
    ]),
    supportedExtensions: ['.pdf', '.docx', '.pptx'],
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint',
    ],
  },
  {
    number: 3,
    title: 'Product & Business Model',
    shortDescription:
      'Document your product/solution, develop an MVP or prototype, and outline your Business Model Canvas.',
    icon: 'Layers',
    requirements: [
      'Product / Solution Description',
      'MVP / Prototype',
      'Business Model Canvas',
    ],
    rubrics: buildCriteria([
      {
        key: 'mvpPrototypeQuality',
        label: 'MVP / Prototype Quality',
        weight: 35,
        description: 'Usability, completeness, and readiness of the MVP or prototype.',
      },
      {
        key: 'businessModelClarity',
        label: 'Business Model Clarity',
        weight: 10,
        description: 'Clarity of the business model and monetisation logic.',
      },
      {
        key: 'businessModelCanvas',
        label: 'Business Model Canvas',
        weight: 40,
        description: 'Completeness and quality of the Business Model Canvas.',
      },
      {
        key: 'presentationDemo',
        label: 'Presentation & Demo',
        weight: 15,
        description: 'Quality of the presentation and the live demo.',
      },
    ]),
    supportedExtensions: ['.pdf', '.docx', '.pptx'],
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint',
    ],
  },
  {
    number: 4,
    title: 'Final Pitch',
    shortDescription:
      'Build your startup company profile, prepare your final pitch deck, and rehearse your presentation delivery.',
    icon: 'TrendingUp',
    requirements: [
      'Build startup company profile',
      'Prepare final pitch deck',
      'Present startup idea',
    ],
    rubrics: buildCriteria([
      {
        key: 'startupCompleteness',
        label: 'Startup Completeness',
        weight: 25,
        description: 'How complete and coherent the startup story and profile are.',
      },
      {
        key: 'businessFeasibility',
        label: 'Business Feasibility',
        weight: 20,
        description: 'Practicality and viability of the business plan and execution.',
      },
      {
        key: 'innovationCreativity',
        label: 'Innovation & Creativity',
        weight: 15,
        description: 'Originality and creative thinking behind the startup concept.',
      },
      {
        key: 'pitchStorytelling',
        label: 'Pitch & Storytelling',
        weight: 20,
        description: 'Impact, structure, and clarity of the pitch narrative.',
      },
      {
        key: 'qaDefense',
        label: 'Q&A & Defense',
        weight: 10,
        description: 'Quality of the defense during questions and discussion.',
      },
      {
        key: 'teamCoordination',
        label: 'Team Coordination',
        weight: 10,
        description: 'Collaboration, handoff, and coordination among team members.',
      },
    ]),
    supportedExtensions: ['.pdf', '.docx', '.pptx'],
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/msword',
      'application/vnd.ms-powerpoint',
    ],
  },
];

/**
 * Get config for a specific checkpoint number (1–4).
 * Returns null if not found.
 */
const getCheckpointConfig = (number) =>
  CHECKPOINTS.find((c) => c.number === parseInt(number, 10)) || null;

module.exports = { CHECKPOINTS, LEVEL_GUIDE, getCheckpointConfig };
