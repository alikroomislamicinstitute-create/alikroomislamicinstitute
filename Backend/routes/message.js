const express = require('express');
const router = express.Router();
const AvailabilityMessage = require('../models/AvailabilityMessage');
const { verifyToken } = require('../middleware/authMiddleware');


// SEND MESSAGE
router.post('/send', verifyToken, async (req, res) => {
    try {
        const { receiverId, course, message } = req.body;

        const newMessage = new AvailabilityMessage({
            sender: req.user.id,
            receiver: receiverId,
            course,
            message,
            role: req.user.role
        });

        await newMessage.save();

        res.json({ success: true });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});


// GET MESSAGES (for logged in user)
router.get('/', verifyToken, async (req, res) => {
    try {
        const messages = await AvailabilityMessage.find({
            $or: [
                { sender: req.user.id },
                { receiver: req.user.id }
            ]
        }).sort({ createdAt: -1 });

        res.json({ success: true, messages });

    } catch (err) {
        res.status(500).json({ success: false });
    }
});

module.exports = router;