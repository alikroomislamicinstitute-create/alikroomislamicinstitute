// attendanceController.js
const User = require('../models/User');
const Course = require('../models/Course');
const Attendance = require('../models/Attendance'); // Ensure this model exists

exports.getAttendanceData = async (req, res) => {
    try {
        const teacher = await User.findById(req.user.id);
        if (!teacher) return res.status(404).json({ success: false, message: "Teacher not found" });

        // 1. Fetch managed courses
        const managedCourses = await Course.find({ teacherId: teacher._id });
        const managedCourseNames = managedCourses.map(c => c.name);
        const managedCourseIds = managedCourses.map(c => c._id);

        // 2. Fetch students (Keep your existing logic but refine the output)
        const students = await User.find({
            role: 'student',
            $or: [
                { 'enrolledCourses.courseName': { $in: managedCourseNames } },
                { 'enrolledCourses.course': { $in: managedCourseIds } }
            ]
        }).select('firstName lastName email enrolledCourses ikhId'); // Added ikhId for the student ID display

        // 3. NEW: Fetch Active/Recent Sessions for "Live Status"
        // This ensures the frontend has the session start time to calculate the 2-hour limit
        const activeSessions = await Attendance.find({
            teacherId: teacher._id,
            status: 'active'
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            managedCourses: managedCourses.map(c => ({ id: c._id, name: c.name })),
            students: students.map(s => ({
                _id: s._id,
                firstName: s.firstName,
                lastName: s.lastName,
                fullName: `${s.firstName} ${s.lastName}`,
                ikhId: s.ikhId || 'N/A',
                enrolledCourses: s.enrolledCourses
            })),
            activeSessions: activeSessions.map(sess => ({
                courseName: sess.courseName,
                startTime: sess.createdAt,
                type: sess.sessionType // e.g., 'scheduled' or 'immediate'
            }))
        });
    } catch (err) {
        console.error("Attendance Data Error:", err);
        res.status(500).json({ success: false, error: err.message });
    }
};

// ============================================================
// NEW: Monthly Roster Aggregation (To match your Calendar UI)
// ============================================================
exports.getMonthlyRoster = async (req, res) => {
    try {
        const { course, month, year } = req.query;
        const daysInMonth = new Date(year, month, 0).getDate();
        
        // Define date range for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month - 1, daysInMonth, 23, 59, 59);

        // Find all attendance records for this course in this month
        const records = await Attendance.find({
            courseName: course === 'all' ? { $exists: true } : course,
            date: { $gte: startDate, $lte: endDate }
        }).populate('presentStudents.studentId', 'firstName lastName');

        const roster = {};

        // Process records into a daily grid format
        records.forEach(session => {
            const day = new Date(session.date).getDate();
            session.presentStudents.forEach(p => {
                const sId = p.studentId._id.toString();
                if (!roster[sId]) {
                    roster[sId] = {
                        name: `${p.studentId.firstName} ${p.studentId.lastName}`,
                        days: Array(daysInMonth).fill(false),
                        total: 0
                    };
                }
                if (!roster[sId].days[day - 1]) {
                    roster[sId].days[day - 1] = true;
                    roster[sId].total++;
                }
            });
        });

        res.json({ success: true, roster });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
