const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const Message = require('./models/Message');
const Resource = require('./models/Resource');
const User = require('./models/User');
const Announcement = require('./models/Announcement');
const agoraRoutes = require('./routes/agora'); // Note the './'

const app = express();
const server = http.createServer(app);

// --- SOCKET.IO SETUP ---
const io = new Server(server, {
    cors: {
        origin: [
            "http://localhost:5000",
            "http://127.0.0.1:5500",
            "http://localhost:5500",
            "https://alikroomislamicinstitute.onrender.com",
        ],
        methods: ["GET", "POST"]
    }
});

// Store active users: { socketId: identifier }
const onlineUsers = new Map();

io.on('connection', (socket) => {
    console.log('👤 User connected:', socket.id);

    socket.on('user-online', ({ userId }) => {
        onlineUsers.set(socket.id, userId);
        socket.join(userId);

        io.emit('update-status', Array.from(onlineUsers.values()));
    });

    // ================================
    // SEND MESSAGE
    // ================================
    socket.on('send_private_message', async (data) => {
        const { senderId, recipientId, text, fileUrl, fileName, fileType, thumbnailUrl } = data;

        try {
            const newMessage = await Message.create({
                sender: senderId,
                recipient: recipientId,
                text: text || "",
                fileUrl: fileUrl || null,
                fileName: fileName || null,
                fileType: fileType || null,
                thumbnailUrl: thumbnailUrl || null,
                status: 'sent'
            });

            io.to(recipientId).emit('receive_private_message', newMessage);
            io.to(senderId).emit('message_sent', newMessage);

            await Message.findByIdAndUpdate(newMessage._id, {
                status: 'delivered'
            });

            io.to(senderId).emit('message_status_update', {
                messageId: newMessage._id,
                status: 'delivered'
            });

        } catch (err) {
            console.error("Message error:", err);
        }
    });

    // ================================
    // MESSAGE SEEN (CRITICAL FIX)
    // ================================
    socket.on('message_seen', async ({ messageId, senderId }) => {
        try {
            const msg = await Message.findByIdAndUpdate(
                messageId,
                { status: 'seen' },
                { new: true }
            );

            if (!msg) return;

            // notify sender
            io.to(senderId).emit('message_status_update', {
                messageId,
                status: 'seen'
            });

        } catch (err) {
            console.error("Seen status error:", err);
        }
    });

    // ================================
    // ALTERNATIVE: BULK CHAT SEEN
    // ================================
    socket.on('mark_chat_seen', async ({ senderId, recipientId }) => {
        try {
            await Message.updateMany(
                { sender: senderId, recipient: recipientId, status: { $ne: 'seen' } },
                { status: 'seen' }
            );

            io.to(senderId).emit('message_status_update_bulk', {
                senderId,
                recipientId,
                status: 'seen'
            });

        } catch (err) {
            console.error("Chat seen error:", err);
        }
    });

    socket.on('typing', ({ recipientId, senderId }) => {
        io.to(recipientId).emit('user_typing', { senderId });
    });

    socket.on('stop_typing', ({ recipientId, senderId }) => {
        io.to(recipientId).emit('user_stop_typing', { senderId });
    });

    // ================================
    // CALL SIGNALING HANDLERS
    // ================================

    socket.on('request-call', (data) => {
        console.log(`📞 Call request: ${data.fromName} (${data.from}) → ${data.to}`);
        if (!data.to) return console.log("❌ Missing recipient ID");

        io.to(data.to).emit('incoming-call-notice', {
            from: data.from,
            fromName: data.fromName,
            type: data.type,
            channelName: data.channelName
        });
    });

    socket.on('accept-call', (data) => {
        console.log(`✅ Call accepted by ${data.from} → ${data.to}`);
        io.to(data.to).emit('call-accepted', {
            from: data.from,
            channelName: data.channelName
        });
    });

    socket.on('decline-call', (data) => {
        console.log(`❌ Call declined by ${data.from}`);
        io.to(data.to).emit('call-declined', {
            from: data.from
        });
    });

    socket.on('end-call', (data) => {
        console.log(`🔴 Call ended by ${data.from}`);
        io.to(data.to).emit('call-ended', {
            from: data.from
        });
    });

    socket.on('call-reaction', (data) => {
        io.to(data.to).emit('call-reaction', {
            emoji: data.emoji,
            from: socket.id
        });
    });

    socket.on('disconnect', () => {
        onlineUsers.delete(socket.id);
        io.emit('update-status', Array.from(onlineUsers.values()));
    });
});

// --- MULTER CONFIGURATION ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage });

const thumbPath = path.join(__dirname, 'uploads/thumbnails');
if (!fs.existsSync(thumbPath)) {
    fs.mkdirSync(thumbPath, { recursive: true });
}

// --- MIDDLEWARE ---
app.use(cors({
    origin: [
        'http://127.0.0.1:5500', 
        'http://localhost:5500', 
        'http://localhost:5000', 
        'https://alikroomislamicinstitute.onrender.com'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Serve the uploads folder statically
const uploadPath = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
    console.log("📁 Created 'uploads' directory.");
}
app.use('/uploads', express.static(uploadPath));

// --- API ROUTES ---

app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "*");
    next();
});

