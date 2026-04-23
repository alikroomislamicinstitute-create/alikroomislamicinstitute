const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const User = require('./models/User'); // Correct: looks in the models folder inside Backend
require('dotenv').config(); // Correct: looks for .env in the Backend folder

const adminData = {
    firstName: "Al-Ikroom",
    lastName: "Admin",
    email: "alikroomislamicinstitute@gmail.com",
    password: "Al-ikroom1234",
    role: "admin",
    gender: "Male",
    nationality: "Nigerian"
};

async function createMainAdmin() {
    try {
        // Safety check for the connection string
        if (!process.env.MONGO_URI) {
            console.error("❌ Error: MONGO_URI is not defined in your .env file!");
            process.exit(1);
        }

        console.log("Connecting to MongoDB...");
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected successfully!");

        // Check if this specific email already exists
        const existing = await User.findOne({ email: adminData.email });
        if (existing) {
            console.log("ℹ️ Admin account already exists. No changes made.");
            process.exit();
        }

        // Hash the password manually for the first admin
        console.log("Hashing password...");
        const salt = await bcrypt.genSalt(10);
        adminData.password = await bcrypt.hash(adminData.password, salt);

        // Create the user
        await User.create(adminData);
        console.log("✅ Admin account created successfully!");
        process.exit();
        
    } catch (err) {
        console.error("❌ Error creating admin:", err);
        process.exit(1);
    }
}

createMainAdmin();