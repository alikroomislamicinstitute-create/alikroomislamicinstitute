const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const mongoose = require('mongoose'); // Consolidated all global requires to the top

// Models
const User = require('../models/User'); 
const Resource = require('../models/Resource'); 
const Course = require('../models/Course'); 
const Assessment = require('../models/Assessment'); 
const Announcement = require('../models/Announcement');
const Attendance = require('../models/Attendance');
const Absence = require('../models/Absence');

// Middleware & Controllers
const { verifyToken } = require('../middleware/authMiddleware'); 
const studentController = require('../controllers/studentController');
const assessmentController = require('../controllers/assessmentController');

// --- MULTER CONFIGURATION FOR STUDENT SUBMISSIONS ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); 
    },
    filename: (req, file, cb) => {
        cb(null, 'sub-' + Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// ==========================================
// DASHBOARD DATA (SYNC ENGINE)
// ==========================================
router.get('/my-dashboard', verifyToken, studentController.getStudentDashboard);

// ==========================================
// CHAT & INSTRUCTOR SYSTEM
// ==========================================

// FIXED: Consolidated into a single, comprehensive fallback handler
router.get('/my-teachers', verifyToken, async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('enrolledCourses');
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });

        const courseNames = student.enrolledCourses.map(c => c.courseName);

        const teachers = await User.find({
            role: 'teacher',
            'managedCourses.name': { $in: courseNames }
        }).select('firstName lastName managedCourses _id');

        const result = [];
        teachers.forEach(teacher => {
            teacher.managedCourses.forEach(mc => {
                if (courseNames.includes(mc.name)) {
                    result.push({
                        teacherId: teacher._id,
                        teacherName: `Ustadh ${teacher.firstName} ${teacher.lastName}`,
                        courseName: mc.name
                    });
                }
            });
        });

        res.json({ success: true, teachers: result });
    } catch (err) {
        console.error("Fetch Teachers Error:", err);
        res.status(500).json({ success: false, error: "Server error fetching teachers" });
    }
});

// ==========================================
// RESOURCE DOWNLOAD SYSTEM
// ==========================================
router.get('/my-resources', verifyToken, async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student) return res.status(404).json({ success: false, message: "Student not found" });

        const courseNames = student.enrolledCourses.map(c => c.courseName);

        const resources = await Resource.find({
            course: { $in: courseNames },
            $or: [
                { isForAllStudents: true },
                { targetStudents: req.user.id }
            ]
        }).populate('uploadedBy', 'firstName lastName');

        res.json({ success: true, resources });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/resource/download/:id', verifyToken, studentController.downloadResource);

// ==========================================
// ASSESSMENT & QUIZ SYSTEM
// ==========================================
router.get('/assessments', verifyToken, assessmentController.getAvailableAssessments);
router.post('/submit-quiz/:id', verifyToken, assessmentController.submitQuiz);

