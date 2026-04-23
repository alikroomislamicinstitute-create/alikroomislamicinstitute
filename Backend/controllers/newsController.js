const News = require('../models/News');

// Ensure the name is exactly 'getAllNews'
exports.getAllNews = async (req, res) => {
    try {
        const news = await News.find().sort({ date: -1 });
        res.json({ success: true, news });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

// Ensure the name is exactly 'createNews'
exports.createNews = async (req, res) => {
    try {
        // We extract both naming styles to ensure no 'undefined' errors 
        // and match the requested implementation logic
        const newsTitle = req.body.newsTitle || req.body.title;
        const newsContent = req.body.newsContent || req.body.content;

        if (!newsTitle || !newsContent) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing data: newsTitle and newsContent are required" 
            });
        }

        const newAnnouncement = await News.create({
            title: newsTitle,
            content: newsContent,
            author: req.user ? req.user.id : null
        });

        res.status(201).json({ success: true, data: newAnnouncement });
    } catch (err) {
        console.error("POST NEWS ERROR:", err);
        res.status(400).json({ success: false, message: err.message });
    }
};

// Ensure the name is exactly 'deleteNews'
exports.deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedAnnouncement = await News.findByIdAndDelete(id);

        if (!deletedAnnouncement) {
            return res.status(404).json({ success: false, message: "Announcement not found" });
        }

        res.json({ success: true, message: "Announcement deleted successfully" });
    } catch (err) {
        console.error("DELETE NEWS ERROR:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};