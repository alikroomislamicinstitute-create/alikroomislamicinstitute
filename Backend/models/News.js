const mongoose = require('mongoose');

const NewsSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true,
        trim: true 
    },
    content: { 
        type: String, 
        required: true 
    },
    date: { 
        type: Date, 
        default: Date.now 
    },
    author: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // <--- ADD THIS LINE
    }
}, { timestamps: true });

module.exports = mongoose.model('News', NewsSchema);