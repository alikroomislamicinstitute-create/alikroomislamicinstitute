const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
    courseName: { 
        type: String, 
        required: true 
    },
    teacherId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // --- NEW: Session Type ---
    // Distinguishes between 'immediate' (manual) and 'scheduled' (auto)
    sessionType: { 
        type: String, 
        enum: ['immediate', 'scheduled'], 
        default: 'immediate' 
    },
    // --- NEW: Time Window for Scheduled Mode ---
    // Used to verify if a student is checking in within the allowed window
    startTime: { 
        type: String // Format: "HH:mm" (e.g., "14:30")
    },
    endTime: { 
        type: String // Format: "HH:mm"
    },
    // --- NEW: Active Days ---
    // Stores which days the schedule repeats (0=Sun, 1=Mon, etc.)
    activeDays: [{ 
        type: Number 
    }],
    // --- NEW: Teacher Broadcast ---
    // Stores the global note/message displayed to students
    teacherNote: { 
        type: String, 
        default: "" 
    },
    // The date the record was created/deployed
    date: { 
        type: Date, 
        default: Date.now 
    },
    // How many minutes the portal stays open (for calculation/locking)
    duration: { 
        type: Number, 
        default: 10 
    },
    // Configuration for automatic expiration
    expiryTime: { 
        type: Date, 
        required: true 
    },
    status: { 
        type: String, 
        enum: ['active', 'expired'], 
        default: 'active' 
    },
    // List of students who are allowed to mark attendance
    // Use 'all' logic or array of IDs
    eligibleStudents: [{ 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }],
    isForAllEnrolled: { 
        type: Boolean, 
        default: true 
    },
    // List of students who actually marked themselves present
    presentStudents: [{
        studentId: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },
        name: String, // Cached name for faster roster generation
        ikhId: String, // Student's unique ID
        timestamp: { 
            type: Date, 
            default: Date.now 
        }
    }]
}, { timestamps: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
