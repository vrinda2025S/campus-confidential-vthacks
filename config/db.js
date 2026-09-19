require('dotenv').config();
const mongoose = require('mongoose');

async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('DB connected');
  } catch (err) {
    console.error('DB connection error:', err.message);
    process.exit(1);
  }
}

module.exports = connectDB;

if (require.main === module) {
  connectDB();
}
