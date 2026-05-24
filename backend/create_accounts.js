const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Student = require('./src/models/Student');
const { PROGRAM_GROUPS } = require('./src/constants/majors');

const emails = [
  "hiepttde10600@fpt.edu.vn",
  "CuongLTE180006@fpt.edu.vn",
  "TienHDE180016@fpt.edu.vn",
  "VuongTBE180022@fpt.edu.vn",
  "QuanPDE180025@fpt.edu.vn",
  "QuynhTNDE180026@fpt.edu.vn",
  "NamNVE180028@fpt.edu.vn",
  "TungLTE180029@fpt.edu.vn",
  "AnhNKE180030@fpt.edu.vn",
  "BaoHGE180037@fpt.edu.vn",
  "CuongXDE180042@fpt.edu.vn",
  "TienNTE180046@fpt.edu.vn",
  "KhoaLME180055@fpt.edu.vn",
  "VanTDD180061@fpt.edu.vn",
  "TamTQE180165@fpt.edu.vn",
  "ThinhBMDE180185@fpt.edu.vn",
  "PhiTVDE180331@fpt.edu.vn",
  "HuyLTNDE180335@fpt.edu.vn",
  "KienLTDE180359@fpt.edu.vn",
  "VietTDDE180368@fpt.edu.vn",
  "HUNGNCQDE180400@fpt.edu.vn",
  "HieuTLDE180438@fpt.edu.vn",
  "ChauDBDE180529@fpt.edu.vn",
  "TaiTVE180532@fpt.edu.vn",
  "HungLBDE180535@fpt.edu.vn",
  "LoiPTD180537@fpt.edu.vn",
  "TaiNVD180565@fpt.edu.vn",
  "KhoaCDE180606@fpt.edu.vn",
  "HoangDHDE180637@fpt.edu.vn",
  "TienTVE180640@fpt.edu.vn",
  "KhanhGDE180641@fpt.edu.vn",
  "TrienQDE180808@fpt.edu.vn",
  "KhoaVDE180879@fpt.edu.vn"
];

// Flatten all available majors into an array
const allMajors = [];
for (const group in PROGRAM_GROUPS) {
  PROGRAM_GROUPS[group].majors.forEach(major => {
    allMajors.push({ major, programGroup: group });
  });
}

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    for (const email of emails) {
      const emailLower = email.toLowerCase();
      
      // Pick a random major
      const randomMajorObj = allMajors[Math.floor(Math.random() * allMajors.length)];
      
      const existingUser = await User.findOne({ email: emailLower });
      if (existingUser) {
        console.log(`User ${email} already exists. Updating major.`);
        existingUser.major = randomMajorObj.major;
        existingUser.programGroup = randomMajorObj.programGroup;
        await existingUser.save();
      } else {
        // Extract a name from email prefix
        const prefix = email.split('@')[0];
        const name = prefix;

        // Extract a student ID by finding the last letters and digits
        let studentId = prefix.toUpperCase();
        const match = prefix.match(/([a-zA-Z]+[0-9]+)$/i);
        if (match) {
          studentId = match[1].toUpperCase();
        }

        const newUser = new User({
          name: name,
          email: emailLower,
          password: '123456',
          role: 'STUDENT',
          studentId: studentId,
          programGroup: randomMajorObj.programGroup,
          major: randomMajorObj.major,
          isVerified: true
        });

        await newUser.save();
        console.log(`Created user ${email} with major ${randomMajorObj.major} and programGroup ${randomMajorObj.programGroup}`);
      }

      // Update Student collection if exists
      const studentResult = await Student.updateMany(
        { email: emailLower },
        { 
          $set: { 
            major: randomMajorObj.major, 
            programGroup: randomMajorObj.programGroup 
          } 
        }
      );
      if (studentResult.modifiedCount > 0) {
        console.log(`Updated Student records for ${email}`);
      }
    }

    console.log('All accounts created/updated successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

run();
