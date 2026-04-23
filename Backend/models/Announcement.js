const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  title: { 
    type: String, 
    required: true 
  },
  message: { 
    type: String, 
    required: true 
  },
  author: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  priority: { 
    type: String, 
    enum: ['normal', 'urgent'], 
    default: 'normal' 
  },
  course: { 
    type: String, 
    default: 'All' 
  },
  eligibleStudents: [{ 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  }], 
  isForAllStudents: { 
    type: Boolean, 
    default: true 
  },
  // This field controls the 48-hour auto-deletion
  expiresAt: { 
    type: Date, 
    required: true 
  }
}, { timestamps: true });

// CRITICAL: Tells MongoDB to delete the document when the current time matches expiresAt
AnnouncementSchema.index({ "expiresAt": 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);