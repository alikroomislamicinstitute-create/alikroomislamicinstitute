const API_URL = "https://alikroomislamicinstitute.onrender.com/api/teacher";

// 1. INITIALIZE DASHBOARD
// Runs as soon as the page loads to pull real data from your Node.js backend
document.addEventListener('DOMContentLoaded', () => {
    fetchStudentRoster();
});

// 2. FETCH STUDENTS
// This fills the "Manage Student Progress" section with real users from MongoDB
async function fetchStudentRoster() {
    try {
        // Fetching all users - Ensure your backend/admin route allows this
        const res = await fetch("https://alikroomislamicinstitute.onrender.com/api/admin/users"); 
        const data = await res.json();

        if (data.success) {
            const rosterContainer = document.querySelector('.glass-card:last-of-type');
            
            // Clear out the hardcoded "placeholder" students from the HTML
            const items = rosterContainer.querySelectorAll('.student-item');
            items.forEach(item => item.remove());

            // Filter for students only
            const students = data.users.filter(u => u.role === 'student');

            students.forEach(student => {
                // Use the first interest as the primary course
                const firstCourse = student.interests && student.interests.length > 0 
                    ? student.interests[0] 
                    : "General Studies";

                const div = document.createElement('div');
                div.className = 'student-item';
                div.innerHTML = `
                    <div>
                        <div style="font-weight: 800;">${student.firstName} ${student.lastName}</div>
                        <div style="font-size: 0.75rem; opacity: 0.6;">Course: ${firstCourse}</div>
                    </div>
                    <div style="display: flex; gap: 10px; align-items: center;">
                        <input type="number" id="prog-${student._id}" value="0" min="0" max="100" style="width: 60px; padding: 5px;" title="Progress %">
                        <button onclick="updateProgress('${student._id}', '${firstCourse}')" class="tool-btn" style="color: #1b6e5f;">
                            <i class="fa-solid fa-circle-check"></i>
                        </button>
                    </div>
                `;
                rosterContainer.appendChild(div);
            });
        }
    } catch (err) {
        console.error("❌ Error loading roster:", err);
    }
}

// 3. POST ANNOUNCEMENT
// Sends the headline and message to the /api/teacher/announcements route
async function postAnnouncement() {
    const titleInput = document.querySelector('input[placeholder="Important Update"]');
    const messageInput = document.querySelector('textarea');

    if (!titleInput.value || !messageInput.value) {
        return alert("Please fill in both the headline and message.");
    }

    try {
        const res = await fetch(`${API_URL}/announcements`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: titleInput.value, message: messageInput.value })
        });
        
        const data = await res.json();
        if (data.success) {
            alert("✅ Announcement sent to all students!");
            titleInput.value = "";
            messageInput.value = "";
        }
    } catch (err) {
        console.error("❌ Announcement Error:", err);
    }
}

// 4. UPDATE PROGRESS
// Sends a specific student's ID and new progress percentage to the backend
async function updateProgress(studentId, courseName) {
    const progressValue = document.getElementById(`prog-${studentId}`).value;

    try {
        const res = await fetch(`${API_URL}/update-progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                studentId, 
                courseName, 
                progressValue: parseInt(progressValue) 
            })
        });

        if (res.ok) {
            alert(`✅ Progress for ${courseName} updated to ${progressValue}%`);
        }
    } catch (err) {
        console.error("❌ Progress Update Error:", err);
    }
}

// 5. UPLOAD RESOURCE
// Handles file uploads (PDF/Docs) for specific courses
async function uploadResource() {
    const course = document.getElementById('resCourse').value;
    const titleInput = document.querySelector('input[placeholder="e.g. Week 4 Lecture Notes"]');
    const fileInput = document.querySelector('input[type="file"]');

    if (!fileInput.files[0]) return alert("Please select a file first.");

    const formData = new FormData();
    formData.append('course', course);
    formData.append('title', titleInput.value);
    formData.append('file', fileInput.files[0]);

    try {
        const res = await fetch(`${API_URL}/upload-resource`, {
            method: 'POST',
            body: formData 
            // Note: Do NOT set Content-Type header when using FormData; the browser does it automatically
        });

        if (res.ok) {
            alert("🚀 Resource shared successfully!");
            titleInput.value = "";
            fileInput.value = "";
        }
    } catch (err) {
        console.error("❌ Resource Upload Error:", err);
    }
}