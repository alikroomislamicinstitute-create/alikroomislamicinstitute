/**
 * Teacher Dashboard Core Logic
 * Handles: Theme, Mobile Menu, Data Fetching, Roster Management, and UI States
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. INITIALIZATION ---
    initTheme();
    fetchDashboardData();
    setupEventListeners();
});

// --- 2. THEME ENGINE ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    
    const themeIcon = document.getElementById('themeIcon');
    const themeText = document.getElementById('themeText');
    
    if (theme === 'dark') {
        themeIcon.className = 'fa-solid fa-sun';
        themeText.innerText = 'Light Mode';
    } else {
        themeIcon.className = 'fa-solid fa-moon';
        themeText.innerText = 'Dark Mode';
    }
}

// --- 3. UI INTERACTIVITY (Mobile Menu & Tabs) ---
function setupEventListeners() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    const themeToggle = document.getElementById('themeToggle');
    const logoutBtn = document.getElementById('logoutBtn');

    // Hamburger Menu Toggle
    menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menuToggle.classList.toggle('change');
        navMenu.classList.toggle('active');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
            navMenu.classList.remove('active');
            menuToggle.classList.remove('change');
        }
    });

    // Theme Toggle
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });

    // Logout Logic
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = 'login.html';
    });
}

// --- 4. DATA FETCHING & RENDERING ---
let allStudents = []; // Global store for local searching/filtering

async function fetchDashboardData() {
    const token = localStorage.getItem('token');
    if (!token) { window.location.href = 'login.html'; return; }

    try {
        const response = await fetch('/api/teacher/dashboard-data', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();

        if (data.success) {
            renderDashboard(data);
        }
    } catch (err) {
        console.error("Dashboard Load Error:", err);
    }
}

function renderDashboard(data) {
    // Set Teacher Name
    document.getElementById('teacherName').innerText = data.teacherName || 'Ustadh';

    // Render Managed Programs (Cards)
    const coursesGrid = document.getElementById('teacherCoursesDisplay');
    const resSelect = document.getElementById('resCourse');
    const rosterFilter = document.getElementById('rosterFilter');

    coursesGrid.innerHTML = '';
    resSelect.innerHTML = '<option value="">Select Course...</option>';
    rosterFilter.innerHTML = '<option value="all">All Programs</option>';

    data.managedCourses.forEach(course => {
        // Dashboard Cards
        coursesGrid.innerHTML += `
            <div class="course-card-mini">
                <span class="course-badge">${course.code || 'PROG'}</span>
                <h4>${course.name}</h4>
            </div>
        `;
        // Dropdown options
        const opt = `<option value="${course.name}">${course.name}</option>`;
        resSelect.innerHTML += opt;
        rosterFilter.innerHTML += opt;
    });

    // Store students for filtering and render table
    allStudents = data.students || [];
    renderStudentsLocally();
    
    // Update Stats
    document.getElementById('totalStudentCount').innerText = [...new Set(allStudents.map(s => s.email))].length;
}

// --- 5. SEARCH & FILTER LOGIC (High Performance) ---
function renderStudentsLocally() {
    const searchTerm = document.getElementById('studentSearch').value.toLowerCase();
    const filterCourse = document.getElementById('rosterFilter').value;
    const tbody = document.getElementById('studentList');
    
    tbody.innerHTML = '';

    const filtered = allStudents.filter(s => {
        const matchesSearch = s.name.toLowerCase().includes(searchTerm) || s.email.toLowerCase().includes(searchTerm);
        const matchesFilter = filterCourse === 'all' || s.courseName === filterCourse;
        return matchesSearch && matchesFilter;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; opacity:0.5; padding:40px;">No students found matching your criteria.</td></tr>`;
        return;
    }

    filtered.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td>
                    <div style="font-weight:700;">${s.name}</div>
                    <div style="font-size:0.75rem; opacity:0.6;">${s.email}</div>
                </td>
                <td><span class="course-badge" style="background:rgba(27,110,95,0.1); color:var(--primary-green);">${s.courseName}</span></td>
                <td>
                    <input type="number" class="progress-input" value="${s.progress}" 
                        onchange="updateProgress('${s.id}', '${s.courseName}', this.value)"> %
                </td>
                <td style="text-align: right;">
                    <button class="delete-btn" onclick="removeStudent('${s.id}', '${s.courseName}')" title="Drop Student">
                        <i class="fa-solid fa-user-minus"></i>
                    </button>
                </td>
            </tr>
        `;
    });
}

// --- 6. RESOURCE UPLOAD HANDLER ---
async function uploadResource() {
    const btn = document.getElementById('btnUpload');
    const formData = new FormData();
    formData.append('course', document.getElementById('resCourse').value);
    formData.append('title', document.getElementById('resTitle').value);
    formData.append('file', document.getElementById('resFile').files[0]);

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading...';

    try {
        const res = await fetch('/api/teacher/upload-resource', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
            body: formData
        });
        const result = await res.json();
        if (result.success) {
            alert("Resource uploaded successfully!");
            location.reload(); 
        }
    } catch (err) {
        alert("Upload failed.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Upload Material';
    }
}

// --- 7. ASSESSMENT HELPERS ---
function switchTab(type) {
    const asnSec = document.getElementById('assignment-section');
    const quizSec = document.getElementById('quiz-section');
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(t => t.classList.remove('active'));
    
    if (type === 'assignment') {
        asnSec.classList.remove('hidden');
        quizSec.classList.add('hidden');
        event.target.classList.add('active');
    } else {
        asnSec.classList.add('hidden');
        quizSec.classList.remove('hidden');
        event.target.classList.add('active');
    }
}