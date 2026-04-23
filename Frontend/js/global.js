// global.js
(function() {
    // Immediate Theme Apply: Prevents "white flash" on dark mode during page load
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initNavigation();
    setupAccessibility();
});

/**
 * 1. HIGH-AUTHORITY THEME MANAGEMENT
 * Forces theme changes, updates icons globally, and overrides any conflicting page-specific scripts.
 */
function initTheme() {
    // Select ALL possible toggle buttons (IDs, classes, and old onclick attributes)
    const themeBtns = document.querySelectorAll('#themeToggle, .theme-switcher, [onclick*="theme"]');
    
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        
        // Update Icons globally across the site (supports FontAwesome)
        const allIcons = document.querySelectorAll('#themeToggle i, .theme-switcher i');
        allIcons.forEach(icon => {
            if (theme === 'dark') {
                icon.classList.replace('fa-moon', 'fa-sun');
            } else {
                icon.classList.replace('fa-sun', 'fa-moon');
            }
        });

        // Dispatch events so other elements (like Charts or Dashboards) can react
        window.dispatchEvent(new CustomEvent('themeChanged', { detail: { theme } }));
    };

    themeBtns.forEach(btn => {
        // Remove old inline onclick attributes to prevent functions like toggleTheme() from crashing
        btn.removeAttribute('onclick'); 
        
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(newTheme);
        });
    });

    // Initial sync to ensure icons match the saved preference on load
    const savedTheme = localStorage.getItem('theme') || 'light';
    applyTheme(savedTheme);
}

/**
 * 2. NAVIGATION & CLICK-OUTSIDE LOGIC
 * Handles the "Burger" menu and ensures it closes when clicking outside or on links.
 */
function initNavigation() {
    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');

    if (menuToggle && navMenu) {
        // Toggle menu click
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevents the window-click listener from firing immediately
            menuToggle.classList.toggle('change');
            navMenu.classList.toggle('active');
        });

        // Close menu when clicking anywhere outside the navigation area
        window.addEventListener('click', (e) => {
            if (navMenu.classList.contains('active')) {
                // If the click is NOT inside the menu and NOT on the toggle button, close it
                if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                    menuToggle.classList.remove('change');
                    navMenu.classList.remove('active');
                }
            }
        });

        // Close menu when a link inside is clicked (for single-page navigation)
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('change');
                navMenu.classList.remove('active');
            });
        });
    }
}

/**
 * 3. UI UNIFORMITY & ACCESSIBILITY
 * Handles smooth entrances, RTL support, and mobile height fixes.
 */
function setupAccessibility() {
    // Language Persistence: Ensures RTL is applied if Arabic was previously selected
    const savedLang = localStorage.getItem('lang') || 'en';
    if (savedLang === 'ar') {
        document.body.dir = 'rtl';
    }

    // Smooth Page Entrance: Uniform fade-in for all pages
    document.body.style.opacity = '0';
    document.body.style.transition = 'opacity 0.4s ease-in-out';
    requestAnimationFrame(() => {
        document.body.style.opacity = '1';
    });

    // Mobile Viewport Height Fix: Prevents "jumping" UI on mobile browsers caused by address bars
    const setVh = () => {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    };
    window.addEventListener('resize', setVh);
    setVh();
}