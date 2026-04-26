const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose'); // <--- CRITICAL: Do not forget this!

// Models
const Announcement = require('../models/Announcement');
const Resource = require('../models/Resource');
const User = require('../models/User');
const Assessment = require('../models/Assessment'); 
const Attendance = require('../models/Attendance');

// Middleware & Controllers
const assessmentController = require('../controllers/assessmentController'); 
const { verifyToken } = require('../middleware/authMiddleware');

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'uploads/';
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_'));
    }
});

const upload = multer({ 
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 } 
});

// ==========================================
// DASHBOARD & STUDENT MANAGEMENT
// ==========================================

router.get('/dashboard-data', verifyToken, async (req, res) => {
    try {
        const teacher = await User.findById(req.user.id); 

        if (!teacher || teacher.role !== 'teacher') {
            return res.status(403).json({ success: false, message: "Access denied." });
        }

        // Extract course names from the teacher's managedCourses array
        const myCourseNames = teacher.managedCourses.map(c => typeof c === 'string' ? c : c.name);

        // Find students who are enrolled in those courses AND are verified
        const students = await User.find({
            role: 'student',
            isVerified: true, // --- ONLY COUNT VERIFIED STUDENTS ---
            "enrolledCourses.courseName": { $in: myCourseNames }
        }).select('-password');

        res.json({ 
            success: true, 
            teacherName: teacher.firstName, 
            managedCourses: teacher.managedCourses, 
            students: students,
            // This length will now accurately reflect only verified students
            totalEnrolled: students.length 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/course-students/:courseName', verifyToken, async (req, res) => {
    try {
        const teacher = await User.findById(req.user.id);
        const courseName = req.params.courseName;

        const managesCourse = teacher.managedCourses.some(c => 
            (typeof c === 'string' ? c : c.name) === courseName
        );

        if (!managesCourse) {
            return res.status(403).json({ success: false, message: "You do not manage this course" });
        }

        const students = await User.find({
            role: 'student',
            "enrolledCourses.courseName": courseName
        }).select('firstName lastName _id');

        res.json({ success: true, students });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/my-courses-students', verifyToken, async (req, res) => {
    try {
        const teacher = await User.findById(req.user.id);
        if (!teacher) return res.status(404).json({ message: "Teacher not found" });

        const managedCourseNames = teacher.managedCourses.map(c => c.name);
        const result = [];

        for (const courseName of managedCourseNames) {
            const students = await User.find({
                role: 'student',
                'enrolledCourses.courseName': courseName
            }).select('firstName lastName studentID _id');

            result.push({
                courseName: courseName,
                students: students.map(s => ({
                    _id: s._id,
                    name: `${s.firstName} ${s.lastName}`,
                    registrationNumber: s.studentID
                }))
            });
        }

        res.json(result);
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.put('/students/progress/:id', verifyToken, async (req, res) => {
    try {
        const { courseName, progress } = req.body;
        const updatedUser = await User.findOneAndUpdate(
            { _id: req.params.id, "enrolledCourses.courseName": courseName },
            { $set: { "enrolledCourses.$.progress": progress } },
            { new: true }
        ).select('-password');

        if (!updatedUser) return res.status(404).json({ success: false, message: "Not found" });
        res.json({ success: true, student: updatedUser });
    } catch (err) { 
        res.status(500).json({ success: false, error: err.message }); 
    }
});

router.delete('/students/:id', verifyToken, async (req, res) => {
    try {
        const { courseName } = req.body; 
        if (courseName) {
            await User.findByIdAndUpdate(req.params.id, {
                $pull: { enrolledCourses: { courseName: courseName } }
            });
            return res.json({ success: true, message: `Student removed from ${courseName}` });
        }
        const deletedStudent = await User.findByIdAndDelete(req.params.id);
        if (!deletedStudent) return res.status(404).json({ success: false, message: "Student not found" });
        res.json({ success: true, message: "Student record removed" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ASSESSMENT & QUIZ MANAGEMENT
// ==========================================

router.post('/create-assessment', verifyToken, upload.single('file'), assessmentController.createAssessment);

// UPDATE an existing quiz
router.put('/assessments/:id', verifyToken, async (req, res) => {
    try {
        const { 
            title, courseName, deadline, duration, 
            quizData, startTime, endTime, eligibleStudents 
        } = req.body;

        // Ensure the teacher owns this quiz before updating
        const updatedAssessment = await Assessment.findOneAndUpdate(
            { _id: req.params.id, teacherId: req.user.id },
            { 
                $set: { 
                    title, 
                    courseName, 
                    deadline, 
                    duration, 
                    quizData, 
                    startTime, 
                    endTime, 
                    // If 'all' is selected, set to empty array, else use the IDs
                    eligibleStudents: eligibleStudents.includes('all') ? [] : eligibleStudents 
                } 
            },
            { new: true }
        );

        if (!updatedAssessment) {
            return res.status(404).json({ success: false, message: "Quiz not found or unauthorized" });
        }

        res.json({ success: true, message: "Quiz updated successfully", assessment: updatedAssessment });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/quiz-results', verifyToken, async (req, res) => {
    try {
        const assessments = await Assessment.find({ 
            teacherId: req.user.id, 
            type: 'Quiz' 
        });

        let allResults = [];
        assessments.forEach(quiz => {
            quiz.submissions.forEach(sub => {
                allResults.push({
                    submissionId: sub._id,
                    assessmentId: quiz._id,
                    quizTitle: quiz.title,
                    courseName: quiz.courseName,
                    studentName: sub.studentName || "Unknown", 
                    registrationNumber: sub.registrationID || "N/A",
                    score: sub.score,
                    totalPossible: quiz.quizData.reduce((acc, q) => acc + (q.points || 1), 0),
                    submittedAt: sub.submittedAt
                });
            });
        });

        res.json({ success: true, results: allResults });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/quiz-submission/:assessmentId/:submissionId', verifyToken, async (req, res) => {
    try {
        const { assessmentId, submissionId } = req.params;
        const assessment = await Assessment.findOneAndUpdate(
            { _id: assessmentId, teacherId: req.user.id },
            { $pull: { submissions: { _id: submissionId } } },
            { new: true }
        );

        if (!assessment) return res.status(404).json({ success: false, message: "Record not found" });
        res.json({ success: true, message: "Submission deleted" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/assessment-submissions/:id', verifyToken, async (req, res) => {
    try {
        const assessment = await Assessment.findById(req.params.id);
        if (!assessment) return res.status(404).json({ success: false, message: "Assessment not found" });
        res.json({ success: true, submissions: assessment.submissions });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/my-assessments', verifyToken, async (req, res) => {
    try {
        const assessments = await Assessment.find({ teacherId: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, assessments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/assessments/:id', verifyToken, async (req, res) => {
    try {
        const assessment = await Assessment.findOneAndDelete({ 
            _id: req.params.id, 
            teacherId: req.user.id 
        });

        if (!assessment) {
            return res.status(404).json({ success: false, message: "Quiz not found or unauthorized" });
        }

        if (assessment.fileUrl) {
            const filePath = path.join(__dirname, '..', assessment.fileUrl);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        res.json({ success: true, message: "Quiz deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ANNOUNCEMENT MANAGEMENT
// ==========================================

router.get('/announcements/all', verifyToken, async (req, res) => {
    try {
        const announcements = await Announcement.find({ author: req.user.id })
            .sort({ createdAt: -1 });
        
        res.json({ success: true, announcements });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.post('/announcements', verifyToken, async (req, res) => {
    try {
        const { title, message, course, priority, eligibleStudents, isForAllStudents } = req.body;

        // 1. Convert "true"/"false" strings from the form into actual Booleans
        const forAll = isForAllStudents === true || isForAllStudents === 'true';

        // 2. Handle the eligibleStudents array safely
        let formattedEligible = [];
        if (!forAll && eligibleStudents) {
            // Ensure eligibleStudents is an array (even if only one student was selected)
            const studentsArray = Array.isArray(eligibleStudents) ? eligibleStudents : [eligibleStudents];
            
            // Filter out 'all' placeholder and convert strings to ObjectIds
            formattedEligible = studentsArray
                .filter(id => id && id !== 'all')
                .map(id => new mongoose.Types.ObjectId(id));
        }

        // 3. Set the 48-hour expiry
        const expiry = new Date();
        expiry.setHours(expiry.getHours() + 48);

        const newAnnouncement = new Announcement({
            title,
            message,
            author: req.user.id,
            course: course || 'All',
            priority: priority || 'normal',
            eligibleStudents: formattedEligible,
            isForAllStudents: forAll,
            expiresAt: expiry
        });

        await newAnnouncement.save();
        res.json({ success: true, message: "Announcement broadcasted successfully." });

    } catch (err) {
        // This logs the specific error to your VS Code terminal
        console.error("❌ ANNOUNCEMENT ROUTE ERROR:", err); 
        
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error", 
            error: err.message 
        });
    }
});

router.delete('/announcements/:id', verifyToken, async (req, res) => {
    try {
        const announcement = await Announcement.findOneAndDelete({
            _id: req.params.id,
            author: req.user.id 
        });

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found or you are not authorized to delete it."
            });
        }

        res.json({
            success: true,
            message: "Announcement deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

// ==========================================
// RESOURCE / MATERIALS MANAGEMENT
// ==========================================

router.post('/upload-resource', verifyToken, upload.single('file'), async (req, res) => {
    try {
        const { title, course } = req.body;

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file selected" });
        }

        const selectedStudents = req.body.selectedStudents || [];
        const isForAllStudents = req.body.isForAllStudents === 'true';

        const normalizedStudents = Array.isArray(selectedStudents)
            ? selectedStudents
            : [selectedStudents];

        const fileUrl = `/uploads/${req.file.filename}`;

        const resource = await Resource.create({
            title,
            fileUrl,
            course,
            uploadedBy: req.user.id,
            isForAllStudents,
            targetStudents: isForAllStudents ? [] : normalizedStudents
        });

        res.json({ success: true, resource });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.get('/resources/my-materials', verifyToken, async (req, res) => {
    try {
        const resources = await Resource.find({ uploadedBy: req.user.id })
                                        .sort({ createdAt: -1 });
        
        res.json({ success: true, resources });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/resources/:id', verifyToken, async (req, res) => {
    try {
        const resource = await Resource.findOneAndDelete({
            _id: req.params.id,
            uploadedBy: req.user.id
        });

        if (!resource) {
            return res.status(404).json({
                success: false,
                message: "Resource not found"
            });
        }

        res.json({
            success: true,
            message: "Resource deleted successfully"
        });

    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message
        });
    }
});

router.put('/resources/:id', verifyToken, async (req, res) => {
    try {
        const { title, course } = req.body;

        const updated = await Resource.findOneAndUpdate(
            { _id: req.params.id, uploadedBy: req.user.id },
            { title, course },
            { new: true }
        );

        if (!updated) {
            return res.status(404).json({ success: false });
        }

        res.json({ success: true, resource: updated });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==========================================
// ATTENDANCE MANAGEMENT
// ==========================================

// FIXED: POST /api/teacher/deploy-attendance
router.post('/deploy-attendance', verifyToken, async (req, res) => {
    try {
        const { 
            courseName, 
            duration, 
            eligibleStudents, 
            sessionType, 
            startTime, 
            endTime, 
            teacherNote 
        } = req.body;

        let finalEligible = [];
        if (Array.isArray(eligibleStudents)) {
            finalEligible = eligibleStudents;
        } else if (eligibleStudents === 'all') {
            finalEligible = []; 
        }

        // --- FIXED LOGIC FOR SCHEDULING ---
        let expiry;
        if (sessionType === 'scheduled' && endTime) {
            // If scheduled, the portal expires at the end of the window
            const [hours, minutes] = endTime.split(':');
            expiry = new Date();
            expiry.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        } else {
            // If immediate, use the duration
            expiry = new Date();
            expiry.setMinutes(expiry.getMinutes() + parseInt(duration));
        }

        const newSession = new Attendance({
            courseName,
            teacherId: req.user.id,
            sessionType: sessionType || 'immediate',
            startTime: startTime || null,
            endTime: endTime || null,
            teacherNote: teacherNote || "",
            duration: parseInt(duration),
            expiryTime: expiry,
            eligibleStudents: finalEligible,
            status: 'active'
        });

        await newSession.save();
        res.json({ success: true, message: "Portal deployed successfully!" });
    } catch (err) {
        console.error("Deploy Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/teacher/attendance-status/:courseName
 * UPGRADED to include metadata for the frontend status check
 */
router.get('/attendance-status/:courseName', verifyToken, async (req, res) => {
    try {
        const { courseName } = req.params;

        const session = await Attendance.findOne({ courseName })
            .sort({ createdAt: -1 })
            .populate('presentStudents.studentId', 'firstName lastName studentID');

        if (!session) {
            return res.status(404).json({ 
                success: false, 
                message: "No attendance session found for this course." 
            });
        }

        const formattedStudents = session.presentStudents.map(p => {
            const studentDoc = p.studentId;
            return {
                name: studentDoc ? `${studentDoc.firstName} ${studentDoc.lastName}` : "Unknown Student",
                id: studentDoc ? (studentDoc.studentID || "No ID") : "N/A", 
                time: p.timestamp
            };
        });

        res.json({ 
            success: true, 
            course: session.courseName,
            sessionType: session.sessionType,
            startTime: session.startTime,
            endTime: session.endTime,
            teacherNote: session.teacherNote,
            createdAt: session.createdAt,
            presentCount: session.presentStudents.length,
            students: formattedStudents
        });

    } catch (err) {
        console.error("Attendance Status Error:", err);
        res.status(500).json({ 
            success: false, 
            message: "Internal Server Error", 
            error: err.message 
        });
    }
});

router.get('/my-attendance-sessions', verifyToken, async (req, res) => {
    try {
        const sessions = await Attendance.find({ teacherId: req.user.id }).lean();

        const notes = await Announcement.find({ 
            author: req.user.id,
            title: { $regex: /^Instructor Update:/ } 
        }).lean();

        const combinedHistory = [
            ...sessions.map(s => ({
                _id: s._id,
                courseName: s.courseName,
                date: s.createdAt,
                type: 'attendance',
                displayType: '📊 Attendance',
                status: s.status,
                count: s.presentStudents ? s.presentStudents.length : 0
            })),
            ...notes.map(n => ({
                _id: n._id,
                courseName: n.course,
                date: n.createdAt,
                type: 'note',
                displayType: '✉️ Note Only',
                message: n.message,
                status: 'Sent'
            }))
        ];

        combinedHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

        res.json({ success: true, sessions: combinedHistory });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.post('/broadcast-note', verifyToken, async (req, res) => {
    try {
        const { title, message, courseName, note, course, eligibleStudents, type } = req.body;

        const finalTitle = title || (courseName ? `Instructor Update: ${courseName}` : null);
        const finalMessage = message || note;
        const finalCourse = course || courseName;

        if (!finalCourse || !finalMessage || !finalMessage.trim()) {
            return res.status(400).json({ 
                success: false, 
                message: "Course and message content are required." 
            });
        }

        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + 48);

        const announcementData = {
            title: finalTitle,
            message: finalMessage.trim(),
            author: req.user.id,
            course: finalCourse,
            type: type,
            isForAllStudents: !eligibleStudents || eligibleStudents.includes('all'),
            eligibleStudents: (!eligibleStudents || eligibleStudents.includes('all')) ? [] : eligibleStudents,
            priority: 'urgent',
            expiresAt: expiryDate
        };

        try {
            const announcement = new Announcement(announcementData);
            await announcement.save();
            
            return res.status(200).json({ 
                success: true, 
                message: "Note broadcasted with 48h auto-expiry." 
            });
        } catch (saveErr) {
            if (saveErr.name === 'ValidationError' && saveErr.errors.priority) {
                delete announcementData.priority; 
                const fallbackAnnouncement = new Announcement(announcementData);
                await fallbackAnnouncement.save();
                return res.status(200).json({ 
                    success: true, 
                    message: "Note broadcasted (default priority) with 48h auto-expiry." 
                });
            }
            throw saveErr;
        }

    } catch (err) {
        console.error("❌ BROADCAST ROUTE ERROR:", err);
        res.status(500).json({ 
            success: false, 
            error: err.message || "An internal server error occurred." 
        });
    }
});

router.delete('/delete-history/:id/:type', verifyToken, async (req, res) => {
    try {
        const { id, type } = req.params;
        let deleted;

        if (type === 'attendance') {
            deleted = await Attendance.findOneAndDelete({ _id: id, teacherId: req.user.id });
        } else if (type === 'note') {
            deleted = await Announcement.findOneAndDelete({ _id: id, author: req.user.id });
        }

        if (!deleted) {
            return res.status(404).json({ success: false, message: "Record not found." });
        }

        res.json({ success: true, message: "Deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

router.get('/absence-requests', verifyToken, async (req, res) => {
    try {
        const requests = await Absence.find({ teacherId: req.user.id }).sort({ createdAt: -1 });
        res.json({ success: true, requests });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// FIXED: monthly-roster (To prevent "Error Loading Roster" and handle course mapping)
router.get('/monthly-roster', verifyToken, async (req, res) => {
    try {
        const teacher = await User.findById(req.user.id);
        if (!teacher) return res.status(404).json({ message: "Teacher not found" });

        const managedCourseNames = teacher.managedCourses.map(c => typeof c === 'string' ? c : c.name);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const roster = await Attendance.aggregate([
            {
                $match: {
                    courseName: { $in: managedCourseNames },
                    createdAt: { $gte: startOfMonth }
                }
            },
            { $unwind: "$presentStudents" },
            {
                $group: {
                    _id: {
                        course: "$courseName",
                        studentId: "$presentStudents.studentId"
                    },
                    attendanceCount: { $sum: 1 }
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id.studentId",
                    foreignField: "_id",
                    as: "studentInfo"
                }
            },
            { $unwind: "$studentInfo" },
            { $match: { "studentInfo.isVerified": true } },
            {
                $group: {
                    _id: "$_id.course",
                    students: {
                        $push: {
                            name: { $concat: ["$studentInfo.firstName", " ", "$studentInfo.lastName"] },
                            registrationNumber: "$studentInfo.studentID",
                            count: "$attendanceCount"
                        }
                    }
                }
            },
            { $project: { courseName: "$_id", students: 1, _id: 0 } }
        ]);

        res.json({ success: true, roster });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

router.delete('/clear-monthly-attendance/:courseName', verifyToken, async (req, res) => {
    try {
        const { courseName } = req.params;
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const teacher = await User.findById(req.user.id);
        const managesCourse = teacher.managedCourses.some(c => 
            (typeof c === 'string' ? c : c.name) === courseName
        );

        if (!managesCourse) {
            return res.status(403).json({ success: false, message: "Unauthorized for this course." });
        }

        const result = await Attendance.deleteMany({
            courseName: courseName,
            teacherId: req.user.id,
            createdAt: { $gte: startOfMonth }
        });

        res.json({ 
            success: true, 
            message: `Cleared ${result.deletedCount} attendance sessions for ${courseName}.` 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;
