/**
 * AL-IKROOM STUDENT DASHBOARD LOGIC
 * Backend: https://https://alikroomislamicinstitute.onrender.com/api
 */

const API_BASE = "https://alikroomislamicinstitute.onrender.com/api";

// 1. GLOBAL STATE
let currentLang = localStorage.getItem('lang') || 'en';
let studentData = {
    name: localStorage.getItem('full_name') || "Student",
    announcement: null,
    courses: [],
    resources: [] // Will store PDFs/Docs from the backend
};

// 2. INITIALIZATION
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    fetchStudentDashboardData(); 
});

async function fetchStudentDashboardData() {
    try {
        // 1. Get Latest Announcement
        const annRes = await fetch(`${API_BASE}/teacher/announcements/latest`);
        const annData = await annRes.json();
        
        if (annData.success && annData.announcement) {
            studentData.announcement = {
                title: annData.announcement.title,
                message: annData.announcement.message,
                date: new Date(annData.announcement.createdAt).toLocaleDateString()
            };
        }

        // 2. Get Student Profile & Progress
        const userRes = await fetch(`${API_BASE}/auth/me`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('userToken')}` }
        });
        const userData = await userRes.json();
        
        if (userData.success) {
            studentData.name = userData.user.firstName;
            studentData.courses = userData.user.courses || [];
        }

        // 3. NEW: Get Learning Resources (Shared Files)
        const resRes = await fetch(`${API_BASE}/teacher/resources`);
        const resData = await resRes.json();

        if (resData.success) {
            studentData.resources = resData.resources.map(r => ({
                title: r.title,
                course: r.course,
                // Pointing to your conventional backend uploads folder
                url: `const API_URL = "https://alikroomislamicinstitute.onrender.com/api/auth/login";
${r.fileUrl}` 
            }));
        }

        render(); 
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
        render(); 
    }
}

// 3. THE RENDER ENGINE
function render() {
    const t = i18n[currentLang];
    const isAr = currentLang === 'ar';
    document.dir = isAr ? 'rtl' : 'ltr';

    // Header & Stats
    document.getElementById('userName').innerText = `${t.welcome}, ${studentData.name}`;
    document.getElementById('welcomeSub').innerText = t.sub;
    document.getElementById('countEnrolled').innerText = studentData.courses.length;
    
    const avg = studentData.courses.length > 0 
        ? Math.round(studentData.courses.reduce((s, c) => s + (c.progress || 0), 0) / studentData.courses.length) 
        : 0;
    document.getElementById('avgProgress').innerText = `${avg}%`;

    // Announcement Logic
    const annBox = document.getElementById('announcementBox');
    if (studentData.announcement) {
        annBox.style.display = 'block';
        document.getElementById('announcementTitle').innerText = studentData.announcement.title;
        document.getElementById('announcementText').innerText = studentData.announcement.message;
        document.getElementById('announcementDate').innerText = studentData.announcement.date;
    }

    // Courses Grid
    const courseGrid = document.getElementById('courseGrid');
    courseGrid.innerHTML = studentData.courses.length > 0 ? "" : `<div class="glass-card">${t.noCourses}</div>`;
    
    studentData.courses.forEach(c => {
        courseGrid.innerHTML += `
            <div class="glass-card">
                <h4 style="color:var(--primary-green); margin:0;">${c.name}</h4>
                <div class="progress-container" style="margin:15px 0;">
                    <div class="progress-bar" style="width:${c.progress}%"></div>
                </div>
                <span style="font-size:0.8rem; opacity:0.7;">Progress: ${c.progress}%</span>
            </div>
        `;
    });

    // --- NEW: Resources Grid Logic ---
    const resourceGrid = document.getElementById('resourceGrid');
    if (resourceGrid) {
        resourceGrid.innerHTML = studentData.resources.length > 0 ? "" : `<div class="glass-card" style="grid-column:1/-1; text-align:center; opacity:0.5;">${t.noResources}</div>`;
        
        studentData.resources.forEach(r => {
            resourceGrid.innerHTML += `
                <div class="glass-card" style="display: flex; gap: 15px; align-items: center; padding: 15px 20px;">
                    <div style="font-size:1.4rem; color:var(--primary-green);"><i class="fa-solid fa-file-pdf"></i></div>
                    <div style="flex-grow:1;">
                        <div style="font-weight:700; font-size:0.9rem;">${r.title}</div>
                        <div style="font-size:0.75rem; opacity:0.6;">${r.course}</div>
                    </div>
                    <a href="${r.url}" download style="color:var(--primary-green); font-size:1.2rem;"><i class="fa-solid fa-circle-down"></i></a>
                </div>
            `;
        });
    }

    document.getElementById('langText').innerText = isAr ? 'English' : 'العربية';
}

// 4. TRANSLATIONS
const i18n = {
    en: { 
        welcome: "Assalamu Alaikum", 
        sub: "Continue your journey.", 
        noCourses: "No courses yet.",
        noResources: "No study materials available." 
    },
    ar: { 
        welcome: "السلام عليكم", 
        sub: "واصل رحلتك.", 
        noCourses: "لا توجد دورات.",
        noResources: "لا توجد مواد دراسية متاحة." 
    }
};

// 5. THEME & UTILS
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

document.getElementById('langToggle').onclick = () => {
    currentLang = currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem('lang', currentLang);
    render();
};