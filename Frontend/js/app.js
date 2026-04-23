// Function to show the themed popup on any page
window.showPopup = function(title, message) {
    // Check if the modal exists on the page, if not, create it dynamically
    let modal = document.getElementById('globalModal');
    if (!modal) {
        const modalHTML = `
            <div class="modal-overlay" id="globalModal">
                <div class="modal-content" style="background: var(--modal-bg); padding: 30px; border-radius: 25px; text-align: center; color: var(--text-color);">
                    <h3 id="globalPopupTitle" style="color:var(--primary-green);"></h3>
                    <p id="globalPopupText"></p>
                    <button type="button" class="btn" onclick="closeGlobalModal()" style="width:100%; padding:15px; background:var(--primary-green); color:#fff; border:none; border-radius:50px; cursor:pointer;">OK</button>
                </div>
            </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('globalModal');
    }
    
    document.getElementById('globalPopupTitle').innerText = title;
    document.getElementById('globalPopupText').innerText = message;
    modal.classList.add('active');
};

window.closeGlobalModal = function() {
    document.getElementById('globalModal').classList.remove('active');
};

// Global Menu Toggle
window.toggleMenu = function() {
    document.getElementById('nav-links').classList.toggle('active');
    document.getElementById('mobile-menu').classList.toggle('open');
};

// Global Theme Logic (Automatically runs on every page)
const initTheme = () => {
    const html = document.documentElement;
    const savedTheme = localStorage.getItem('theme') || 'light';
    html.setAttribute('data-theme', savedTheme);
};
initTheme();
