const express = require('express');
const router = express.Router();
const User = require('../models/User');
const TempUser = require('../models/TempUser'); 
const authController = require('../controllers/authController');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const { verifyToken } = require('../middleware/authMiddleware');
const agoraController = require('../controllers/agoraController');

router.get('/me', verifyToken, authController.getMe);
router.get('/contacts', verifyToken, authController.getContacts);
router.get('/chat-history/:otherId', verifyToken, authController.getChatHistory);
router.get('/token', verifyToken, agoraController.getAgoraToken);
/**
 * 1. COURSE LIST ROUTE
 * Fetches courses for the registration dropdown
 */
router.get('/courses', authController.getCourses);

/**
 * 2. REGISTRATION ROUTE
 */
router.post('/register', authController.register);

/**
 * 3. LOGIN ROUTE
 * Supports Email or IKH ID login.
 */
router.post('/login', authController.login);

/**
 * 4. MANUAL VERIFICATION ROUTES
 * These match the exports in your authController
 */
// Used by the frontend to verify the 6-digit code
router.post('/verify-manual', authController.verifyManual);

// Alias to ensure "verify-otp" calls also work if frontend uses that name
router.post('/verify-otp', authController.verifyOTP);

// Allows users to request a new code from admin
router.post('/resend-verification', authController.resendVerification);

// Alias for resend-otp
router.post('/resend-otp', authController.resendOTP);


/**
 * 5. GOOGLE OAUTH ROUTES
 */
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/login.html', session: false }),
    (req, res) => {
        const email = encodeURIComponent(req.user.email);
        const role = req.query.state || 'student'; 
        res.redirect(`/register.html?prefill_email=${email}&role=${role}`);
    }
);

/**
 * 6. LEGACY EMAIL LINK VERIFICATION (GET ROUTE)
 * Kept intact for the professional Success UI flow
 */
router.get('/verify/:token', async (req, res) => {
    try {
        const tempUser = await TempUser.findOne({ verificationToken: req.params.token });

        if (!tempUser) {
            return res.status(400).send(`
                <div style="text-align:center; margin-top:50px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
                    <h1 style="color:#e74c3c;">Link Invalid or Expired</h1>
                    <p>It seems this account is already verified or the registration window has closed.</p>
                    <a href="/login.html" style="color:#1b6e5f; text-decoration:none; font-weight:bold;">Go to Login</a>
                </div>
            `);
        }

        const newUser = new User({
            firstName: tempUser.firstName,
            lastName: tempUser.lastName,
            email: tempUser.email,
            password: tempUser.password, 
            role: tempUser.role,
            gender: tempUser.gender,
            nationality: tempUser.nationality,
            enrolledCourses: tempUser.enrolledCourses,
            managedCourses: tempUser.managedCourses,
            voucherKey: tempUser.voucherKey, 
            isVerified: true 
        });

        const savedUser = await newUser.save(); 
        await TempUser.deleteOne({ _id: tempUser._id });

        res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verification Successful | Al-Ikroom</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css">
    <style>
        :root { --primary: #1b6e5f; --dark: #0a143c; --white: #ffffff; }
        body { 
            margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; 
            min-height: 100vh; background: #f4f7f6; font-family: 'Segoe UI', Roboto, sans-serif;
        }
        .card {
            background: var(--white); padding: 40px; border-radius: 20px; text-align: center;
            box-shadow: 0 15px 35px rgba(0,0,0,0.1); max-width: 450px; width: 90%;
            transform: translateY(20px); opacity: 0; animation: fadeInUp 0.6s forwards;
        }
        @keyframes fadeInUp { to { transform: translateY(0); opacity: 1; } }
        .icon-box {
            width: 80px; height: 80px; background: #d1e7dd; color: var(--primary);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-size: 40px; margin: 0 auto 20px; animation: scaleIn 0.5s 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
            transform: scale(0);
        }
        @keyframes scaleIn { to { transform: scale(1); } }
        h1 { color: var(--dark); margin: 10px 0; font-size: 24px; }
        p { color: #666; line-height: 1.6; }
        .id-badge {
            background: var(--dark); color: #fff; padding: 15px; border-radius: 12px;
            margin: 25px 0; font-size: 22px; font-weight: bold; letter-spacing: 2px;
            display: inline-block; width: 100%; box-sizing: border-box;
            border-left: 5px solid var(--primary);
        }
        .loader-bar {
            height: 4px; width: 100%; background: #eee; border-radius: 10px;
            margin-top: 30px; overflow: hidden; position: relative;
        }
        .loader-fill {
            height: 100%; background: var(--primary); width: 0%;
            animation: progress 5s linear forwards;
        }
        @keyframes progress { from { width: 0%; } to { width: 100%; } }
        .redirect-text { font-size: 13px; color: #999; margin-top: 10px; }
    </style>
</head>
<body>
    <div class="card">
        <div class="icon-box"><i class="fas fa-check-circle"></i></div>
        <h1>Verification Successful!</h1>
        <p>Welcome to <strong>Al-Ikroom Islamic Institute</strong>. Your account has been verified successfully.</p>
        
        <p style="margin-bottom:5px; font-weight:bold; color:var(--dark);">Your Official IKH ID:</p>
        <div class="id-badge">${savedUser.ikhId}</div>
        
        <p style="font-size: 14px;">You can now use this ID or your email to log in.</p>

        <div class="loader-bar"><div class="loader-fill"></div></div>
        <p class="redirect-text">Redirecting to login page in <span id="seconds">5</span> seconds...</p>
    </div>

    <script>
        let timeLeft = 5;
        const timer = setInterval(() => {
            timeLeft--;
            document.getElementById('seconds').textContent = timeLeft;
            if(timeLeft <= 0) {
                clearInterval(timer);
                window.location.href = "https://alikroomislamicinstitute.onrender.com/login.html?verified=true";
            }
        }, 1000);
    </script>
</body>
</html>
        `);
        
    } catch (err) {
        console.error("Verification Error:", err);
        res.status(500).send(`
            <div style="text-align:center; margin-top:50px; font-family:Arial,sans-serif;">
                <h1 style="color:#e74c3c;">Server Error</h1>
                <p>An error occurred during verification: ${err.message}</p>
                <a href="/register.html">Try Registering Again</a>
            </div>
        `);
    }
});

module.exports = router;