app.post('/api/messages/upload', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

    // FIX: Defining protocol and host
    const protocol = req.protocol;
    const host = req.get('host');

    let type = 'document';
    const mime = req.file.mimetype;

    if (mime.startsWith('image/')) type = 'image';
    else if (mime.startsWith('video/')) type = 'video';
    else if (mime.includes('audio') || mime.includes('webm')) type = 'audio';

    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    
    // =========================
    // 🎬 VIDEO THUMBNAIL LOGIC
    // =========================
    if (type === 'video') {
        const thumbnailName = req.file.filename + '.jpg';
        const thumbnailPath = path.join(__dirname, 'uploads/thumbnails', thumbnailName);

        try {
            await new Promise((resolve, reject) => {
                ffmpeg(path.join(__dirname, 'uploads', req.file.filename))
                    .screenshots({
                        timestamps: ['1'],
                        filename: thumbnailName,
                        folder: path.join(__dirname, 'uploads/thumbnails'),
                        size: '320x240'
                    })
                    .on('end', resolve)
                    .on('error', reject);
            });

            // FIX: Removed invalid 'const' inside JSON object
            return res.json({
                url: fileUrl,
                name: req.file.originalname,
                type: type,
                thumbnailUrl: `${protocol}://${host}/uploads/thumbnails/${thumbnailName}`
            });

        } catch (err) {
            console.error("Thumbnail error:", err);
        }
    }

    res.json({
        url: fileUrl,
        name: req.file.originalname,
        type: type
    });
});

// --- RESOURCE DOWNLOAD ROUTE ---
app.get('/api/resource/download/:id', async (req, res) => {
    try {
        const resource = await Resource.findById(req.params.id);
        if (!resource) return res.status(404).json({ success: false, message: "File not found" });

        const cleanPath = resource.fileUrl.replace(/^\/+/, '');
        const filePath = path.join(__dirname, cleanPath);

        if (fs.existsSync(filePath)) {
            res.download(filePath, resource.title);
        } else {
            res.status(404).json({ success: false, message: "Physical file missing on server" });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// --- DYNAMIC CONTACT LIST APIs ---
app.get('/api/teacher/my-students', async (req, res) => {
    try {
        const students = await User.find({ role: 'student' }).select('_id firstName lastName registrationNumber');
        const formattedStudents = students.map(s => ({
            _id: s._id,
            registrationNumber: s.registrationNumber,
            fullName: `${s.firstName} ${s.lastName}`.trim()
        }));
        res.json({ success: true, students: formattedStudents });
    } catch (err) {
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

app.get('/api/teacher/my-courses-students', async (req, res) => {
    try {
        const students = await User.find({
            role: 'student',
            enrolledCourses: { $exists: true, $not: { $size: 0 } }
        }).select('_id firstName lastName enrolledCourses registrationNumber');

        const courseGrouping = {};
        students.forEach(student => {
            const fullName = `${student.firstName} ${student.lastName}`;
            const courses = student.enrolledCourses.map(c => typeof c === 'string' ? c : c.courseName);
            courses.forEach(courseName => {
                if (!courseGrouping[courseName]) courseGrouping[courseName] = [];
                courseGrouping[courseName].push({
                    _id: student._id,
                    registrationNumber: student.registrationNumber,
                    name: fullName
                });
            });
        });

        const result = Object.keys(courseGrouping).map(course => ({
            courseName: course,
            students: courseGrouping[course]
        }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/student/my-courses-teachers', async (req, res) => {
    try {
        const teachers = await User.find({
            role: 'teacher',
            managedCourses: { $exists: true, $not: { $size: 0 } }
        }).select('_id firstName lastName managedCourses ikhId');

        const courseGrouping = {};
        teachers.forEach(teacher => {
            const fullName = `${teacher.firstName} ${teacher.lastName}`;
            teacher.managedCourses.forEach(course => {
                const courseName = course.name;
                if (!courseGrouping[courseName]) courseGrouping[courseName] = [];
                courseGrouping[courseName].push({
                    _id: teacher._id,
                    ikhId: teacher.ikhId,
                    name: fullName
                });
            });
        });

        const result = Object.keys(courseGrouping).map(course => ({
            courseName: course,
            teachers: courseGrouping[course]
        }));
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- ROUTES SETUP ---
const adminRoutes = require('./routes/admin'); 
app.use('/api/admin', adminRoutes);
app.use('/api/auth', require('./routes/authRoute'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/student', require('./routes/student'));
app.use('/api/news', require('./routes/newsRoutes'));
app.use('/api/messages', require('./routes/message'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/agora', agoraRoutes);

// ✅ SERVE FRONTEND (MUST BE LAST)
app.use(express.static(path.join(__dirname, '../Frontend')));

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// FIX: Express 5 wildcard compatible path
app.get('/:any*', (req, res) => {
    res.sendFile(path.join(__dirname, '../Frontend/index.html'));
});

// --- DATABASE & SERVER START ---
const startServer = async () => {
    try {
        mongoose.set('strictQuery', false);
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Al-Ikroom Database Connected');

        const PORT = process.env.PORT || 5000;
        server.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });

    } catch (err) {
        console.error('❌ Database Connection Error:', err.message);
        process.exit(1);
    }
};

// Announcement cleanup every hour
setInterval(async () => {
    try {
        const cutoff = new Date(Date.now() - (48 * 60 * 60 * 1000));
        await Announcement.deleteMany({ createdAt: { $lt: cutoff } });
        console.log("Old announcements cleaned");
    } catch (err) {
        console.error("Cleanup error:", err);
    }
}, 60 * 60 * 1000); 

startServer();

