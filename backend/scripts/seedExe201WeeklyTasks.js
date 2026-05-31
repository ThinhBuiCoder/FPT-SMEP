// scripts/seedExe201WeeklyTasks.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const WeeklyTask = require('../src/models/WeeklyTask');
const User = require('../src/models/User');

const normalizeTaskTitle = (title) =>
  title?.trim().toLowerCase().replace(/\s+/g, ' ');

const exe201SyllabusData = [
  {
    weekNumber: 1,
    title: 'Create startup execution plan',
    description: 'Define implementation roadmap, milestones, responsibilities, and expected outcomes for the startup project.',
    isMandatory: true,
  },
  {
    weekNumber: 1,
    title: 'Review current startup progress',
    description: 'Evaluate the startup status inherited from EXE101 and compare it with the implementation plan.',
    isMandatory: true,
  },
  {
    weekNumber: 1,
    title: 'Attend entrepreneurship seminar',
    description: 'Attend the guest speaker seminar and prepare questions related to startup execution.',
    isMandatory: false,
  },
  {
    weekNumber: 2,
    title: 'Study startup product design',
    description: 'Review startup product design principles and user experience concepts.',
    isMandatory: false,
  },
  {
    weekNumber: 2,
    title: 'Continue building product or service',
    description: 'Develop product or service features according to the startup implementation plan.',
    isMandatory: true,
  },
  {
    weekNumber: 2,
    title: 'Update implementation plan based on feedback',
    description: 'Modify the execution plan according to lecturer comments and project progress.',
    isMandatory: true,
  },
  {
    weekNumber: 3,
    title: 'Build product MVP',
    description: 'Develop core product or service features required for initial launch.',
    isMandatory: true,
  },
  {
    weekNumber: 3,
    title: 'Prepare launch channel list',
    description: 'Identify possible channels for launching the product or service to real users.',
    isMandatory: true,
  },
  {
    weekNumber: 3,
    title: 'Attend mentoring session 1',
    description: 'Prepare questions, discuss product execution with mentor, and apply mentor guidance to the project.',
    isMandatory: true,
  },
  {
    weekNumber: 4,
    title: 'Conduct market analysis',
    description: 'Analyze target market, customer segments, problem statement, and market insights.',
    isMandatory: true,
  },
  {
    weekNumber: 4,
    title: 'Select launch channels',
    description: 'Choose the most suitable launch channels for customer acquisition.',
    isMandatory: true,
  },
  {
    weekNumber: 4,
    title: 'Improve product based on market insights',
    description: 'Refine the product or service if needed based on lecturer feedback and market analysis.',
    isMandatory: true,
  },
  {
    weekNumber: 5,
    title: 'Launch product to first customers',
    description: 'Deploy the product or service through selected channels and approach early customers.',
    isMandatory: true,
  },
  {
    weekNumber: 5,
    title: 'Present Outcome 2',
    description: 'Present launch situation, selected channels, methods, cost, market fit, customer target, and preliminary feedback.',
    isMandatory: true,
  },
  {
    weekNumber: 5,
    title: 'Collect preliminary customer feedback',
    description: 'Collect early feedback from real users or potential customers after launch.',
    isMandatory: true,
  },
  {
    weekNumber: 6,
    title: 'Continue customer acquisition',
    description: 'Keep launching the product or service on selected channels to acquire more users or customers.',
    isMandatory: true,
  },
  {
    weekNumber: 6,
    title: 'Improve product based on feedback',
    description: 'Apply feedback to improve product quality, usability, or service value.',
    isMandatory: true,
  },
  {
    weekNumber: 6,
    title: 'Track user and growth metrics',
    description: 'Measure users, signups, leads, customer interest, sales, or other relevant growth metrics.',
    isMandatory: true,
  },
  {
    weekNumber: 7,
    title: 'Prepare customer feedback form',
    description: 'Create a feedback form and send it to at least 20 people.',
    isMandatory: true,
  },
  {
    weekNumber: 7,
    title: 'Analyze customer feedback',
    description: 'Collect feedback answers and analyze customer problems, satisfaction, and improvement opportunities.',
    isMandatory: true,
  },
  {
    weekNumber: 7,
    title: 'Continue product launch activities',
    description: 'Keep improving and launching the product or service on selected channels.',
    isMandatory: true,
  },
  {
    weekNumber: 8,
    title: 'Set startup KPIs and goals',
    description: 'Define measurable KPIs such as users, customers, conversion rate, sales, retention, or engagement.',
    isMandatory: true,
  },
  {
    weekNumber: 8,
    title: 'Create product improvement plan',
    description: 'Prepare an improvement plan based on feedback analysis and KPI results.',
    isMandatory: true,
  },
  {
    weekNumber: 8,
    title: 'Attend startup seminar',
    description: 'Attend seminar about market research, MVP, time-to-market, fundraising, or venture investment.',
    isMandatory: false,
  },
  {
    weekNumber: 9,
    title: 'Measure startup growth',
    description: 'Evaluate customer acquisition, product performance, feedback results, and growth progress.',
    isMandatory: true,
  },
  {
    weekNumber: 9,
    title: 'Prepare final report',
    description: 'Compile startup implementation, product development, launch activities, customer feedback, and sales evidence.',
    isMandatory: true,
  },
  {
    weekNumber: 9,
    title: 'Prepare final pitch deck',
    description: 'Create pitch deck summarizing the startup project, product, customers, feedback, growth, and results.',
    isMandatory: true,
  },
  {
    weekNumber: 10,
    title: 'Present startup project and results',
    description: 'Present the startup project, implemented product, launch process, customer results, feedback, and lessons learned.',
    isMandatory: true,
  },
  {
    weekNumber: 10,
    title: 'Submit final startup report',
    description: 'Submit final report with sales results, customer evidence, feedback analysis, and supporting proof.',
    isMandatory: true,
  },
  {
    weekNumber: 10,
    title: 'Final Startup Evaluation',
    description: 'Complete final evaluation by presenting startup implementation results to instructor and mentor.',
    isMandatory: true,
  },
];

const getPriority = (title) => (
  title.includes('Outcome') || title.includes('Checkpoint') || title.includes('Final')
    ? 'CRITICAL'
    : 'MEDIUM'
);

const seedExe201Roadmap = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for EXE201 Weekly Tasks seeding');

    const admin = await User.findOne({ role: 'ADMIN' });
    if (!admin) {
      console.log('Seeding cancelled: Please run standard seed.js first to create system Admin.');
      process.exit(1);
    }

    await WeeklyTask.deleteMany({
      taskType: 'COURSE_TEMPLATE',
      courseCode: 'EXE201',
    });
    console.log('Cleared existing EXE201 COURSE_TEMPLATE tasks');

    const tasksToCreate = exe201SyllabusData.map((task) => ({
      ...task,
      titleNormalized: normalizeTaskTitle(task.title),
      taskType: 'COURSE_TEMPLATE',
      scope: 'COURSE',
      courseCode: 'EXE201',
      createdBy: admin._id,
      status: 'TODO',
      priority: getPriority(task.title),
      visibleToStudents: true,
      isTemplate: true,
    }));

    const seededTasks = await WeeklyTask.insertMany(tasksToCreate);
    console.log(`Successfully seeded ${seededTasks.length} COURSE_TEMPLATE roadmap tasks for EXE201.`);
  } catch (err) {
    console.error('EXE201 Weekly Tasks seeding failed:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

seedExe201Roadmap();
