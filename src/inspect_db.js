const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const MONGO_URI = process.env.MONGO_URI;

async function main() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(MONGO_URI);
  console.log("Connected successfully!");

  const User = require('./models/User');

  // 1. Find user gongmya11
  const user = await User.findOne({ username: 'gongmya11' });
  if (user) {
    console.log("Found user gongmya11:", {
      _id: user._id,
      username: user.username,
      email: user.email,
      passwordHash: user.password
    });

    // Try bcrypt compare
    const match = await bcrypt.compare('password123', user.password);
    console.log("Does 'password123' match password hash?", match);
  } else {
    console.log("User gongmya11 not found.");
  }

  // 2. Create clean user 'testlogin' / 'testlogin@example.com' / 'test12345'
  const testUsername = 'testlogin';
  const testEmail = 'testlogin@example.com';
  const testPassword = 'test12345';

  await User.deleteOne({ $or: [{ username: testUsername }, { email: testEmail }] });

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(testPassword, salt);

  const newUser = new User({
    username: testUsername,
    email: testEmail,
    password: hashedPassword
  });

  await newUser.save();
  console.log("Created test user:", testUsername);

  // Validate password match
  const testUser = await User.findOne({ username: testUsername });
  const testMatch = await bcrypt.compare(testPassword, testUser.password);
  console.log("Does 'test12345' match for new test user?", testMatch);

  // 3. Delete existing 'gongmya11' and re-create it with password123 to clean it
  await User.deleteOne({ username: 'gongmya11' });
  const salt2 = await bcrypt.genSalt(10);
  const hashedPassword2 = await bcrypt.hash('password123', salt2);
  const cleanGongmya = new User({
    username: 'gongmya11',
    email: 'gongmya11@example.com',
    password: hashedPassword2
  });
  await cleanGongmya.save();
  console.log("Re-created clean gongmya11 user with password123!");

  await mongoose.disconnect();
}

main().catch(err => {
  console.error("Error in script:", err);
  process.exit(1);
});
