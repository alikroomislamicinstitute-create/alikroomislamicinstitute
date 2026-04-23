const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  // --- English Fields ---
  title: { 
    type: String, 
    required: [true, 'Course title is required'],
    trim: true
  }, // e.g., "Tajweed Al-Qur'an"
  
  description: { 
    type: String,
    default: 'Active instructional program.'
  },
  
  teacherName: { 
    type: String 
  }, // Stores the name directly from admin input
  
  // --- Arabic Fields (Upgrades) ---
  arTitle: { 
    type: String 
  }, // e.g., "تجويد القرآن"
  
  arDesc: { 
    type: String 
  },
  
  arPrice: { 
    type: String 
  }, // Supports Arabic numerals/text like "١٠$"

  arCategory: { 
    type: String 
  }, // Added for full Arabic dashboard support

  // --- System & Relations ---
  instructor: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' // Link to the Teacher's User ID
  },
  
  teacherId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }, 
  
  category: { 
    type: String, 
    enum: ['Hifz', 'Tajweed', 'Arabic', 'General'],
    default: 'General'
  },
  
  price: { 
    type: Number, 
    required: true, 
    default: 0 
  },
  
  thumbnail: { 
    type: String, 
    default: 'https://images.pexels.com/photos/8164381/pexels-photo-8164381.jpeg' 
  }
}, { 
  // Automatically manages createdAt and updatedAt
  timestamps: true,
  // Explicitly mapping to the 'courses' collection in MongoDB
  collection: 'courses' 
});

// CRITICAL FIX: Export as the model itself, not an object.
// This prevents the "Course.find is not a function" error.
module.exports = mongoose.model('Course', courseSchema);