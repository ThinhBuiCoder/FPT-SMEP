// scripts/seedWeeklyTasks.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const mongoose = require('mongoose');
const WeeklyTask = require('../src/models/WeeklyTask');
const User = require('../src/models/User');

const syllabusData = [
  // Week 1
  {
    weekNumber: 1,
    title: 'Learn startup mindset',
    description: 'Understand the key characteristics of entrepreneurial thinking and startup foundations.',
    isMandatory: true,
  },
  {
    weekNumber: 1,
    title: 'Understand why startups fail',
    description: 'Study standard failure modes (lack of market need, cash exhaustion, team disharmony).',
    isMandatory: true,
  },
  {
    weekNumber: 1,
    title: 'Form startup team (4–6 members)',
    description: 'Assemble a team with complementary skillsets in software development, business development, and design.',
    isMandatory: true,
  },
  {
    weekNumber: 1,
    title: 'Assign team roles (CEO, CTO, CMO, COO)',
    description: 'Define co-founder roles, responsibilities, decision-making dynamics, and operational targets.',
    isMandatory: true,
  },
  {
    weekNumber: 1,
    title: 'Define startup direction',
    description: 'Select potential domains, industries, or broad technology spaces you want to explore.',
    isMandatory: false,
  },
  {
    weekNumber: 1,
    title: 'Attend entrepreneurship seminar',
    description: 'Participate in the introduction seminar to align on syllabus objectives and expectations.',
    isMandatory: false,
  },

  // Week 2
  {
    weekNumber: 2,
    title: 'Learn co-founder & team structure concepts',
    description: 'Understand organizational governance and equity split concepts for early co-founders.',
    isMandatory: false,
  },
  {
    weekNumber: 2,
    title: 'Brainstorm startup ideas',
    description: 'Conduct brainstorming sessions to list at least 3 potential startup business concepts.',
    isMandatory: true,
  },
  {
    weekNumber: 2,
    title: 'Identify customer pain points',
    description: 'Frame issues in terms of friction, cost, inefficiency, or missing infrastructure.',
    isMandatory: true,
  },
  {
    weekNumber: 2,
    title: 'Define target customers',
    description: 'Segment prospective audiences by demographics, professional domains, and behavior profiles.',
    isMandatory: true,
  },
  {
    weekNumber: 2,
    title: 'Checkpoint 1 - Present Startup Idea & Team Formation',
    description: 'Submit initial startup direction, present co-founder roles, and justify team structure to class.',
    isMandatory: true,
  },

  // Week 3
  {
    weekNumber: 3,
    title: 'Learn startup idea validation',
    description: 'Study methodology for testing critical assumptions before building products.',
    isMandatory: false,
  },
  {
    weekNumber: 3,
    title: 'Analyze startup market potential',
    description: 'Perform initial sizing to verify if the startup idea covers a sufficiently large market.',
    isMandatory: true,
  },
  {
    weekNumber: 3,
    title: 'Select final startup idea',
    description: 'Evaluate your brainstormed ideas and pick the single most promising startup domain to pursue.',
    isMandatory: true,
  },
  {
    weekNumber: 3,
    title: 'Present idea in class',
    description: 'Deliver a quick elevator pitch on your chosen startup idea to receive peer and lecturer feedback.',
    isMandatory: true,
  },
  {
    weekNumber: 3,
    title: 'Attend mentoring session',
    description: 'Sync with your team mentor to review the feasibility of the chosen problem statement.',
    isMandatory: true,
  },

  // Week 4
  {
    weekNumber: 4,
    title: 'Learn customer discovery',
    description: 'Understand the "Get Out of the Building" process to collect organic customer feedback.',
    isMandatory: false,
  },
  {
    weekNumber: 4,
    title: 'Learn product-market fit',
    description: 'Learn the relationship between customer segment desires and product value propositions.',
    isMandatory: false,
  },
  {
    weekNumber: 4,
    title: 'Conduct market research',
    description: 'Analyze industry reports, database metrics, and competitive landscapes.',
    isMandatory: true,
  },
  {
    weekNumber: 4,
    title: 'Interview target customers',
    description: 'Conduct at least 10 problem interviews with target customer segments.',
    isMandatory: true,
  },
  {
    weekNumber: 4,
    title: 'Analyze competitors',
    description: 'Map direct and indirect competitors based on features, pricing, and distribution channels.',
    isMandatory: true,
  },
  {
    weekNumber: 4,
    title: 'Validate customer pain points',
    description: 'Adjust your assumptions based on interview insights and update the target problem statement.',
    isMandatory: true,
  },

  // Week 5
  {
    weekNumber: 5,
    title: 'Learn market research methods',
    description: 'Study qualitative vs quantitative research approaches.',
    isMandatory: false,
  },
  {
    weekNumber: 5,
    title: 'Learn competitor analysis',
    description: 'Learn how to map competitive quadrants and identify market voids.',
    isMandatory: false,
  },
  {
    weekNumber: 5,
    title: 'Conduct real customer survey',
    description: 'Create and launch a survey targeting at least 30 respondents to validate pain point prevalence.',
    isMandatory: true,
  },
  {
    weekNumber: 5,
    title: 'Analyze market size & trends',
    description: 'Calculate TAM (Total Addressable Market), SAM, and SOM metrics for your startup.',
    isMandatory: true,
  },
  {
    weekNumber: 5,
    title: 'Define value proposition',
    description: 'Specify the unique combination of features and benefits that sets your startup apart.',
    isMandatory: true,
  },
  {
    weekNumber: 5,
    title: 'Checkpoint 2 - Market Validation',
    description: 'Submit customer research databases, competitor matrices, market sizes, and pricing insights.',
    isMandatory: true,
  },

  // Week 6
  {
    weekNumber: 6,
    title: 'Learn MVP & prototyping',
    description: 'Understand the concept of Minimum Viable Product to test core mechanics with minimal effort.',
    isMandatory: false,
  },
  {
    weekNumber: 6,
    title: 'Build startup prototype',
    description: 'Assemble wireframes, landing pages, or high-fidelity interactive UI screens using Figma/No-Code.',
    isMandatory: true,
  },
  {
    weekNumber: 6,
    title: 'Collect user feedback',
    description: 'Demonstrate prototype to 5 prospective users and log friction points.',
    isMandatory: true,
  },
  {
    weekNumber: 6,
    title: 'Iterate product based on feedback',
    description: 'Refine workflow logic, copy, or visual layout according to user friction logs.',
    isMandatory: true,
  },
  {
    weekNumber: 6,
    title: 'Improve MVP usability',
    description: 'Optimize the startup solution flows to highlight the core value proposition.',
    isMandatory: false,
  },

  // Week 7
  {
    weekNumber: 7,
    title: 'Learn business model concepts',
    description: 'Understand the Business Model Canvas structure (key partners, activities, costs, channels).',
    isMandatory: false,
  },
  {
    weekNumber: 7,
    title: 'Learn startup pricing strategy',
    description: 'Select premium, freemium, B2B licensing, or B2C transactional models.',
    isMandatory: false,
  },
  {
    weekNumber: 7,
    title: 'Complete Business Model Canvas',
    description: 'Map out the complete BMC describing how the startup creates, delivers, and captures value.',
    isMandatory: true,
  },
  {
    weekNumber: 7,
    title: 'Finalize MVP',
    description: 'Lock in features, deploy code or launch the mock platform, ensuring it is ready to demonstrate.',
    isMandatory: true,
  },
  {
    weekNumber: 7,
    title: 'Checkpoint 3 - Product & Business Model',
    description: 'Present deployed MVP, technical details, Business Model Canvas, and detailed monetization schemes.',
    isMandatory: true,
  },

  // Week 8
  {
    weekNumber: 8,
    title: 'Learn fundraising basics',
    description: 'Study VC dynamics, angel rounds, safe notes, and equity dilution.',
    isMandatory: false,
  },
  {
    weekNumber: 8,
    title: 'Learn investor thinking',
    description: 'Understand what factors investors prioritize (market size, team traction, prototype clarity).',
    isMandatory: false,
  },
  {
    weekNumber: 8,
    title: 'Improve pitch deck',
    description: 'Incorporate lecturer and mentor feedback into the financial slides of the pitch deck.',
    isMandatory: true,
  },
  {
    weekNumber: 8,
    title: 'Finalize business model',
    description: 'Double check financial unit economics and customer acquisition cost forecasts.',
    isMandatory: true,
  },
  {
    weekNumber: 8,
    title: 'Build fundraising plan',
    description: 'Determine funding target, capital use categories, and projected milestones.',
    isMandatory: true,
  },

  // Week 9
  {
    weekNumber: 9,
    title: 'Learn startup finance basics',
    description: 'Learn income statements, burn rate calculation, and cash flow projections.',
    isMandatory: false,
  },
  {
    weekNumber: 9,
    title: 'Learn startup legal concepts',
    description: 'Review registration models, trademark protections, and licensing agreements in Vietnam.',
    isMandatory: false,
  },
  {
    weekNumber: 9,
    title: 'Learn startup leadership',
    description: 'Understand founder alignment, conflict resolution, and motivational leadership.',
    isMandatory: false,
  },
  {
    weekNumber: 9,
    title: 'Attend mentoring sessions',
    description: 'Run final pitch rehearsals with your team mentor to check slide timing.',
    isMandatory: true,
  },
  {
    weekNumber: 9,
    title: 'Finalize pitch deck',
    description: 'Perform a full review of all 10-12 key slides, ensuring high-quality design and data.',
    isMandatory: true,
  },

  // Week 10
  {
    weekNumber: 10,
    title: 'Learn startup pitching',
    description: 'Master stage presence, question handling, and slide synchronization.',
    isMandatory: false,
  },
  {
    weekNumber: 10,
    title: 'Learn storytelling techniques',
    description: 'Learn how to hook audiences with custom anecdotes and validation metrics.',
    isMandatory: false,
  },
  {
    weekNumber: 10,
    title: 'Present startup to instructors & mentors',
    description: 'Pitch your startup simulation dynamically during class rehearsals.',
    isMandatory: true,
  },
  {
    weekNumber: 10,
    title: 'Checkpoint 4 - Final Pitch',
    description: 'Pitch to instructors, external VCs, and mentors. Cover PMF, monetization, operations, and scale.',
    isMandatory: true,
  },
];

