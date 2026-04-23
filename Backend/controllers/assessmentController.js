const Assessment = require('../models/Assessment');
const User = require('../models/User');

// @desc    Create a new assessment (Teacher only)
// @route   POST /api/teacher/create-assessment
exports.createAssessment = async (req, res) => {
    try {
        const { 
            courseName, title, description, type, 
            quizData, fileUrl, deadline, duration,
            eligibleStudents,
            startTime, // Added extraction
            endTime    // Added extraction
        } = req.body;

        // 1. Better Validation
        if (!courseName || !title) {
             return res.status(400).json({ success: false, message: "Course and Title are required" });
        }

        if (type === 'Quiz' && !deadline) {
            return res.status(400).json({ success: false, message: "Deadline is required" });
        }

        // 2. Safer Eligible Students Logic
        let finalEligible = [];
        if (Array.isArray(eligibleStudents)) {
            finalEligible = eligibleStudents.includes('all') ? [] : eligibleStudents;
        }

        const newAssessment = await Assessment.create({
            courseName,
            teacherId: req.user.id,
            title,
            description,
            type: type || 'Quiz',
            deadline,
            startTime, // Added to creation
            endTime,   // Added to creation
            duration: duration || 30,
            quizData: type === 'Quiz' ? (quizData || []) : [],
            fileUrl: type !== 'Quiz' ? fileUrl : null,
            eligibleStudents: finalEligible 
        });

        res.status(201).json({ success: true, assessment: newAssessment });
    } catch (err) {
        console.error("Quiz Creation Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Update an existing assessment (Teacher only)
// @route   PUT /api/teacher/assessments/:id
exports.updateAssessment = async (req, res) => {
    try {
        const { 
            courseName, title, description, type, 
            quizData, fileUrl, deadline, duration,
            eligibleStudents,
            startTime, 
            endTime    
        } = req.body;

        // 1. Validation logic consistent with creation
        if (!courseName || !title) {
             return res.status(400).json({ success: false, message: "Course and Title are required" });
        }

        // 2. Process Eligible Students for the update
        let finalEligible = [];
        if (Array.isArray(eligibleStudents)) {
            finalEligible = eligibleStudents.includes('all') ? [] : eligibleStudents;
        }

        // 3. Find and update the document
        const updatedAssessment = await Assessment.findByIdAndUpdate(
            req.params.id,
            {
                courseName,
                title,
                description,
                type: type || 'Quiz',
                deadline, 
                startTime, 
                endTime,   
                duration: duration || 30,
                quizData: type === 'Quiz' ? (quizData || []) : [],
                fileUrl: type !== 'Quiz' ? fileUrl : null,
                eligibleStudents: finalEligible 
            },
            { new: true, runValidators: true }
        );

        if (!updatedAssessment) {
            return res.status(404).json({ success: false, message: "Assessment not found" });
        }

        res.json({ success: true, assessment: updatedAssessment });
    } catch (err) {
        console.error("Quiz Update Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
};

// @desc    Get all assessments for a specific course (Teacher View)
// @route   GET /api/teacher/assessments/:courseName
exports.getCourseAssessments = async (req, res) => {
    try {
        const assessments = await Assessment.find({ courseName: req.params.courseName })
            .sort({ createdAt: -1 });
        res.json({ success: true, assessments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Get available assessments for student based on enrollment (Includes Pending & Completed)
// @route   GET /api/student/assessments
exports.getAvailableAssessments = async (req, res) => {
    try {
        const student = await User.findById(req.user.id);
        if (!student) return res.status(404).json({ success: false, message: "User not found" });

        const enrolledNames = student.enrolledCourses.map(c => c.courseName);

        // 1. Fetch Pending Assessments (Not submitted yet and not expired)
        const pending = await Assessment.find({
            courseName: { $in: enrolledNames },
            'submissions.userRef': { $ne: req.user.id },
            // Only show if it hasn't expired yet
            $or: [
                { endTime: { $exists: false } }, 
                { endTime: { $gte: new Date() } }
            ],
            $or: [
                { eligibleStudents: { $exists: false } },
                { eligibleStudents: { $size: 0 } },
                { eligibleStudents: req.user.id }
            ]
        }).select('-quizData.correctAnswer');

        // 2. Fetch Completed Assessments (Submitted by this student)
        const completedRaw = await Assessment.find({
            courseName: { $in: enrolledNames },
            'submissions.userRef': req.user.id
        }).select('-quizData.correctAnswer');

        // Extract specific submission data for the student
        const completed = completedRaw.map(asm => {
            const mySubmission = asm.submissions.find(s => s.userRef && s.userRef.toString() === req.user.id.toString());
            return {
                _id: asm._id,
                title: asm.title,
                type: asm.type,
                courseName: asm.courseName,
                score: mySubmission ? mySubmission.score : null,
                totalPossible: asm.type === 'Quiz' ? asm.quizData.reduce((acc, q) => acc + (q.points || 1), 0) : null,
                submittedAt: mySubmission ? mySubmission.submittedAt : null
            };
        });

        // Updated response with serverTime for synchronization
        res.json({ 
            success: true, 
            serverTime: new Date().toISOString(), 
            pending, 
            completed 
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};


// @desc    Submit an assessment (Student only - Text/File/Image)
// @route   POST /api/student/submit-assessment/:id
exports.submitAssessment = async (req, res) => {
    try {
        const assessment = await Assessment.findById(req.params.id);
        if (!assessment) {
            return res.status(404).json({ success: false, message: "Assessment not found" });
        }

        // Fetch full profile to get the display name and official ID
        const studentProfile = await User.findById(req.user.id);

        const submission = {
            userRef: req.user.id,
            studentName: `${studentProfile.firstName} ${studentProfile.lastName}`,
            registrationID: studentProfile.studentID, 
            answerText: req.body.answerText,
            fileUrl: req.file ? `/uploads/${req.file.filename}` : req.body.fileUrl, 
            submittedAt: new Date()
        };

        assessment.submissions.push(submission);
        await assessment.save();

        res.json({ success: true, message: "Submission successful" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};

// @desc    Submit a Quiz with Auto-Grading
// @route   POST /api/student/submit-quiz/:id
exports.submitQuiz = async (req, res) => {
    try {
        const { answers } = req.body; // Array of option indices from the student
        const assessment = await Assessment.findById(req.params.id);

        if (!assessment || assessment.type !== 'Quiz') {
            return res.status(404).json({ success: false, message: "Quiz not found" });
        }

        // --- TIME VALIDATION CHECK ---
        const now = new Date();
        if (assessment.startTime && now < assessment.startTime) {
            return res.status(403).json({ 
                success: false, 
                message: "This quiz hasn't started yet." 
            });
        }
        if (assessment.endTime && now > assessment.endTime) {
            return res.status(403).json({ 
                success: false, 
                message: "This quiz session has already closed." 
            });
        }
        // -----------------------------

        // Fetch the student's full profile to get their name and registration ID
        const studentProfile = await User.findById(req.user.id);

        // --- AUTO-GRADING LOGIC ---
        let totalScore = 0;
        assessment.quizData.forEach((question, index) => {
            if (answers[index] !== undefined && answers[index] === question.correctAnswer) {
                totalScore += (question.points || 1);
            }
        });

        const submission = {
            userRef: req.user.id,
            studentName: `${studentProfile.firstName} ${studentProfile.lastName}`,
            registrationID: studentProfile.studentID, // e.g., IKH/ST/001
            answers: answers,
            score: totalScore,
            submittedAt: new Date()
        };

        assessment.submissions.push(submission);
        await assessment.save();

        res.json({ 
            success: true, 
            message: "Quiz submitted successfully", 
            score: totalScore,
            totalPossible: assessment.quizData.reduce((acc, q) => acc + (q.points || 1), 0)
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
};
