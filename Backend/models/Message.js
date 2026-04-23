const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    thumbnailUrl: { type: String, default: null }, // ✅ comma added

    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },

    recipient: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },

    text: { type: String }, // Optional if a file is sent

    fileUrl: { type: String },
    fileName: { type: String },

    fileType: { 
        type: String, 
        enum: ['image', 'video', 'audio', 'document'] 
    },

    timestamp: { 
        type: Date, 
        default: Date.now, 
        index: { expires: '7d' } // auto-delete after 7 days
    },

    isStarred: { type: Boolean, default: false },
    isDeletedForEveryone: { type: Boolean, default: false },
});

module.exports = mongoose.model('Message', MessageSchema);