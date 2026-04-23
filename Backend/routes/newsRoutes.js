const express = require('express');
const router = express.Router();
const newsController = require('../controllers/newsController'); // Import the whole object
const { verifyToken } = require('../middleware/authMiddleware');

/**
 * @route   GET /api/news
 * @desc    Fetch all announcements for the home page
 * @access  Public
 */
router.get('/', newsController.getAllNews);

/**
 * @route   POST /api/news
 * @desc    Create a new announcement
 * @access  Private (Admin)
 * @note    Using verifyToken to ensure the user is logged in.
 */
router.post('/', verifyToken, newsController.createNews);

/**
 * @route   DELETE /api/news/:id
 * @desc    Delete an announcement
 * @access  Private (Admin)
 */
// ADDED DELETE ROUTE:
router.delete('/:id', verifyToken, newsController.deleteNews);

// Once you implement specific role-based checks, you can change the above to:
// router.post('/', verifyToken, admin, newsController.createNews);

module.exports = router;