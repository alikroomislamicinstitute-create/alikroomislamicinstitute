// js/dashboard-student.js

document.addEventListener('DOMContentLoaded', () => {
    /* --- 1. INITIALIZATION & SESSION --- */
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    let currentLang = localStorage.getItem('lang') || 'en';

    const token = localStorage.getItem('userToken');
    const userRole = localStorage.getItem('userRole');

    // Security Guard: Redirect if not logged in as student
    if (!token || userRole !== 'student') {
        window.location.href = "login.html";
        return;
    }

    /* --- 2. THE "BLANK SLATE" DATA OBJECT --- */
    // This is set to null/empty by default. 
    // It will be populated by your fetch() call to the Node.js/Supabase backend.
    let studentData = {
        name: localStorage.getItem('userName') || "Student",
        announcement: null, // Set to { title: "", message: "", priority: "urgent/normal" } by teacher
        courses: [],        // Array of { name, code, progress, teacherNote }
        resources: []       // Array of { title, courseName, url }
    };

    /* --- 3. TRANSLATION DICTIONARY --- */
    const i18n = {
        en: {
            welcome: "Assalamu Alaikum wa Rahmatullahi wa Barakatuh",
            sub: "Your academic overview",
            enrolled: "Courses",
            avg: "Progress",
            courses: "My Active Learning",
            resources: "Learning Resources",
            announcement: "Notice Board",
            urgent: "Urgent Update",
            noCourses: "No courses registered yet. Use 'Manage Courses' to begin.",
            noResources: "Waiting for teacher to upload study materials...",
            waiting: "Pending teacher review...",
            logout: "Logout",
            manage: "Manage Courses",
            dark: "Dark Mode",
            light: "Light Mode",
            uploadVibe: "Teachers will upload resources for your registered courses here."
        },
        ar: {
            welcome: "السلام عليكم ورحمة الله وبركاته",
            sub: "نظرة عامة على دراستك",
            enrolled: "الدورات",
            avg: "التقدم",
            courses: "تعلمي النشط",
            resources: "مصادر التعلم",
            announcement: "لوحة الإعلانات",
            urgent: "تحديث عاجل",
            noCourses: "لم يتم تسجيل أي دورات بعد. استخدم 'إدارة الدورات' للبدء.",
            noResources: "في انتظار المعلم لرفع المواد الدراسية...",
            waiting: "في انتظار مراجعة المعلم...",
            logout: "تسجيل الخروج",
            manage: "إدارة الدورات",
            dark: "الوضع الداكن",
            light: "الوضع المضيء",
            uploadVibe: "سيقوم المعلمون برفع المصادر للدورات المسجلة هنا."
        }
    };

    /* --- 4. DYNAMIC ANNOUNCEMENT RENDERER --- */
    function renderAnnouncements(ann) {
        const box = document.getElementById('announcementBox');
        if (!box) return;

        const titleEl = document.getElementById('announcementTitle');
        const textEl = document.getElementById('announcementText');
        const dateEl = document.getElementById('announcementDate');
        const iconEl = document.getElementById('announcementIcon');
        const t = i18n[currentLang];

        // Hide box entirely if teacher hasn't provided input
        if (!ann || (!ann.message && typeof ann !== 'string')) {
            box.style.display = 'none';
            return;
        }

        box.style.display = 'block';

        if (typeof ann === 'string') {
            titleEl.innerText = t.announcement;
            textEl.innerText = ann;
        } else {
            titleEl.innerText = ann.priority === 'urgent' ? t.urgent : (ann.title || t.announcement);
            textEl.innerText = ann.message;
            if (dateEl) dateEl.innerText = ann.date || "";

            // Apply Box-Specific Urgent Styling
            if (ann.priority === 'urgent') {
                box.style.border = "2px solid #e11d48";
                box.style.background = "rgba(225, 29, 72, 0.05)";
                if (iconEl) {
                    iconEl.style.color = "#e11d48";
                    iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
                }
            } else {
                box.style.border = "1px solid var(--glass-border)";
                box.style.background = "var(--glass-bg)";
                if (iconEl) {
                    iconEl.style.color = "var(--primary-green)";
                    iconEl.innerHTML = '<i class="fa-solid fa-bullhorn"></i>';
                }
            }
        }
    }

    /* --- 5. MAIN CONTENT RENDERER --- */
    function renderDashboard(data) {
        const courseGrid = document.getElementById('courseGrid');
        const resourceGrid = document.getElementById('resourceGrid');
        const t = i18n[currentLang];
        
        // 1. Handle Announcement Box
        renderAnnouncements(data.announcement);

        // 2. Stats Calculation
        const totalCourses = data.courses.length;
        const totalProgress = data.courses.reduce((sum, c) => sum + (c.progress || 0), 0);
        const avgCalc = totalCourses > 0 ? Math.round(totalProgress / totalCourses) : 0;

        document.getElementById('countEnrolled').innerText = totalCourses;
        document.getElementById('avgProgress').innerText = `${avgCalc}%`;

        // 3. Render Course Sub-sections (Each in a Box)
        courseGrid.innerHTML = "";
        if (totalCourses > 0) {
            data.courses.forEach(course => {
                const card = document.createElement('div');
                card.className = 'glass-card course-item-box'; 
                card.style.padding = "20px";
                card.style.marginBottom = "15px";
                card.style.borderRadius = "15px";
                card.style.border = "1px solid var(--glass-border)";
                card.style.background = "var(--glass-bg)";

                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start;">
                        <div>
                            <h4 style="margin:0; color:var(--primary-green); font-size:1.1rem;">${course.name}</h4>
                            <span style="font-size:0.75rem; opacity:0.6;">${course.code || 'Pending Code'}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.9rem; font-weight:bold;">${course.progress || 0}%</span>
                        </div>
                    </div>
                    <div class="progress-container" style="background:rgba(0,0,0,0.1); height:6px; border-radius:3px; margin:12px 0; overflow:hidden;">
                        <div class="progress-bar" style="width: ${course.progress || 0}%; background:var(--primary-green); height:100%; transition:0.8s ease;"></div>
                    </div>
                    <div style="margin-top:10px; padding-top:10px; border-top:1px solid var(--glass-border); display:flex; gap:8px; font-size:0.85rem; font-style:italic; opacity:0.8;">
                        <i class="fa-solid fa-message" style="color:var(--primary-green); font-size:0.7rem; margin-top:4px;"></i>
                        <span>${course.teacherNote || t.waiting}</span>
                    </div>
                `;
                courseGrid.appendChild(card);
            });
        } else {
            courseGrid.innerHTML = `<div class="empty-state-box" style="text-align:center; padding:30px; opacity:0.5;"><i class="fa-solid fa-book-open" style="font-size:2rem; margin-bottom:10px;"></i><p>${t.noCourses}</p></div>`;
        }

        // 4. Render Resource Sub-sections (Each in a Box)
        resourceGrid.innerHTML = "";
        if (data.resources.length > 0) {
            data.resources.forEach(res => {
                const item = document.createElement('div');
                item.className = 'resource-item-box';
                item.style.display = "flex";
                item.style.alignItems = "center";
                item.style.gap = "15px";
                item.style.padding = "15px";
                item.style.background = "var(--glass-bg)";
                item.style.border = "1px solid var(--glass-border)";
                item.style.borderRadius = "12px";
                item.style.marginBottom = "10px";

                item.innerHTML = `
                    <div style="width:40px; height:40px; border-radius:8px; background:rgba(27,110,95,0.1); display:flex; align-items:center; justify-content:center; color:var(--primary-green);">
                        <i class="fa-solid fa-file-pdf"></i>
                    </div>
                    <div style="flex-grow:1;">
                        <div style="font-weight:600; font-size:0.9rem;">${res.title}</div>
                        <div style="font-size:0.7rem; opacity:0.6;">${res.courseName}</div>
                    </div>
                    <a href="${res.url}" download style="color:var(--primary-green);"><i class="fa-solid fa-circle-down" style="font-size:1.2rem;"></i></a>
                `;
                resourceGrid.appendChild(item);
            });
        } else {
            resourceGrid.innerHTML = `
                <div class="empty-state-box" style="width:100%; border: 2px dashed var(--glass-border); padding:30px; text-align:center; border-radius:15px; opacity:0.6;">
                    <i class="fa-solid fa-cloud-arrow-up" style="font-size: 1.8rem; color: var(--primary-green); margin-bottom:10px;"></i>
                    <p style="font-size:0.85rem;"><b>${t.resources}</b><br>${t.uploadVibe}</p>
                </div>`;
        }
    }

    /* --- 6. INTERFACE & EVENT CONTROLS --- */

    function applyLanguage(lang) {
        const t = i18n[lang];
        document.dir = lang === 'ar' ? 'rtl' : 'ltr';
        
        document.getElementById('userName').innerText = `${t.welcome}, ${studentData.name}`;
        document.getElementById('welcomeSub').innerText = t.sub;
        document.getElementById('labelEnrolled').innerText = t.enrolled;
        document.getElementById('labelAvg').innerText = t.avg;
        document.getElementById('labelCourses').innerText = t.courses;
        document.getElementById('labelResources').innerText = t.resources;
        document.getElementById('labelManage').innerText = t.manage;
        document.getElementById('labelLogout').innerText = t.logout;
        document.getElementById('langText').innerText = lang === 'en' ? 'العربية' : 'English';
        
        updateThemeUI();
        renderDashboard(studentData);
    }

    function updateThemeUI() {
        const theme = document.documentElement.getAttribute('data-theme');
        const icon = document.querySelector('#themeToggle i');
        const text = document.getElementById('themeText');
        const t = i18n[currentLang];

        if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
        if (text) text.innerText = theme === 'dark' ? t.light : t.dark;
    }

    // Hamburger Menu Logic
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    menuToggle.addEventListener('click', () => {
        menuToggle.classList.toggle('change');
        navMenu.classList.toggle('active');
    });

    document.getElementById('themeToggle').addEventListener('click', () => {
        const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeUI();
    });

    document.getElementById('langToggle').addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'ar' : 'en';
        localStorage.setItem('lang', currentLang);
        applyLanguage(currentLang);
    });

    document.getElementById('logoutBtn').addEventListener('click', () => {
        const theme = localStorage.getItem('theme');
        const lang = localStorage.getItem('lang');
        localStorage.clear();
        localStorage.setItem('theme', theme);
        localStorage.setItem('lang', lang);
        window.location.href = 'login.html';
    });

    /* --- 7. INITIAL EXECUTION --- */
    applyLanguage(currentLang);
});