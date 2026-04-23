const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * SUB-SCHEMA FOR TEACHER PROGRAMS
 * UPDATED: Includes default values for code and description
 */
const ManagedCourseSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    code: { 
        type: String, 
        default: 'PRG' 
    },
    description: { 
        type: String, 
        default: 'Active instructional program.' 
    }
});

const UserSchema = new mongoose.Schema({
    firstName: { 
        type: String, 
        required: [true, 'First name is required'],
        trim: true
    },
    middleName: { 
        type: String,
        trim: true 
    },
    lastName: { 
        type: String, 
        required: [true, 'Last name is required'],
        trim: true
    },
    email: { 
        type: String, 
        required: [true, 'Email is required'], 
        unique: true,
        lowercase: true,
        // FIXED REGEX: Backslash added before 'w' after '@' symbol
        match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please add a valid email']
    },
    // Added: Phone field for official user record
    phone: {
        type: String,
        trim: true
    },
    studentID: { 
        type: String, 
        unique: true, 
        sparse: true 
    }, 
    password: { 
        type: String, 
        required: [function() { return !this.googleId; }, 'Password is required'], 
        minlength: [5, 'Password must be at least 5 characters'],
        select: false 
    },
    gender: { 
        type: String, 
        enum: ['Male', 'Female'], 
        required: true 
    },
    nationality: { 
        type: String, 
        required: true 
    },
    role: { 
        type: String, 
        enum: ['student', 'teacher', 'admin'], 
        default: 'student',
        required: true 
    },
    ikhId: { 
        type: String, 
        unique: true,
        sparse: true 
    },
    voucherKey: { 
        type: String, 
        required: function() { return this.role !== 'admin' && !this.googleId; } 
    },

    // --- Verification Fields Updated ---
    isVerified: {
        type: Boolean,
        default: false
    },
    verificationToken: String,
    verificationTokenExpires: Date,
    
    // NEW: Manual Verification implementation
    manualVerificationCode: {
        type: String
    },
    codeExpires: {
        type: Date
    },
    verificationAttempts: {
        type: Number,
        default: 0
    },
    // --------------------------------------
    
    managedCourses: [ManagedCourseSchema],
    managedCourseIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    
    enrolledCourses: [{
        course: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'Course' 
        },
        courseName: String, 
        progress: { 
            type: Number, 
            default: 0 
        },
        enrollmentDate: { 
            type: Date, 
            default: Date.now 
        }
    }],

    createdAt: { 
        type: Date, 
        default: Date.now 
    }
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

UserSchema.virtual('fullName').get(function() {
    return `${this.firstName} ${this.lastName}`.trim();
});

// PRE-SAVE HOOK: Handles ID Generation and Password Hashing
UserSchema.pre('save', async function () {
    // 1. GENERATE IKH ID (Gap-filling logic)
    if (!this.ikhId) {
        const prefix = this.role === 'teacher' ? 'IKH/TC/' : 'IKH/ST/';
        
        // Find existing IDs for the role using this.constructor (safer)
        const existingUsers = await this.constructor.find(
            { role: this.role, ikhId: { $regex: new RegExp(`^${prefix}`) } },
            { ikhId: 1 }
        ).sort({ ikhId: 1 });

        // Parse numbers from strings
        const usedNumbers = existingUsers.map(u => {
            const parts = u.ikhId.split('/');
            return parseInt(parts[parts.length - 1], 10);
        });

        // Find the first available gap in the sequence
        let nextNumber = 1;
        while (usedNumbers.includes(nextNumber)) {
            nextNumber++;
        }

        const paddedNumber = nextNumber.toString().padStart(3, '0');
        this.ikhId = `${prefix}${paddedNumber}`;
        
        if (this.role === 'student') {
            this.studentID = this.ikhId;
        }
    }

    // 2. PASSWORD HASHING
    // Skip if password is not modified or doesn't exist (OAuth users)
    if (!this.password || !this.isModified('password')) return;
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    } catch (err) {
        throw err;
    }
});

UserSchema.methods.comparePassword = async function(candidatePassword) {
    // Safety check for OAuth users who try to log in via local strategy
    if (!this.password) return false;
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);
