const mongoose = require('mongoose');

const TeacherSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // Hashed
  
  // This array links the Teacher to specific Programs
  managedCourses: [{
    courseId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Course' 
    },
    name: String // e.g., "Arabic Grammar Level 1"
  }],

  role: { type: String, default: 'teacher' },
  bio: { type: String }, // Optional: "Ustadh at Al-Ikroom since 2020"
  profileImage: { type: String } 
}, { timestamps: true });

module.exports = mongoose.model('Teacher', TeacherSchema);