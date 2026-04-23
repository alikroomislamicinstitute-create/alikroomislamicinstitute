const mongoose = require('mongoose');

const resourceSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    course: { 
        type: String, 
        required: true // This matches the 'course' field used in teacher and student routes
    },
    fileUrl: { 
        type: String, 
        required: true // Stores the path: e.g., "/uploads/171113...filename.pdf"
    }, 
    // Matches your new "teacher" requirement while keeping the original ref
    uploadedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User',
        required: true
    },
    // NEW: Boolean to check if resource is public to the whole course
    isForAllStudents: {
        type: Boolean,
        default: false
    },
    // NEW: Renamed from eligibleStudents to targetStudents per your request
    targetStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true // Added this from your new snippet to handle updatedAt automatically
});

module.exports = mongoose.model('Resource', resourceSchema);