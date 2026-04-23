const mongoose = require('mongoose');

const VoucherSchema = new mongoose.Schema({
    key: { 
        type: String, 
        required: true, 
        unique: true,
        trim: true,
        uppercase: true // Optional: Force the voucher code to be uppercase (e.g., STU-123)
    },
    role: { 
        type: String, 
        enum: ['student', 'teacher'], 
        required: true,
        lowercase: true, // 👈 ALWAYS save as 'student' or 'teacher'
        trim: true       // 👈 Removes accidental spaces
    },
    isUsed: { 
        type: Boolean, 
        default: false 
    },
    usedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        default: null 
    },
 createdAt: { 
        type: Date, 
        default: Date.now,
        index: { expires: '15m' } 
 }
 
});

module.exports = mongoose.model('Voucher', VoucherSchema);