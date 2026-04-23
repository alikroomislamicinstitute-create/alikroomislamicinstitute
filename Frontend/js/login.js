// Frontend/js/login.js

// 1. Define the base URL (Standardized to 127.0.0.1 for local testing)
const API_URL = "https://alikroomislamicinstitute.onrender.com/api/auth/login";

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear previous session
    localStorage.clear();

    // Grab values from HTML
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('loginRole').value; 
    const errorMessage = document.getElementById('errorMessage');

    // Basic validation
    if (!role) {
        errorMessage.textContent = "❌ Please select an Access Level.";
        errorMessage.style.display = 'block';
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, role })
        });

        const result = await response.json();
        console.log("Full Server Response:", result); // Check this in F12 Console

        if (result.success) {
            // STORAGE - Saving user data for the dashboard
            localStorage.setItem('userToken', result.token); 
            localStorage.setItem('userRole', result.user.role);
            localStorage.setItem('userName', result.user.firstName);
            localStorage.setItem('userID', result.user.id || result.user._id);
            
            alert(`Welcome back, ${result.user.firstName}!`);

            // --- REDIRECT LOGIC (FIXED FILENAMES) ---
            const userRole = result.user.role.toLowerCase();

            if (userRole === 'admin') {
                window.location.href = 'admin.html';
            } else if (userRole === 'teacher') {
                // Matches your file: dashboard-teacher.html
                window.location.href = 'dashboard-teacher.html'; 
            } else if (userRole === 'student') {
                // Matches your file: dashboard-student.html
                window.location.href = 'dashboard-student.html';
            } else {
                console.error("Unknown role detected:", userRole);
                errorMessage.textContent = "❌ Role not recognized by system.";
                errorMessage.style.display = 'block';
            }
        } else {
            // Display backend error message
            errorMessage.textContent = '❌ ' + (result.message || 'Invalid credentials');
            errorMessage.style.display = 'block';
        }
    } catch (err) {
        console.error('Login Connection Error:', err);
        alert(`Could not connect to the server at ${API_URL}. \n\nCheck if your Node.js terminal is running!`);
    }
});