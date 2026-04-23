const User = require('../models/User');
const Voucher = require('../models/Voucher');
const Course = require('../models/Course'); 
const TempUser = require('../models/TempUser'); 
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const Message = require('../models/Message');

exports.getContacts = async (req, res) => {
    try {
        const currentUser = await User.findById(req.user.id);
        if (!currentUser) return res.status(404).json({ success: false, message: "User not found" });

        let contacts = [];

        if (currentUser.role === 'student') {
            // Get the list of names of courses the student is in
            const studentCourseNames = currentUser.enrolledCourses.map(c => c.courseName);
            
            // Find teachers who manage a course with a matching name
            contacts = await User.find({
                role: 'teacher',
                'managedCourses.name': { $in: studentCourseNames }
            }).select('firstName lastName ikhId role');

        } else if (currentUser.role === 'teacher') {
            // Get the list of names of courses the teacher manages
            const teacherCourseNames = currentUser.managedCourses.map(c => c.name);
            
            // Find students enrolled in a course with a matching name
            contacts = await User.find({
                role: 'student',
                'enrolledCourses.courseName': { $in: teacherCourseNames }
            }).select('firstName lastName ikhId role');
        }

        res.json({ success: true, contacts });
    } catch (err) {
        console.error("Contact Fetch Error:", err);
        res.status(500).json({ success: false, message: "Server error fetching contacts" });
    }
};

exports.getChatHistory = async (req, res) => {
    try {
        const myId = req.user.id;
        const otherId = req.params.otherId;

        // Fetch messages where (I sent to them) OR (They sent to me)
        const history = await Message.find({
            $or: [
                { sender: myId, recipient: otherId },
                { sender: otherId, recipient: myId }
            ]
        }).sort({ timestamp: 1 }); // Sort by time (oldest first)

        res.json({ success: true, history });
    } catch (err) {
        console.error("Chat History Error:", err);
        res.status(500).json({ success: false, message: "Could not load chat history" });
    }
};

/**
 * @desc    GET all courses for the registration dropdown
 * @route   GET /api/auth/courses
 */
exports.getCourses = async (req, res) => {
    try {
        const courses = await Course.find().select('title _id'); 
        res.json({ success: true, courses });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

/**
 * @desc    Login user (Email or IKH ID)
 * @route   POST /api/auth/login
 */
exports.login = async (req, res) => {
    try {
        const { identifier, password } = req.body; 

        if (!identifier) {
            return res.status(400).json({ success: false, message: "Email or ID is required" });
        }

        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { ikhId: identifier } 
            ]
        }).select('+password');

        if (!user || !(await user.comparePassword(password))) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        if (!user.isVerified) {
            return res.status(401).json({ 
                success: false, 
                message: "Your account is pending manual verification. Please enter the code sent to you by the Admin." 
            });
        }

        const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1d' });

        res.json({
            success: true,
            token,
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                ikhId: user.ikhId 
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

/**
 * @desc    Register a new user (Teacher or Student)
 * @route   POST /api/auth/register
 */
exports.register = async (req, res) => {
    try {
        const { 
            firstName, middleName, lastName, email, phone,
            password, role, gender, nationality, 
            voucherKey, managedCourses, enrolledCourses 
        } = req.body;

        const cleanEmail = email ? email.toLowerCase() : '';
        const cleanRole = role ? role.toLowerCase() : 'student';

        const voucher = await Voucher.findOne({ 
            key: voucherKey,
            role: { $regex: new RegExp(`^${cleanRole}$`, 'i') }, 
            isUsed: false 
        });

        if (!voucher) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid, expired, or already used voucher.' 
            });
        }

        const existingUser = await User.findOne({ email: cleanEmail });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'Email already registered and verified.' });
        }

        await TempUser.deleteOne({ email: cleanEmail });

        let sanitizedManaged = [];
        let managedIds = []; 
        if (Array.isArray(managedCourses) && managedCourses.length > 0) {
            managedIds = managedCourses; 
            const teacherCoursesDB = await Course.find({ _id: { $in: managedCourses } });
            sanitizedManaged = managedCourses.map(id => {
                const found = teacherCoursesDB.find(c => c._id.toString() === id.toString());
                return {
                    name: found ? found.title : `Course ${id}`,
                    code: 'PRG', 
                    description: found ? found.description : 'Active instructional program.'
                };
            });
        }

        let sanitizedEnrolled = [];
        if (Array.isArray(enrolledCourses) && enrolledCourses.length > 0) {
            const coursesFromDB = await Course.find({ _id: { $in: enrolledCourses } });
            sanitizedEnrolled = enrolledCourses.map(id => {
                const foundCourse = coursesFromDB.find(c => c._id.toString() === id.toString());
                return {
                    course: id, 
                    courseName: foundCourse ? foundCourse.title : "Unknown Course", 
                    progress: 0,
                    enrollmentDate: new Date()
                };
            });
        }

        const tempUser = new TempUser({
            firstName,
            middleName,
            lastName,
            email: cleanEmail,
            phone,
            password, 
            role: cleanRole,
            gender,
            nationality,
            voucherKey,
            managedCourses: sanitizedManaged,
            managedCourseIds: managedIds,
            enrolledCourses: sanitizedEnrolled
        });

        await tempUser.save();

        return res.status(201).json({
            success: true,
            message: "Registration submitted! Please wait for Admin to generate your verification code."
        });

    } catch (error) {
        console.error("❌ Registration Error:", error);
        res.status(500).json({ success: false, message: "Registration failed", error: error.message });
    }
};

