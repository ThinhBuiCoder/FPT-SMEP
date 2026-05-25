// src/config/checkpointConfig.js
// Static definitions for all 4 startup checkpoints.
// No database required — easy to update and maintain.

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
    rubrics: [],
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
    rubrics: [],
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
    rubrics: [
      'Quality of MVP / Prototype',
      'Quality of Business Model Canvas',
    ],
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
    rubrics: [
      'Final presentation quality',
      'Final exam requirements',
    ],
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

module.exports = { CHECKPOINTS, getCheckpointConfig };
