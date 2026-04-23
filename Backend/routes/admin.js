const express = require('express');
const router = express.Router();
const User = require('../models/User');
const TempUser = require('../models/TempUser');
const Voucher = require('../models/Voucher');
const Course = require('../models/Course'); 
const { verifyToken } = require('../middleware/authMiddleware');
const crypto = require('crypto'); // ✅ ADDED

// --- USER MANAGEMENT ROUTES ---

// GET DASHBOARD STATS
router.get('/stats', verifyToken, async (req, res) => {
    try {
        const studentCount = await User.countDocuments({ role: 'student' });
        const teacherCount = await User.countDocuments({ role: 'teacher' });
        const courseCount = await Course.countDocuments();
        const pendingCount = await TempUser.countDocuments();

        res.json({
            success: true,
            stats: {
                totalStudents: studentCount,
                totalTeachers: teacherCount,
                totalCourses: courseCount,
                pendingVerification: pendingCount 
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * @desc    Get all users for Admin Management (Unified View)
 * @route   GET /api/admin/users
 */
router.get('/users', async (req, res) => {
    try {
        const officialUsers = await User.find()
            .select('-password')
            .lean();
        
        const pendingUsers = await TempUser.find()
            .select('-password')
            .lean();

        const verifiedList = officialUsers.map(u => ({ ...u, isVerified: true }));
        const pendingList = pendingUsers.map(u => ({ ...u, isVerified: false }));

        const allUsers = [...verifiedList, ...pendingList].sort((a, b) => 
            new Date(b.createdAt) - new Date(a.createdAt)
        );

        res.json({ 
            success: true, 
            count: allUsers.length,
            users: allUsers 
        });
    } catch (err) {
        console.error("Fetch Users Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Failed to retrieve users: " + err.message 
        });
    }
});


// ✅ ======================= NEW OTP SECTION =======================

// ✅ GET ONLY PENDING USERS (for OTP panel)
router.get('/pending-users', verifyToken, async (req, res) => {
    try {
        const users = await TempUser.find()
            .select('firstName lastName email phone manualVerificationCode createdAt')
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            users
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ✅ GENERATE OTP FOR A USER
router.post('/generate-otp/:id', verifyToken, async (req, res) => {
    try {
        const user = await TempUser.findById(req.params.id);

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const otp = crypto.randomInt(100000, 999999).toString();

        user.manualVerificationCode = otp;
        user.codeExpires = Date.now() + 30 * 60 * 1000;
        user.verificationAttempts = 0;

        await user.save();

        res.json({
            success: true,
            message: "OTP generated successfully",
            otp // 👈 Admin sees it immediately
        });

    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

// ✅ ======================= END OTP SECTION =======================


// DELETE A USER (Official or Pending)
router.delete('/users/:id', async (req, res) => {
    try {
        const deletedOfficial = await User.findByIdAndDelete(req.params.id);
        const deletedTemp = await TempUser.findByIdAndDelete(req.params.id);

        if (!deletedOfficial && !deletedTemp) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        res.json({ success: true, message: "User removed successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: "Delete failed" });
    }
});

// ADD A USER MANUALLY
router.post('/users', async (req, res) => {
    try {
        const { firstName, lastName, email, role, gender, nationality } = req.body;
        
        const newUser = new User({ 
            firstName, 
            lastName, 
            email, 
            role, 
            gender: gender || 'Male', 
            nationality: nationality || 'Nigerian',
            password: 'initialPass123', 
            voucherKey: 'ADMIN-CREATED',
            isVerified: true
        });

        await newUser.save();
        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

// --- VOUCHER ROUTES ---

router.get('/vouchers', async (req, res) => {
    try {
        const vouchers = await Voucher.find()
            .populate('usedBy', 'firstName lastName') 
            .sort({ createdAt: -1 });
        res.json({ success: true, vouchers });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/generate-voucher', async (req, res) => {
    try {
        const { role } = req.body; 
        
        if (!role || !['student', 'teacher'].includes(role)) {
            return res.status(400).json({ success: false, message: "Valid role (student/teacher) required" });
        }

        const prefix = role === 'teacher' ? 'IKR-TH-' : 'IKR-ST-';
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        const fullKey = `${prefix}${randomStr}`;

        const newVoucher = await Voucher.create({ 
            key: fullKey, 
            role: role 
        });

        res.status(201).json({ 
            success: true, 
            message: "Voucher created successfully.",
            key: newVoucher.key 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/vouchers/all', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        await Voucher.deleteMany({}); 
        res.json({ success: true, message: "All keys have been cleared." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- COURSE MANAGEMENT ROUTES ---

router.get('/courses', verifyToken, async (req, res) => {
    try {
        const courses = await Course.find().sort({ createdAt: -1 });
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch courses" });
    }
});

router.post('/courses', verifyToken, async (req, res) => {
    try {
        const isAdmin = req.user && (
            (req.user.role && req.user.role.toLowerCase() === 'admin') || 
            req.user.isAdmin === true
        );

        if (!isAdmin) {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const newCourse = new Course(req.body);
        await newCourse.save();
        res.status(201).json({ success: true, message: "Course Created", course: newCourse });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.delete('/courses/:id', verifyToken, async (req, res) => {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ success: false, message: "Unauthorized" });
        }

        const course = await Course.findByIdAndDelete(req.params.id);
        if (!course) {
            return res.status(404).json({ success: false, message: "Course not found" });
        }

        res.json({ success: true, message: "Course deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
