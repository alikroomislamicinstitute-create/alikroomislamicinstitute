const mongoose = require('mongoose');

const TempUserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    // Middle Name added to match registration form data
    middleName: { type: String }, 
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    // Added: Phone number field to store country code + number
    phone: { type: String }, 
    password: { type: String, required: true },
    role: { type: String, required: true },
    gender: { type: String },
    nationality: { type: String },
    voucherKey: { type: String },
    enrolledCourses: { type: Array },
    managedCourses: { type: Array },
    
    // UPDATED: Manual Verification Fields
    verificationToken: { type: String }, // Keep for legacy if needed
    
    // The 6-digit numeric code for the new manual method
    manualVerificationCode: { 
        type: String 
    },
    // Expiry for the specific 6-digit code (e.g., 15-30 minutes)
    codeExpires: { 
        type: Date 
    },
    // Security: Track failed attempts to enter the 6-digit code
    verificationAttempts: { 
        type: Number, 
        default: 0 
    },

    createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-deletes user after 24 hours
});

module.exports = mongoose.model('TempUser', TempUserSchema);
