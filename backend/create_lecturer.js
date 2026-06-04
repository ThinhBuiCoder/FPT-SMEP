const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to DB');

    const email = 'suongntt91@fe.edu.vn';
    const emailLower = email.toLowerCase();
    
    let existingUser = await User.findOne({ email: emailLower });
    
    if (existingUser) {
      console.log(`User ${email} already exists. Updating...`);
      existingUser.role = 'LECTURER';
      existingUser.status = 'APPROVED';
      existingUser.isVerified = true;
      existingUser.password = '123456'; // Will be hashed by pre-save hook
      await existingUser.save();
      console.log('User updated successfully.');
    } else {
      console.log(`User ${email} does not exist. Creating...`);
      const newUser = new User({
        name: 'Suong NTT',
        email: emailLower,
        password: '123456',
        role: 'LECTURER',
        status: 'APPROVED',
        isVerified: true
      });
      await newUser.save();
      console.log('User created successfully.');
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    mongoose.disconnect();
  }
};

run();
