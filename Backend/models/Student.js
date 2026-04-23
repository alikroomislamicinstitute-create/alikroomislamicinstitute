const mongoose = require('mongoose');

// --- THE SCHEMA ---
const StudentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // Hashed
  
  // This is where the interaction happens
  enrolledCourses: [{
    courseId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Course' 
    },
    courseName: String, // Cached for easier display
    progress: { 
      type: Number, 
      default: 0, 
      min: 0, 
      max: 100 
    },
    teacherNote: { 
      type: String, 
      default: "Waiting for Ustadh's feedback..." 
    }
  }],
  
  role: { type: String, default: 'student' }
}, { timestamps: true });

const Student = mongoose.model('Student', StudentSchema);

// --- THE LOGIC (Exported for your routes) ---
// Note: This logic assumes you have a 'Resource' model elsewhere in your app
const getDashboardData = async (req, res) => {
    try {
        // 1. Find the student using the ID from the JWT (req.user.id)
        // We use the 'Student' model we just defined
        const student = await Student.findById(req.user.id);
        
        if (!student) {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        // 2. Fetch resources assigned to the courses this student is in
        // We look for resources where the 'course' matches any name in student.enrolledCourses
        // We assume your Resource model is required in your main router file
        const courseNames = student.enrolledCourses.map(c => c.courseName);
        
        // This part requires your Resource model to be accessible
        // const resources = await Resource.find({ course: { $in: courseNames } });

        res.json({
            success: true,
            enrolledCourses: student.enrolledCourses, 
            // resources: resources 
        });

    } catch (err) {
        console.error("Dashboard Error:", err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
};

// Exporting both the model and the logic
module.exports = { Student, getDashboardData };