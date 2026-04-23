const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/authMiddleware');
const agoraController = require('../controllers/agoraController');

// Secure the token generation with your existing middleware
router.get('/token', verifyToken, agoraController.getAgoraToken);

module.exports = router;