exports.getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Server error" });
    }
};

/**
 * @desc    Verify 6-digit code and promote TempUser to official User
 * @route   POST /api/auth/verify-manual
 */
exports.verifyManual = async (req, res) => {
    try {
        const { identifier, code } = req.body; 

        if (!identifier || !code) {
            return res.status(400).json({ success: false, message: "Identifier and code are required." });
        }

        const tempUser = await TempUser.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { phone: identifier }
            ]
        });

        if (!tempUser) {
            return res.status(404).json({ success: false, message: "No pending registration found for this user." });
        }

        // ✅ NEW: Block if admin has not generated OTP
        if (!tempUser.manualVerificationCode) {
            return res.status(400).json({
                success: false,
                message: "OTP has not been generated yet. Please contact Admin."
            });
        }

        if (tempUser.codeExpires && tempUser.codeExpires < Date.now()) {
            return res.status(400).json({ success: false, message: "Verification code has expired." });
        }

        if (tempUser.verificationAttempts >= 5) {
            return res.status(403).json({ success: false, message: "Too many failed attempts." });
        }

        if (tempUser.manualVerificationCode !== code) {
            tempUser.verificationAttempts += 1;
            await tempUser.save();
            return res.status(400).json({ success: false, message: "Invalid verification code." });
        }

        const userData = tempUser.toObject();
        delete userData._id; 
        delete userData.createdAt; 
        delete userData.manualVerificationCode;
        delete userData.codeExpires;
        delete userData.verificationAttempts;
        
        const newUser = new User({
            ...userData,
            isVerified: true
        });

        await newUser.save();

        // ✅ NEW: Mark voucher used AFTER successful verification
        const voucher = await Voucher.findOne({ key: tempUser.voucherKey });
        if (voucher) {
            voucher.isUsed = true;
            voucher.usedBy = newUser._id;
            await voucher.save();
        }

        await TempUser.deleteOne({ _id: tempUser._id });

        res.status(200).json({
            success: true,
            message: "Account verified successfully!",
            ikhId: newUser.ikhId 
        });

    } catch (error) {
        console.error("❌ Manual Verification Error:", error);
        res.status(500).json({ success: false, message: "Verification failed", error: error.message });
    }
};

/**
 * @desc    Resend manual verification code
 */
exports.resendVerification = async (req, res) => {
    try {
        const { email } = req.body;
        const tempUser = await TempUser.findOne({ email: email.toLowerCase() });

        if (!tempUser) {
            return res.status(404).json({ success: false, message: "No pending registration found." });
        }

        const newCode = crypto.randomInt(100000, 999999).toString();
        tempUser.manualVerificationCode = newCode;
        tempUser.codeExpires = Date.now() + 30 * 60 * 1000;
        tempUser.verificationAttempts = 0;
        await tempUser.save();

        res.json({ success: true, message: "A new verification code has been generated. Contact Admin to receive it." });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.verifyOTP = exports.verifyManual;
exports.resendOTP = exports.resendVerification;