const seedRoadmap = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected for Weekly Tasks seeding');

    // Fetch an Admin to set as createdBy
    const admin = await User.findOne({ role: 'ADMIN' });
    if (!admin) {
      console.log('❌ Seeding cancelled: Please run standard seed.js first to create system Admin.');
      process.exit(1);
    }

    // Clear existing templates for EXE101
    await WeeklyTask.deleteMany({
      taskType: 'COURSE_TEMPLATE',
      courseCode: 'EXE101',
    });
    console.log('🗑️ Cleared existing EXE101 COURSE_TEMPLATE tasks');

    // Map syllabus data to model schema
    const tasksToCreate = syllabusData.map((task) => ({
      ...task,
      taskType: 'COURSE_TEMPLATE',
      scope: 'COURSE',
      courseCode: 'EXE101',
      createdBy: admin._id,
      status: 'TODO',
      priority: task.title.includes('Checkpoint') ? 'CRITICAL' : 'MEDIUM',
      visibleToStudents: true,
      isTemplate: true,
    }));

    const seededTasks = await WeeklyTask.insertMany(tasksToCreate);
    console.log(`🎉 Successfully seeded ${seededTasks.length} COURSE_TEMPLATE roadmap tasks for EXE101!`);

  } catch (err) {
    console.error('❌ Weekly Tasks Seeding failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
};

seedRoadmap();
