// src/seed.js — Seed database với dữ liệu mẫu (MongoDB/Mongoose)
require('dotenv').config();
const mongoose = require('mongoose');

// Import models
const User             = require('./models/User');
const Class            = require('./models/Class');
const Team             = require('./models/Team');
const StartupIdea      = require('./models/StartupIdea');
const Evaluation       = require('./models/Evaluation');
const AiAnalysis       = require('./models/AiAnalysis');
const MentoringSession = require('./models/MentoringSession');
const Milestone        = require('./models/Milestone');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected for seeding');

    // ── CLEANUP ──────────────────────────────────────────
    await Promise.all([
      User.deleteMany(), Class.deleteMany(), Team.deleteMany(),
      StartupIdea.deleteMany(), Evaluation.deleteMany(),
      AiAnalysis.deleteMany(), MentoringSession.deleteMany(), Milestone.deleteMany(),
    ]);
    console.log('🗑️  Cleared existing data');

    // ── USERS ─────────────────────────────────────────────
    // NOTE: password pre-save hook sẽ tự hash
    const [admin, lecturer, mentor, s1, s2, s3] = await User.create([
      {
        name: 'Admin FPT', email: 'admin@fpt.edu.vn', password: '123456',
        role: 'ADMIN', bio: 'System Administrator',
      },
      {
        name: 'TS. Nguyễn Văn Minh', email: 'lecturer@fpt.edu.vn', password: '123456',
        role: 'LECTURER', bio: 'Giảng viên Khởi nghiệp - ĐH FPT', phone: '0901234567',
      },
      {
        name: 'Nguyễn Mentor', email: 'mentor@fpt.edu.vn', password: '123456',
        role: 'MENTOR', bio: 'Expert Startup Mentor - 10 years experience', phone: '0908889999',
      },
      {
        name: 'Trần Thị Lan', email: 'student1@fpt.edu.vn', password: '123456',
        role: 'STUDENT', studentId: 'SE171234', bio: 'Software Engineering - K17',
      },
      {
        name: 'Lê Văn Hùng', email: 'student2@fpt.edu.vn', password: '123456',
        role: 'STUDENT', studentId: 'SE171235', bio: 'Software Engineering - K17',
      },
      {
        name: 'Phạm Thị Mai', email: 'student3@fpt.edu.vn', password: '123456',
        role: 'STUDENT', studentId: 'BA171236', bio: 'Business Administration - K17',
      },
    ]);
    console.log('✅ Users created (6)');

    // ── CLASS ─────────────────────────────────────────────
    const cls = await Class.create({
      name: 'Startup Idea Development',
      code: 'ENT301_K17_01',
      semester: 'Fall 2024',
      description: 'Lớp học phát triển ý tưởng khởi nghiệp và xây dựng Startup MVP',
      lecturerId: lecturer._id,
      members: [s1._id, s2._id, s3._id],
    });
    console.log('✅ Class created');

    // ── TEAM ──────────────────────────────────────────────
    const team = await Team.create({
      classId: cls._id,
      name: 'EduTech Innovators',
      description: 'Nhóm phát triển giải pháp EdTech cho thị trường Việt Nam',
      members: [
        { userId: s1._id, roleInTeam: 'CEO' },
        { userId: s2._id, roleInTeam: 'CTO' },
        { userId: s3._id, roleInTeam: 'CMO' },
      ],
    });
    console.log('✅ Team created');

    // ── STARTUP IDEA ──────────────────────────────────────
    const idea = await StartupIdea.create({
      teamId: team._id,
      startupName: 'LearnSphere VN',
      problem:
        'Sinh viên Việt Nam gặp khó khăn tiếp cận tài liệu học tập chất lượng cao và thiếu nền tảng kết nối mentor-mentee hiệu quả trong lĩnh vực công nghệ. 80% sinh viên IT cho biết không có mentor phù hợp.',
      targetCustomer:
        'Sinh viên đại học chuyên ngành IT tại Việt Nam (18-24 tuổi), đặc biệt tại TP.HCM và Hà Nội. Tập trung sinh viên năm 2-4 tìm kiếm định hướng nghề nghiệp.',
      solution:
        'Nền tảng học tập kết hợp AI: (1) Cá nhân hóa lộ trình học dựa trên mục tiêu nghề nghiệp, (2) Kết nối mentor là senior dev từ công ty top VN, (3) Project-based learning với AI code review, (4) Community learning peer review.',
      businessModel:
        'Freemium: Miễn phí (5 khóa/tháng), Premium 99k/tháng (unlimited + mentor), Enterprise 500k/tháng (nhóm 5+). B2B: Partnership FPT, VNPT, Viettel.',
      technology:
        'Frontend: React Native + NextJS. Backend: Node.js + MongoDB + Redis. AI: GPT-4 API. Infrastructure: AWS + CloudFront CDN.',
      marketAnalysis:
        'EdTech VN đạt $3 tỷ USD năm 2023, tăng 15%/năm. 2.7M sinh viên đại học, 800k ngành CNTT. TAM: $150M, SAM: $30M, SOM: $3M (3 năm). Penetration rate <5%.',
      competitors:
        'Topcoder (global, không tiếng Việt), Udemy (thiếu mentorship), CoderSchool (bootcamp, phí cao 15-30M), F8 (free content, thiếu mentorship). Lợi thế: Local + AI personalization + Affordable.',
      stage: 'MVP',
      status: 'SUBMITTED',
      submittedAt: new Date(),
    });
    console.log('✅ Startup idea created');

    // ── AI ANALYSIS ───────────────────────────────────────
    await AiAnalysis.create({
      startupIdeaId: idea._id,
      strengths: [
        'Thị trường EdTech VN tăng trưởng mạnh, TAM đáng kể ($150M)',
        'Mô hình freemium phù hợp thu nhập sinh viên Việt Nam',
        'Kết hợp AI + Mentorship là xu hướng toàn cầu đang bùng nổ',
        'Team có nền tảng kỹ thuật tốt (CTO - SE background)',
        'Đã xác định rõ target customer segment và pain point',
      ],
      weaknesses: [
        'Thị trường cạnh tranh cao với nhiều player đã established',
        'Chi phí thu hút và giữ chân mentor chất lượng có thể cao',
        'Cần nguồn vốn lớn cho AI infrastructure',
        'Chưa có validated revenue model từ market test thực tế',
      ],
      feasibilityAnalysis:
        'Dự án có tính khả thi kỹ thuật cao, team đủ năng lực xây MVP trong 3-4 tháng với budget hợp lý (~50-100M VNĐ). Rủi ro chính: thu hút mentor chất lượng và content library. Recommend pilot tại FPT University trước khi scale.',
      marketPotential:
        'Với 800k sinh viên IT, conversion 3% ở 99k/tháng = 24M revenue/tháng (~$1M/năm). B2B channel với FPT, VNG mang lại revenue ổn định. Vietnam digital economy tăng 25%/năm - timing rất tốt.',
      risks: [
        'Cạnh tranh từ Coursera, edX nếu họ localize cho VN',
        'Khó retain mentor chất lượng cao lâu dài',
        'User acquisition cost cao giai đoạn đầu',
        'Privacy và data regulations ngày càng chặt',
        'Dependency vào OpenAI API (cost và reliability)',
      ],
      similarIdeas: [
        { name: 'CoderSchool', similarity: 65, notes: 'Bootcamp model, phí cao hơn nhiều' },
        { name: 'F8 - Fullstack.edu.vn', similarity: 70, notes: 'Free content, thiếu mentorship cá nhân hóa' },
        { name: 'Topdev Learning', similarity: 55, notes: 'Tập trung job board hơn là learning platform' },
      ],
      suggestions: [
        '🎯 Bắt đầu với Community MVP: Forum + Resource sharing miễn phí để build user base',
        '🤝 Partner FPT Software/Education để có mentor network ngay từ đầu',
        '🎯 Focus 1 tech stack (Web Dev) trước, mở rộng sau khi có traction',
        '🎮 Thêm gamification (badges, leaderboard) để tăng engagement',
        '🚀 Pilot tại FPT University - "warm market" dễ tiếp cận nhất',
        '📊 Define North Star Metric ngay từ đầu (DAU, course completion rate)',
      ],
      aiScore: 74,
      model: 'mock',
    });
    console.log('✅ AI Analysis created');

    // ── EVALUATION ────────────────────────────────────────
    await Evaluation.create({
      startupIdeaId: idea._id,
      lecturerId: lecturer._id,
      innovationScore: 8.0,
      feasibilityScore: 7.5,
      marketScore: 8.5,
      technicalScore: 8.0,
      presentationScore: 7.0,
      // totalScore auto-calculated by pre-save hook = 7.8
      comment:
        'Ý tưởng tiềm năng, nghiên cứu kỹ. Business model freemium phù hợp thị trường VN. Cần làm rõ chiến lược giữ chân mentor và kế hoạch tài chính 6 tháng đầu. Market Analysis ấn tượng với TAM/SAM/SOM. Gợi ý: thêm customer interview evidence để strengthen proposal.',
    });
    console.log('✅ Evaluation created');

    // ── MILESTONES ────────────────────────────────────────
    const now = new Date();
    await Milestone.create([
      {
        teamId: team._id, title: 'Market Research & Validation',
        description: 'Phỏng vấn 50 sinh viên, 10 mentor tiềm năng. Validate pain point & willingness to pay.',
        dueDate: new Date(now - 7 * 24 * 3600 * 1000), status: 'DONE',
      },
      {
        teamId: team._id, title: 'Business Model Canvas',
        description: 'Hoàn thiện BMC, xác định revenue streams, cost structure và key partnerships.',
        dueDate: new Date(now - 3 * 24 * 3600 * 1000), status: 'DONE',
      },
      {
        teamId: team._id, title: 'MVP Prototype (Wireframe)',
        description: 'Thiết kế wireframe 5 màn hình chính: Home, Course List, Mentor, Profile, Dashboard.',
        dueDate: new Date(now + 7 * 24 * 3600 * 1000), status: 'IN_PROGRESS',
      },
      {
        teamId: team._id, title: 'Pitch Deck v1',
        description: 'Hoàn thiện pitch deck 10 slides cho buổi demo Week 8.',
        dueDate: new Date(now + 14 * 24 * 3600 * 1000), status: 'TODO',
      },
      {
        teamId: team._id, title: 'Technical Architecture',
        description: 'Thiết kế system architecture, database schema, API design cho MVP.',
        dueDate: new Date(now - 1 * 24 * 3600 * 1000), status: 'IN_PROGRESS', // will show OVERDUE
      },
    ]);
    console.log('✅ Milestones created (5)');

    // ── MENTORING SESSION ─────────────────────────────────
    await MentoringSession.create({
      teamId: team._id,
      lecturerId: lecturer._id,
      title: 'Mentoring #1 - Review Business Model',
      meetingDate: new Date(now - 5 * 24 * 3600 * 1000),
      meetingUrl: 'https://meet.google.com/abc-defg-hij',
      notes:
        'Nhóm present Business Model Canvas. Điểm mạnh: Market analysis rõ ràng, có số liệu. Cần cải thiện: Revenue projection chưa realistic. Thảo luận GTM strategy: focus FPT University ecosystem trước.',
      actionItems: [
        { item: 'Tính lại CAC và LTV dựa trên survey data', done: true },
        { item: 'Phỏng vấn thêm 10 sinh viên về willingness to pay', done: true },
        { item: 'Draft partnership proposal gửi FPT Software HR', done: false },
        { item: 'Cập nhật financial projection Q1-Q4 2025', done: false },
      ],
    });
    console.log('✅ Mentoring session created');

    console.log('\n🎉 ─── SEED COMPLETED ───────────────────');
    console.log('📧 Test accounts:');
    console.log('   admin@fpt.edu.vn    / 123456  [ADMIN]');
    console.log('   lecturer@fpt.edu.vn / 123456  [LECTURER]');
    console.log('   mentor@fpt.edu.vn   / 123456  [MENTOR]');
    console.log('   student1@fpt.edu.vn / 123456  [STUDENT]');
    console.log('   student2@fpt.edu.vn / 123456  [STUDENT]');
    console.log('   student3@fpt.edu.vn / 123456  [STUDENT]');
    console.log('────────────────────────────────────────\n');
  } catch (err) {
    console.error('❌ Seed failed:', err);
  } finally {
    await mongoose.disconnect();
  }
};

seed();
