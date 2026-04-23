const mongoose = require('mongoose');
const User = require('./models/User'); // Ensure path is correct
const Course = require('./models/Course'); // Ensure path is correct
require('dotenv').config();

const migrateData = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("Connected to Database for migration...");

        const students = await User.find({ role: 'student' });
        console.log(`Found ${students.length} students to update.`);

        for (let student of students) {
            let updated = false;

            for (let enrollment of student.enrolledCourses) {
                // If courseName is missing but we have an ObjectId, fetch the name
                if (!enrollment.courseName && enrollment.course) {
                    const courseData = await Course.findById(enrollment.course);
                    if (courseData) {
                        enrollment.courseName = courseData.name;
                        updated = true;
                    }
                }
                
                // Ensure default progress if missing
                if (enrollment.progress === undefined) {
                    enrollment.progress = 0;
                    updated = true;
                }
            }

            if (updated) {
                await student.save();
                console.log(`Updated data for: ${student.email}`);
            }
        }

        console.log("Migration completed successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Migration failed:", err);
        process.exit(1);
    }
};

migrateData();