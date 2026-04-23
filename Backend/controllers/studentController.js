const User = require('../models/User');
const Resource = require('../models/Resource');
const path = require('path');
const fs = require('fs');

// GET /api/student/my-dashboard
exports.getStudentDashboard = async (req, res) => {
    try {
        // 1. Fetch student and populate the nested course object
        // Integrated .select('-password') for security as requested
        const student = await User.findById(req.user.id)
            .populate('enrolledCourses.course')
            .select('-password'); 

        if (!student) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // ✅ Ensure enrolledCourses is always an array
        const enrolledCoursesRaw = Array.isArray(student.enrolledCourses) 
            ? student.enrolledCourses 
            : [];

        // 2. Create a clean list of titles for the Resource search
        const courseTitles = enrolledCoursesRaw
            .map(c => (c.course ? c.course.title : c.courseName))
            .filter(Boolean);

        // 3. Find resources matching courses AND targeting this specific student
        const resources = await Resource.find({
            $and: [
                {
                    $or: [
                        { course: { $in: courseTitles } },
                        { course: { $in: ["General", "", null] } }
                    ]
                },
                {
                    $or: [
                        { isForAllStudents: true },
                       { targetStudents: { $in: [req.user.id] } }
                    ]
                }
            ]
        }).sort({ createdAt: -1 });

        // 4. FINAL RESPONSE: Cleaned up for the HTML render() function
        res.json({
            success: true,
            // INTEGRATED: Standard user object for frontend name extraction
            user: {
                fullName: student.fullName || `${student.firstName} ${student.lastName}`,
                email: student.email
            },
            // Keeping your existing properties for legacy compatibility
            full_name: `${student.firstName} ${student.lastName}`, 
            firstName: student.firstName,
            
            enrolledCourses: enrolledCoursesRaw.map(c => ({
                progress: c.progress || 0,
                teacherNote: c.teacherNote || "",
                // Fallback title logic to prevent "Unknown Course"
                course: c.course ? {
                    title: c.course.title,
                    arTitle: c.course.arTitle,
                    courseCode: c.course.courseCode || "Active"
                } : { 
                    title: c.courseName || "Unknown Course", 
                    courseCode: "Active" 
                }
            })),
            resources: resources.map(r => ({
                _id: r._id,
                title: r.title,
                course: r.course 
            }))
        });

    } catch (err) {
        console.error("❌ Dashboard Data Error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// GET /api/student/resource/download/:id (Untouched logic)
exports.downloadResource = async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);

        if (!resource) {
            return res.status(404).json({ success: false, message: "Resource not found" });
        }

        const filePath = path.join(__dirname, '..', resource.fileUrl);

        if (!fs.existsSync(filePath)) {
            console.error(`File missing at: ${filePath}`);
            return res.status(404).json({ success: false, message: "Physical file not found on server" });
        }

        res.download(filePath, resource.title || "resource_download");

    } catch (err) {
        console.error("❌ Download Error:", err);
        res.status(500).json({ success: false, message: "Error processing download" });
    }
};