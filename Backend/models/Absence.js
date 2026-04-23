const mongoose = require('mongoose');

const AbsenceSchema = new mongoose.Schema({
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: String,
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    courseName: { type: String, required: true },
    reason: { type: String, required: true },
    absenceDate: { type: Date, default: Date.now },
    status: { type: String, default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('Absence', AbsenceSchema);