router.get('/my-assessments', verifyToken, async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student) return res.status(404).json({ success: false, message: "User not found" });

        if (!student.enrolledCourses || student.enrolledCourses.length === 0) {
            return res.json({ success: true, assessments: [] });
        }

        const courseNames = student.enrolledCourses.map(c => c.courseName);
        const assessments = await Assessment.find({ courseName: { $in: courseNames } })
            .select('-submissions') 
            .sort({ createdAt: -1 });

        res.json({ success: true, assessments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/assessment-details/:id', verifyToken, async (req, res) => {
    try {
        const assessment = await Assessment.findById(req.params.id);
        if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found" });
        res.json({ success: true, assessment });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/submit-assessment/:id', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const assessment = await Assessment.findById(req.params.id);
        if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found" });

        if (assessment.type === 'Quiz') {
            return assessmentController.submitQuiz(req, res);
        }

        // FIXED: Safe dynamic fallback query if JWT payload missing firstName/lastName properties
        const studentProfile = await User.findById(req.user.id);
        const compiledName = studentProfile ? `${studentProfile.firstName} ${studentProfile.lastName}` : "Student Portal User";

        const submission = {
            studentId: req.user.id,
            studentName: compiledName, 
            answerText: req.body.answerText,
            fileUrl: req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl,
            submittedAt: new Date()
        };

        await Assessment.findByIdAndUpdate(req.params.id, { $push: { submissions: submission } });
        res.json({ success: true, message: "Assignment submitted successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// COURSE MANAGEMENT
// ==========================================
router.get('/courses', async (req, res) => {
    try {
        const courses = await Course.find({}).sort({ title: 1 });
        const formattedCourses = courses.map(c => ({
            _id: c._id,
            title: c.title,
            arTitle: c.arTitle,
            description: c.description,
            arDesc: c.arDesc,
            price: c.price,
            category: c.category,
            arCategory: c.arCategory,
            teacherName: c.teacherName,
            thumbnail: c.thumbnail
        }));
        res.json({ success: true, courses: formattedCourses });
    } catch (err) {
        res.status(500).json({ success: false, message: "Failed to fetch courses" });
    }
});

router.put('/update-courses', verifyToken, async (req, res) => {
    try {
        const { enrolledCourses } = req.body; 
        if (!Array.isArray(enrolledCourses)) {
            return res.status(400).json({ success: false, message: "Invalid array of course IDs." });
        }

        const coursesFromDb = await Course.find({ _id: { $in: enrolledCourses } });
        const formattedCourses = coursesFromDb.map(c => ({
            course: c._id,
            courseName: c.title, 
            progress: 0,
            enrollmentDate: new Date()
        }));

        const updatedStudent = await User.findByIdAndUpdate(
            req.user.id,
            { $set: { enrolledCourses: formattedCourses } },
            { new: true }
        ).populate('enrolledCourses.course').select('-password');

        res.status(200).json({ success: true, enrolledCourses: updatedStudent.enrolledCourses });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

router.post('/enroll', verifyToken, async (req, res) => {
    try {
        const { courseId } = req.body;
        const course = await Course.findById(courseId);
        if (!course) return res.status(404).json({ success: false, message: "Course not found" });

        await User.findByIdAndUpdate(req.user.id, {
            $addToSet: { 
                enrolledCourses: { course: courseId, courseName: course.title, progress: 0 } 
            }
        });
        res.json({ success: true, message: "Enrolled successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/drop', verifyToken, async (req, res) => {
    try {
        const { courseId } = req.body;
        await User.findByIdAndUpdate(req.user.id, {
            $pull: { enrolledCourses: { course: courseId } }
        });
        res.json({ success: true, message: "Course dropped." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// PROFILE & ANNOUNCEMENT SYSTEM
// ==========================================
router.get('/profile', verifyToken, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// FIXED: Cleaned up inline require statements and string conversion mapping rules
router.get('/announcements', verifyToken, async (req, res) => {
    try {
        const studentId = req.user.id; 
        const studentObjectId = new mongoose.Types.ObjectId(studentId);

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: "Student record dropped." });

        const enrolledCourseNames = student.enrolledCourses.map(c => c.courseName);

        const announcements = await Announcement.find({
            $and: [
                { course: { $in: ['All', ...enrolledCourseNames] } },
                {
                    $or: [
                        { isForAllStudents: true },
                        { eligibleStudents: studentObjectId } 
                    ]
                }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, announcements });
    } catch (err) {
        console.error("Fetch error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// Synced with standard logic mapping above to protect visual template layout parsing
router.get('/my-announcements', verifyToken, async (req, res) => {
    try {
        const studentId = req.user.id;
        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ success: false, message: "Student record dropped." });
        
        const myCourses = student.enrolledCourses.map(c => c.courseName);
        const studentObjectId = new mongoose.Types.ObjectId(studentId);

        const announcements = await Announcement.find({
            course: { $in: [...myCourses, 'All'] },
            $or: [
                { isForAllStudents: true }, 
                { eligibleStudents: studentObjectId } 
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, announcements });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// ATTENDANCE ENGINE
// ==========================================
router.get('/active-session', verifyToken, async (req, res) => {
    try {
        const studentId = req.user.id;
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const enrolledCourseNames = student.enrolledCourses.map(c => c.courseName);

        const session = await Attendance.findOne({
            courseName: { $in: enrolledCourseNames },
            status: 'active',
            expiryTime: { $gt: new Date() },
            $or: [
                { eligibleStudents: { $exists: true, $size: 0 } }, 
                { eligibleStudents: studentId }                  
            ]
        }).sort({ createdAt: -1 });

        if (!session) {
            return res.json({ 
                success: false, 
                message: "No active attendance sessions found for your courses." 
            });
        }

        const alreadyPresent = session.presentStudents.some(
            p => p.studentId.toString() === studentId
        );

        if (alreadyPresent) {
            return res.json({ 
                success: false, 
                message: "Attendance already marked for this session." 
            });
        }

        res.json({
            success: true,
            activeSession: {
                courseName: session.courseName,
                expiryTime: session.expiryTime,
                id: session._id
            }
        });

    } catch (err) {
        console.error("Active Session Error:", err);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

router.post('/mark-attendance', verifyToken, async (req, res) => {
    try {
        const { courseName } = req.body;
        const studentId = req.user.id;

        const session = await Attendance.findOne({ 
            courseName, 
            status: 'active',
            expiryTime: { $gt: new Date() },
            $or: [
                { eligibleStudents: { $exists: true, $size: 0 } }, 
                { eligibleStudents: studentId }                  
            ]
        }).sort({ createdAt: -1 });

        if (!session) {
            return res.status(403).json({ 
                success: false, 
                message: "Attendance session unavailable or you are not eligible for this session." 
            });
        }

        if (session.sessionType === 'scheduled' && session.startTime) {
            const now = new Date();
            const [sHours, sMinutes] = session.startTime.split(':');
            const startTimeDate = new Date();
            startTimeDate.setHours(parseInt(sHours), parseInt(sMinutes), 0, 0);

            if (now < startTimeDate) {
                return res.status(403).json({ 
                    success: false, 
                    message: `Portal opens at ${session.startTime}. Please wait.` 
                });
            }
        }

        const alreadyPresent = session.presentStudents.some(
            p => p.studentId.toString() === studentId
        );

        if (alreadyPresent) {
            return res.status(400).json({ 
                success: false, 
                message: "Attendance already marked for this session." 
            });
        }

        session.presentStudents.push({
            studentId: studentId,
            timestamp: new Date()
        });

        await session.save();
        res.json({ success: true, message: "Attendance marked successfully!" });

    } catch (err) {
        console.error("Mark Attendance Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: err.message 
        });
    }
});

router.post('/notify-absence', verifyToken, async (req, res) => {
    try {
        const { courseName, reason } = req.body;
        const session = await Attendance.findOne({ courseName }).sort({ createdAt: -1 });

        if (!session) {
            return res.status(404).json({ success: false, message: "No instructor found for this course." });
        }

        // FIXED: Explicit structural verification to ensure layout elements do not populate as undefined 
        const student = await User.findById(req.user.id);
        const studentName = student ? `${student.firstName} ${student.lastName}` : "Unknown Student";

        const newAbsence = new Absence({
            studentId: req.user.id,
            studentName: studentName,
            teacherId: session.teacherId,
            courseName,
            reason
        });

        await newAbsence.save();
        res.json({ success: true, message: "Teacher notified successfully." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error handling absence request notice log." });
    }
});

module.exports = router;
