const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');

// Models
const User = require('../models/User'); 
const Resource = require('../models/Resource'); 
const Course = require('../models/Course'); 
const Assessment = require('../models/Assessment'); 
const Announcement = require('../models/Announcement');
const Attendance = require('../models/Attendance');

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

router.get('/my-teachers', verifyToken, async (req, res) => {
    try {
        const student = await User.findById(req.user.id).select('enrolledCourses');
        if (!student) return res.status(404).json({ message: "Student not found" });

        const enrolledCourseIds = student.enrolledCourses.map(c => c.course);

        const teachers = await User.find({
            role: 'teacher',
            'managedCourses.courseId': { $in: enrolledCourseIds }
        });

        const result = [];
        teachers.forEach(teacher => {
            teacher.managedCourses.forEach(mc => {
                if (enrolledCourseIds.includes(mc.courseId.toString())) {
                    result.push({
                        teacherId: teacher._id,
                        teacherName: `Ustadh ${teacher.firstName} ${teacher.lastName}`,
                        courseName: mc.name
                    });
                }
            });
        });

        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server error fetching teachers" });
    }
});

// Get list of teachers for the logged-in student
router.get('/my-teachers', verifyToken, async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        
        // 1. Get the names of all courses the student is in
        const courseNames = student.enrolledCourses.map(c => c.courseName);

        // 2. Find teachers who manage those specific courses
        const teachers = await User.find({
            role: 'teacher',
            'managedCourses.name': { $in: courseNames }
        }).select('firstName lastName _id');

        res.json({ success: true, teachers });
    } catch (err) {
        res.status(500).json({ success: false, message: "Error fetching teachers" });
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

        const submission = {
            studentId: req.user.id,
            studentName: req.user.fullName || "Student", 
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

const mongoose = require('mongoose');

router.get('/announcements', verifyToken, async (req, res) => {
    try {
        const mongoose = require('mongoose');
        const studentId = req.user.id; // String from JWT
        
        // 1. Convert the studentId string into a real Mongoose ObjectId
        const studentObjectId = new mongoose.Types.ObjectId(studentId);

        const student = await User.findById(studentId);
        if (!student) return res.status(404).json({ success: false });

        // 2. Get all courses the student is in
        const enrolledCourseNames = student.enrolledCourses.map(c => c.courseName);

        // 3. The Query
        const announcements = await Announcement.find({
            $and: [
                // Match the course: must be 'All' OR one of the student's courses
                { course: { $in: ['All', ...enrolledCourseNames] } },
                
                // Match the audience
                {
                    $or: [
                        { isForAllStudents: true },
                        { eligibleStudents: studentObjectId } // Match by ObjectId
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


// GET /api/student/active-session
// This handles both General (all students) and Specified (selected students) attendance
router.get('/active-session', verifyToken, async (req, res) => {
    try {
        const studentId = req.user.id;

        // 1. Fetch student to get their enrolled courses
        const student = await User.findById(studentId);
        if (!student) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Get names of courses the student is actually enrolled in
        const enrolledCourseNames = student.enrolledCourses.map(c => c.courseName);

        // 2. Find a session that matches:
        // - Course name is in student's enrolled list
        // - Status is 'active'
        // - Expiry time is in the future
        // - EITHER: eligibleStudents is empty (General Attendance)
        // - OR: studentId is inside eligibleStudents (Specified Attendance)
        const session = await Attendance.findOne({
            courseName: { $in: enrolledCourseNames },
            status: 'active',
            expiryTime: { $gt: new Date() },
            $or: [
                { eligibleStudents: { $exists: true, $size: 0 } }, 
                { eligibleStudents: studentId }                  
            ]
        }).sort({ createdAt: -1 }); // Get the most recently created session first

        if (!session) {
            return res.json({ 
                success: false, 
                message: "No active attendance sessions found for your courses." 
            });
        }

        // 3. Check if student has already marked attendance for this specific session
        const alreadyPresent = session.presentStudents.some(
            p => p.studentId.toString() === studentId
        );

        if (alreadyPresent) {
            return res.json({ 
                success: false, 
                message: "Attendance already marked for this session." 
            });
        }

        // 4. Send back the data the frontend expects
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

router.get('/my-announcements', verifyToken, async (req, res) => {
    try {
        const studentId = req.user.id;
        const student = await User.findById(studentId);
        const myCourses = student.enrolledCourses.map(c => c.courseName);

        const announcements = await Announcement.find({
            course: { $in: [...myCourses, 'All'] },
            $or: [
                { isForAllStudents: true }, 
                { eligibleStudents: studentId } // Only show if this student is in the list
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, announcements });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/mark-attendance', verifyToken, async (req, res) => {
    try {
        const { courseName } = req.body;
        const studentId = req.user.id;

        // 1. Find the session with a STRIKE ELIGIBILITY CHECK
        const session = await Attendance.findOne({ 
            courseName, 
            status: 'active',
            expiryTime: { $gt: new Date() }, // Ensure it hasn't expired
            $or: [
                { eligibleStudents: { $exists: true, $size: 0 } }, // Open to all students
                { eligibleStudents: studentId }                  // Specific student is authorized
            ]
        }).sort({ createdAt: -1 });

        // 2. If no session is found, it's either expired or the student isn't authorized
        if (!session) {
            return res.status(403).json({ 
                success: false, 
                message: "Attendance session unavailable or you are not eligible for this session." 
            });
        }

        // --- UPGRADE: TIME WINDOW CHECK ---
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

        // 3. Check if student already marked attendance to prevent duplicates
        const alreadyPresent = session.presentStudents.some(
            p => p.studentId.toString() === studentId
        );

        if (alreadyPresent) {
            return res.status(400).json({ 
                success: false, 
                message: "Attendance already marked for this session." 
            });
        }

        // 4. Record the attendance
        session.presentStudents.push({
            studentId: studentId,
            timestamp: new Date()
        });

        await session.save();

        res.json({ 
            success: true, 
            message: "Attendance marked successfully!" 
        });

    } catch (err) {
        console.error("Mark Attendance Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Internal server error",
            error: err.message 
        });
    }
});

const Absence = require('../models/Absence');

// routes/student.js
router.post('/notify-absence', verifyToken, async (req, res) => {
    try {
        const { courseName, reason } = req.body;
        
        // Find the teacher by checking who started the last session for this course
        const session = await Attendance.findOne({ courseName }).sort({ createdAt: -1 });

        if (!session) {
            return res.status(404).json({ success: false, message: "No instructor found for this course." });
        }

        const newAbsence = new Absence({
            studentId: req.user.id,
            studentName: req.user.firstName + " " + req.user.lastName,
            teacherId: session.teacherId,
            courseName,
            reason
        });

        await newAbsence.save();
        res.json({ success: true, message: "Teacher notified." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server error" });
    }
});

module.exports = router;
