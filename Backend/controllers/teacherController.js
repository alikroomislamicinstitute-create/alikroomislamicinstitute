const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Course = require('../models/Course');
const Resource = require('../models/Resource'); // Make sure this path is correct

// ===============================
// GET /api/teacher/dashboard-data
// ===============================
router.get('/dashboard-data', async (req, res) => {
    try {
        // req.user.id comes from auth middleware
        const teacher = await User.findById(req.user.id);

        if (!teacher) {
            return res.status(404).json({ 
                success: false, 
                message: "Teacher not found" 
            });
        }

        // 1. Fetch courses managed by this teacher
        const managedCourses = await Course.find({ teacherId: teacher._id });

        // ✅ Support BOTH systems (ID + Name)
        const managedCourseIds = managedCourses.map(c => c._id);
        const managedCourseNames = managedCourses.map(c => c.name);

        // 2. Fetch students enrolled in ANY of these courses
        const students = await User.find({
            role: 'student',
            $or: [
                { 'enrolledCourses.courseName': { $in: managedCourseNames } },
                { 'enrolledCourses.course': { $in: managedCourseIds } }
            ]
        }).select('firstName lastName email enrolledCourses');

        // 3. NEW: Fetch ONLY resources uploaded by this specific teacher
        const resources = await Resource.find({
            uploadedBy: teacher._id 
        });

        res.status(200).json({
            success: true,
            teacherName: teacher.firstName + " " + teacher.lastName,
            managedCourses: managedCourses,
            students: students,
            resources: resources, // Added to the response
            totalEnrolled: students.length
        });

    } catch (error) {
        console.error("❌ Dashboard Data Error:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error" 
        });
    }
});


// ============================================
// PUT /api/teacher/students/progress/:studentId
// ============================================
router.put('/students/progress/:studentId', async (req, res) => {
    try {
        const { studentId } = req.params;
        const { courseId, courseName, progress } = req.body;

        // ✅ Support BOTH ID-based and Name-based systems
        const updatedStudent = await User.findOneAndUpdate(
            { 
                _id: studentId,
                $or: [
                    { "enrolledCourses.course": courseId },      // ID system
                    { "enrolledCourses.courseName": courseName } // Name system
                ]
            },
            { 
                $set: { "enrolledCourses.$.progress": progress } 
            },
            { returnDocument: 'after' } // ✅ FIXED: Replaced { new: true } to clear deprecation warning
        );

        if (!updatedStudent) {
            return res.status(404).json({ 
                success: false, 
                message: "Student not enrolled in this course or student not found" 
            });
        }

        res.json({ 
            success: true, 
            message: "Progress updated successfully!" 
        });

    } catch (err) {
        console.error("❌ Progress Sync Error:", err);
        res.status(500).json({ 
            success: false, 
            error: err.message 
        });
    }
});

// ============================================
// NEW: POST /api/teacher/upload-resource
// ============================================
router.post('/upload-resource', async (req, res) => {
    try {
        let { title, course, isForAllStudents, selectedStudents } = req.body;

// FIX: normalize selectedStudents
if (!selectedStudents) {
    selectedStudents = [];
} else if (!Array.isArray(selectedStudents)) {
    selectedStudents = [selectedStudents];
}

        const resource = await Resource.create({
            title,
            fileUrl,
            course, // Needed for your existing route logic
            uploadedBy: req.user.id, // Maps to the "teacher" field in your logic
            targetStudents: isForAllStudents ? [] : selectedStudents,
            isForAllStudents
        });

        res.status(201).json({
            success: true,
            message: "Resource uploaded successfully",
            resource
        });

    } catch (err) {
        console.error("❌ Upload Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to upload resource" 
        });
    }
});

module.exports = router;