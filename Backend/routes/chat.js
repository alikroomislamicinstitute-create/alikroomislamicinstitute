const express = require('express');
const router = express.Router();
const Message = require('../models/Message'); 
const { verifyToken } = require('../middleware/authMiddleware');

// SEND MESSAGE
router.post('/send', verifyToken, async (req, res) => {
    try {
        const { recipientId, text } = req.body;

        if (!recipientId || !text || text.trim() === "") {
            return res.status(400).json({ error: "Invalid message data" });
        }

        const newMessage = new Message({
            senderId: req.user.id,
            recipientId: recipientId,
            text: text.trim()
        });

        await newMessage.save();

        res.json({ success: true, message: newMessage });
    } catch (err) {
        res.status(500).json({ error: "Failed to send message" });
    }
});

// DELETE MESSAGES
router.delete('/batch-delete', verifyToken, async (req, res) => {
    try {
        const { messageIds } = req.body;

        const result = await Message.deleteMany({
            _id: { $in: messageIds },
            sender: req.user.id // Only delete if the logged-in user is the sender
        });

        if (result.deletedCount === 0) {
            return res.status(403).json({ error: "You can only delete your own messages." });
        }

        res.json({ success: true, count: result.deletedCount });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

// EDIT MESSAGE
router.patch('/edit', verifyToken, async (req, res) => {
    try {
        const { messageId, newText } = req.body;

        if (!newText || newText.trim() === "") {
            return res.status(400).json({ error: "Message cannot be empty" });
        }

        const message = await Message.findOneAndUpdate(
            { _id: messageId, senderId: req.user.id },
            { text: newText.trim() },
            { new: true }
        );

        if (!message) {
            return res.status(404).json({ error: "Message not found" });
        }

        res.json({ success: true, message });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

module.exports = router;