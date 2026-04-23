const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Announcement = require('../models/Announcement');
const Resource = require('../models/Resource');
const User = require('../models/User');
const { verifyToken } = require('../middleware/authMiddleware');

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        cb(null, dir); 
    },
    filename: (req, file, cb) => {
        // Keeps file names unique using a timestamp and removing spaces
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// ==========================================
// DASHBOARD & STUDENT MANAGEMENT
// ==========================================

// 1. GET Teacher Dashboard Data (SECURE)
router.get('/dashboard-data', verifyToken, async (req, res) => {
    try {
        const teacher = await User.findById(req.user.id); 

        if (!teacher || teacher.role !== 'teacher') {
            return res.status(404).json({ success: false, message: "Teacher account not found" });
        }

        const myCourseNames = teacher.managedCourses.map(c => c.name);

        const students = await User.find({
            role: 'student',
            "enrolledCourses.courseName": { $in: myCourseNames }
        }).select('-password');

        res.json({ 
            success: true, 
            teacherName: teacher.firstName, 
            managedCourses: teacher.managedCourses, 
            students: students,
            totalEnrolled: students.length 
        });
    } catch (err) {
        console.error("❌ Dashboard Data Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Update Student Progress
router.put('/students/progress/:id', verifyToken, async (req, res) => {
    try {
        const { courseName, progress } = req.body;
        
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.params.id, "enrolledCourses.courseName": courseName },
            { $set: { "enrolledCourses.$.progress": progress } },
            { new: true }
        ).select('-password');

        if (!updatedUser) {
            return res.status(404).json({ success: false, message: "Student or course not found" });
        }

        res.json({ success: true, student: updatedUser });
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    }
});

// 3. DELETE Student from record
router.delete('/students/:id', verifyToken, async (req, res) => {
    try {
        const deletedStudent = await User.findByIdAndDelete(req.params.id);
        if (!deletedStudent) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }
        res.json({ success: true, message: "Student removed" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ANNOUNCEMENT MANAGEMENT
// ==========================================

router.post('/announcements', verifyToken, async (req, res) => {
    try {
        const newAnn = await Announcement.create({
            ...req.body,
            author: req.user.id
        });
        res.json({ success: true, announcement: newAnn });
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    }
});

router.get('/announcements/latest', async (req, res) => {
    try {
        const announcement = await Announcement.findOne().sort({ createdAt: -1 });
        res.json({ success: true, announcement: announcement || null });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/announcements/all', verifyToken, async (req, res) => {
    try {
        const all = await Announcement.find().sort({ createdAt: -1 });
        res.json({ success: true, announcements: all });
    } catch (err) { 
        res.status(500).json({ success: false }); 
    }
});

router.delete('/announcements/:id', verifyToken, async (req, res) => {
    try {
        await Announcement.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: "Announcement deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// RESOURCE MANAGEMENT (FIXED & UPGRADED)
// ==========================================

router.post('/upload-resource', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const { title, course } = req.body; 
        
        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        // Create the resource in MongoDB
        const newResource = await Resource.create({
            title: title,
            course: course, // Fixed: This now matches the student dashboard filter
            fileUrl: `/uploads/${req.file.filename}`, 
            uploadedBy: req.user.id,
            createdAt: new Date()
        });

        console.log("✅ Resource Saved to DB:", newResource); 

        res.json({ 
            success: true, 
            message: "Material uploaded successfully!", 
            resource: newResource 
        });
    } catch (err) {
        console.error("❌ DB Save Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET my uploaded materials
router.get('/resources/my-materials', verifyToken, async (req, res) => {
    try {
        const resources = await Resource.find({ uploadedBy: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, resources });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;