const mongoose = require('mongoose');

/**
 * ASSESSMENT SCHEMA
 * Optimized for interactive CBT Quizzes.
 * Updated to track student submissions using:
 * 1. DB Object ID (for population)
 * 2. Official Registration ID (IKH/ST/xxx)
 * 3. Full Student Name (for display)
 */
const AssessmentSchema = new mongoose.Schema({
    courseName: { 
        type: String, 
        required: true 
    },
    teacherId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        required: true 
    },
    description: {
        type: String
    },
    type: { 
        type: String, 
        enum: ['Text', 'File', 'Image', 'Quiz'], 
        default: 'Quiz' 
    },
    deadline: { 
        type: Date, 
        required: true 
    },
    // --- NEW FIELDS FOR AVAILABILITY WINDOW ---
    startTime: { 
        type: Date 
    },
    endTime: { 
        type: Date 
    },
    // ------------------------------------------
    fileUrl: {
        type: String // For teacher-uploaded materials (instructions/images)
    },
    
    // Target specific students (Empty array means "All Students")
    eligibleStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],

    // Structured Quiz Data (CBT)
    duration: { 
        type: Number, 
        default: 30 // Time limit in minutes
    },
    quizData: [{
        questionText: { 
            type: String, 
            required: true 
        },
        options: [String], // e.g., ["Option A", "Option B", "Option C"]
        correctAnswer: { 
            type: Number, 
            required: true 
        }, // Index of the correct option (0, 1, 2...)
        points: { 
            type: Number, 
            default: 1 
        }
    }],
    
    // Submissions Tracking
    submissions: [{
        // 1. The Database reference to the User
        userRef: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'User' 
        },

        // 2. The Student's Full Name (e.g., Issa Issa)
        studentName: {
            type: String
        },

        // 3. The official registration ID (IKH/ST/xxx)
        registrationID: { 
            type: String
        },
        
        // For Quiz submissions (Store student's chosen indices: [0, 2, 1...])
        answers: [Number], 
        
        score: { 
            type: Number, 
            default: 0 
        },

        // For Text/File/Image submissions (Kept for compatibility)
        answerText: {
            type: String
        },
        fileUrl: {
            type: String 
        },
        
        feedback: {
            type: String // Ustadh's comments on the submission
        },
        submittedAt: { 
            type: Date, 
            default: Date.now 
        }
    }]
}, { 
    timestamps: true 
});

module.exports = mongoose.model('Assessment', AssessmentSchema);
