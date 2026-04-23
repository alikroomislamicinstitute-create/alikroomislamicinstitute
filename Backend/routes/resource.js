// resourceRoute.js or within your main api router
const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const path = require('path');

router.get('/download/:id', async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) return res.status(404).send("File not found");

        // Construct the full path to the file
        // resource.fileUrl usually looks like "/uploads/171113...filename.pdf"
        const filePath = path.join(__dirname, '..', resource.fileUrl);
        
        // This forces the browser to download the file with its original title
        res.download(filePath, resource.title || "download"); 
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;