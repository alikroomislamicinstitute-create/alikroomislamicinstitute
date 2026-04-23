// middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const verifyToken = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
            if (err) return res.status(403).json({ message: "Token is invalid" });
            req.user = decoded;
            next();
        });
    } else {
        res.status(401).json({ message: "You are not authenticated" });
    }
};

// CRITICAL: You must export it like this
module.exports = { verifyToken };