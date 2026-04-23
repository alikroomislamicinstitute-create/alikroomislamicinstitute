/**
 * ADMIN DASHBOARD CORE LOGIC
 * Handles: Stats, Voucher Generation, User Management, Navigation
 * Backend: https://alikroomislamicinstitute.onrender.com/api/admin
 */

const API_BASE = 'https://alikroomislamicinstitute.onrender.com/api/admin';

// Helper to get headers (reduces repetition and errors)
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// --- 1. INITIALIZATION ---
// This runs as soon as the page is ready
window.onload = () => {
    console.log("🛡️ Al-Ikroom Admin Dashboard Initializing...");
    refreshDashboard();
    initMobileNav(); // Initialize the click-outside-to-close logic
};

async function refreshDashboard() {
    await fetchStats();    // Updates the 3 counter cards
    await fetchVouchers(); // Loads the keys table
    await fetchUsers();    // Loads the community users list
}

// --- 2. FETCH DASHBOARD STATS ---
async function fetchStats() {
    try {
        const res = await fetch(`${API_BASE}/admin/stats`, { headers: getAuthHeaders() });
        const data = await res.json();

        if (data.success && data.stats) {
            // Using || 0 ensures that if the value is missing, it shows 0 instead of crashing
            document.getElementById('totalStudents').innerText = data.stats.totalStudents || 0;
            document.getElementById('totalTeachers').innerText = data.stats.totalTeachers || 0;
            document.getElementById('totalCourses').innerText = data.stats.totalCourses || 0;
        } else {
            console.error("Stats data format incorrect", data);
        }
    } catch (err) {
        console.error("Stats Error:", err);
    }
}
// --- 3. VOUCHER / KEY GENERATION ---
async function handleGenerateKey() {
    // Grabs value from your custom select span (student or teacher)
    const roleElement = document.getElementById('txtGenRole');
    const selectedRole = roleElement.getAttribute('data-value').toLowerCase(); 

    try {
        const response = await fetch(`${API_BASE}/generate-voucher`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ role: selectedRole })
        });

        const data = await response.json();

        if (data.success) {
            // Update the text inside the success modal
            document.getElementById('generatedKey').textContent = data.key;
            
            // Open the modal (Ensure openModal is defined in your admin.html)
            if (typeof openModal === "function") {
                openModal('keyModal');
            } else {
                alert("Key Generated: " + data.key);
            }

            fetchVouchers(); // Refresh the table
        } else {
            alert("❌ Voucher Error: " + data.message);
        }
    } catch (err) {
        console.error("Voucher generation failed:", err);
        alert("Server connection failed. Check your backend terminal.");
    }
}

// --- 4. FETCH RECENT VOUCHERS ---
async function fetchVouchers() {
    try {
        const response = await fetch(`${API_BASE}/vouchers`);
        const data = await response.json();
        const tbody = document.getElementById('voucherTableBody');
        if (!tbody) return;
        
        tbody.innerHTML = '';

        if (data.success && data.vouchers) {
            data.vouchers.forEach(v => {
                const status = v.isUsed 
                    ? '<span style="color:#e74c3c">Used</span>' 
                    : '<span style="color:#27ae60">Active</span>';
                
                tbody.innerHTML += `
                    <tr>
                        <td style="font-family: monospace; font-weight: bold; color: #1b6e5f">${v.key}</td>
                        <td>${v.role.toUpperCase()}</td>
                        <td>${status}</td>
                        <td>${new Date(v.createdAt).toLocaleTimeString()}</td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error("Voucher Table Error:", err);
    }
}

// --- 6. DELETE USER ---
async function deleteUser(id) {
    if (!confirm("⚠️ Are you sure? This will permanently remove the user from Al-Ikroom.")) return;

    try {
        const response = await fetch(`${API_BASE}/users/${id}`, { method: 'DELETE' });
        const data = await response.json();
        
        if (data.success) {
            refreshDashboard(); // Reload everything
        } else {
            alert("Delete failed: " + data.message);
        }
    } catch (err) {
        console.error("Delete failed:", err);
    }
}

async function addCourse() {
    const courseTitle = document.getElementById('courseTitle');
    const coursePrice = document.getElementById('coursePrice');

    if (!courseTitle || !coursePrice) {
        alert("Form fields not found!");
        return;
    }

    const courseData = {
        title: courseTitle.value,
        arTitle: document.getElementById('courseTitleAr')?.value || '',
        description: document.getElementById('courseDesc')?.value || '',
        arDesc: document.getElementById('courseDescAr')?.value || '',
        price: coursePrice.value,
        arPrice: document.getElementById('coursePriceAr')?.value || '',
        teacherName: document.getElementById('courseTeacher')?.value || ''
    };

    if (!courseData.title || !courseData.price) {
        alert("Title and Price are required.");
        return;
    }

    try {
        const token = localStorage.getItem('token');
        if (!token) return alert("Session expired. Please log in again.");

        const res = await fetch(`${API_BASE}/courses`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(courseData)
        });
        const data = await res.json();
        if (data.success) {
            alert("Course Created / تم إنشاء الدورة!");
            
            if (typeof fetchCourses === 'function') {
                fetchCourses();
            } else {
                refreshDashboard();
            }

            const inputs = ['courseTitle', 'courseTitleAr', 'courseTeacher', 'coursePrice', 'courseDesc', 'courseDescAr'];
            inputs.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
        } else {
            alert("Error: " + data.message);
        }
    } catch (err) { 
        console.error("Add Course Error:", err);
        alert("Server connection failed."); 
    }
}

async function deleteCourse(courseId) {
    if (!confirm("Are you sure you want to delete this course?")) return;

    try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_BASE}/courses/${courseId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();
        if (data.success) {
            alert("Course deleted successfully!");
            if (typeof fetchCourses === 'function') {
                fetchCourses(); 
            } else {
                refreshDashboard();
            }
        } else {
            alert("Failed to delete: " + data.message);
        }
    } catch (err) {
        console.error("Delete Course Error:", err);
        alert("Server error during deletion.");
    }
}

// --- 7. MOBILE NAVIGATION & COMPATIBILITY ---
/**
 * Automatically closes the navigation bar when any part of the screen 
 * outside the sidebar is touched/clicked.
 */
function initMobileNav() {
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.getElementById('menuBtn'); // Ensure your toggle button has this ID

    document.addEventListener('click', (event) => {
        const isClickInsideSidebar = sidebar && sidebar.contains(event.target);
        const isClickOnMenuBtn = menuBtn && menuBtn.contains(event.target);

        // If the sidebar is active (visible on mobile) and user clicks outside
        if (sidebar && sidebar.classList.contains('active') && !isClickInsideSidebar && !isClickOnMenuBtn) {
            sidebar.classList.remove('active');
            if (menuBtn) menuBtn.classList.remove('change');
            console.log("📱 Mobile Nav auto-closed.");
        }
    });
}

/**
 * Toggle Sidebar for Mobile Mode
 * This function should be linked to your hamburger icon/button
 */
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    const menuBtn = document.getElementById('menuBtn');
    if (sidebar) {
        sidebar.classList.toggle('active');
    }
    if (menuBtn) {
        menuBtn.classList.toggle('change');
    }
}