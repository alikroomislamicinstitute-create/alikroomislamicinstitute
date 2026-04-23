document.getElementById('registrationForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Capture the selected checkbox text values
    const selectedCourseNames = Array.from(document.querySelectorAll('.course-item input:checked'))
        .map(el => el.parentElement.querySelector('.c-name').textContent.trim());

    // 2. Capture the main form data
    const role = document.getElementById('userRole').value;
    
    const formData = {
        firstName: document.getElementById('regFirstName').value,
        middleName: document.getElementById('regMiddleName').value,
        lastName: document.getElementById('regLastName').value,
        email: document.getElementById('regEmail').value,
        password: document.getElementById('password').value,
        gender: document.getElementById('regGender').value,
        nationality: document.getElementById('regNationality').value,
        voucherKey: document.getElementById('regVoucher').value,
        role: role
    };

    // --- NEW LOGIC: Map strings to the structured Sub-Schemas ---
    if (role === 'teacher') {
        // Map to ManagedCourseSchema (name, code, description)
        formData.managedCourses = selectedCourseNames.map(name => ({
            name: name,
            code: "N/A",
            description: "Program assigned to your profile."
        }));
    } else if (role === 'student') {
        // Map to StudentCourseSchema (courseName, progress)
        formData.enrolledCourses = selectedCourseNames.map(name => ({
            courseName: name,
            progress: 0
        }));
    }

    // 3. Simple validation check
    if (!formData.role || !formData.gender) {
        alert("Please select your Role and Gender using the icons above.");
        return;
    }

    try {
        // 4. Send to your local Node.js server
        const response = await fetch('https://alikroomislamicinstitute.onrender.com/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        // --- NEW UPDATED RESULT HANDLING ---
        const result = await response.json();

        if (result.success) {
            // Show the success message and the new IKH ID
            const myID = result.data ? result.data.ikhId : "Generated Successfully";
            alert(`🎉 Success! Your ID is: ${myID}`);
            
            // Wait 2 seconds so they can read the success message
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            // Check multiple places for the error message
            const errorMsg = result.message || result.error || "An unknown error occurred";
            alert('❌ ' + errorMsg);
        }

    } catch (err) {
        console.error('Connection Error:', err);
        alert('Could not connect to the Al-ikroom server. Is your backend running?');
    }
});