/**
 * Global Custom Alert for Al-Ikroom Islamic Institute
 * Replaces browser default alert() with themed modal.
 */

(function() {
    // 1. Inject Styles into the Head
    const style = document.createElement('style');
    style.innerHTML = `
        .als-alert-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(8px);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
        }

        .als-alert-overlay.active {
            opacity: 1;
        }

        .als-alert-box {
            background: var(--card-bg, #ffffff);
            padding: 35px;
            border-radius: 35px;
            text-align: center;
            max-width: 420px;
            width: 90%;
            color: var(--text-color, #0a143c);
            border-top: 6px solid var(--primary-green, #1b6e5f);
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            font-family: 'Times New Roman', Times, serif;
            transform: scale(0.9);
            transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        .als-alert-overlay.active .als-alert-box {
            transform: scale(1);
        }

        .als-alert-icon {
            font-size: 3rem;
            color: var(--primary-green, #1b6e5f);
            margin-bottom: 15px;
            display: block;
        }

        .als-alert-title {
            font-size: 1.4rem;
            font-weight: 700;
            margin-bottom: 10px;
            color: var(--primary-green, #1b6e5f);
        }

        .als-alert-message {
            font-size: 1rem;
            line-height: 1.5;
            margin-bottom: 25px;
            opacity: 0.9;
        }

        .als-alert-btn {
            width: 100%;
            padding: 14px;
            background: var(--primary-green, #1b6e5f);
            color: #fff;
            border: none;
            border-radius: 50px;
            font-weight: 700;
            font-size: 1rem;
            cursor: pointer;
            transition: 0.3s;
            box-shadow: 0 8px 20px rgba(27, 110, 95, 0.2);
        }

        .als-alert-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 20px rgba(27, 110, 95, 0.4);
            filter: brightness(1.1);
        }
    `;
    document.head.appendChild(style);

    // 2. Override window.alert
    window.alert = function(message) {
        // Create elements
        const overlay = document.createElement('div');
        overlay.className = 'als-alert-overlay';
        
        const box = document.createElement('div');
        box.className = 'als-alert-box';

        // Set Icon based on message content (Optional logic)
        let icon = '<i class="fas fa-exclamation-circle als-alert-icon"></i>';
        if (message.toLowerCase().includes('success')) {
            icon = '<i class="fas fa-check-circle als-alert-icon"></i>';
        }

        box.innerHTML = `
            ${icon}
            <div class="als-alert-title">Notification</div>
            <div class="als-alert-message">${message}</div>
            <button class="als-alert-btn">Understood</button>
        `;

        overlay.appendChild(box);
        document.body.appendChild(overlay);

        // Trigger animations
        setTimeout(() => overlay.classList.add('active'), 10);

        // Close function
        const closeAlert = () => {
            overlay.classList.remove('active');
            setTimeout(() => {
                if (document.body.contains(overlay)) {
                    document.body.removeChild(overlay);
                }
            }, 300);
        };

        // Event Listeners
        box.querySelector('.als-alert-btn').onclick = closeAlert;
        
        // Close on Enter key
        const handleKeyDown = (e) => {
            if (e.key === 'Enter') {
                closeAlert();
                window.removeEventListener('keydown', handleKeyDown);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
    };
})();