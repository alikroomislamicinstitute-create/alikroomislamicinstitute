const Message = require('../models/Message'); // Your Mongoose model

// Edit a single message
exports.editMessage = async (req, res) => {
    try {
        const { messageId, newText } = req.body;
        const message = await Message.findOneAndUpdate(
            { _id: messageId, sender: req.user.id }, // Ensure only sender can edit
            { text: newText, isEdited: true },
            { new: true }
        );
        if (!message) return res.status(404).json({ error: "Message not found or unauthorized" });
        res.json(message);
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};

// Batch delete messages
exports.deleteMessages = async (req, res) => {
    try {
        const { messageIds } = req.body;
        // Ensure user is the sender of these messages
        await Message.deleteMany({
            _id: { $in: messageIds },
            sender: req.user.id 
        });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
};