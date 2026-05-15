// src/server.js — Entry point (MongoDB version)
require('dotenv').config();
const connectDB = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const start = async () => {
  await connectDB();
  app.listen(PORT, () => {
    console.log('\n🚀 ─────────────────────────────────────');
    console.log(`   FPT Startup Platform API`);
    console.log(`   http://localhost:${PORT}`);
    console.log(`   DB: MongoDB`);
    console.log('─────────────────────────────────────\n');
  });
};

process.on('SIGINT', () => { console.log('\n👋 Bye!'); process.exit(0); });
start();
