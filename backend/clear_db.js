require('dotenv').config();
const mongoose = require('mongoose');
const Class = require('./src/models/Class');
const Student = require('./src/models/Student');
const Team = require('./src/models/Team');

mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to DB...');
    
    const classRes = await Class.deleteMany({});
    console.log('✅ Deleted classes:', classRes.deletedCount);
    
    const studentRes = await Student.deleteMany({});
    console.log('✅ Deleted students:', studentRes.deletedCount);
    
    const teamRes = await Team.deleteMany({});
    console.log('✅ Deleted teams:', teamRes.deletedCount);
    
    console.log('All clear! Ready for import.');
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
