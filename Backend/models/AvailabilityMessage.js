const mongoose = require('mongoose');

const availabilityMessageSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    receiver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    course: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    role: {
        type: String, // 'teacher' or 'student'
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('AvailabilityMessage', availabilityMessageSchema);