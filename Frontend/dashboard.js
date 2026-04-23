document.addEventListener('DOMContentLoaded', () => {
    // 1. DATA & STATE
    const API_BASE = 'https://alikroomislamicinstitute.onrender.com/api';
    const socket = io();
    
    // Retrieve user data from localStorage
    const userData = JSON.parse(localStorage.getItem('user')) || {};
    let activeRecipient = null;
    let contacts = [];

    // 2. UI ELEMENTS
    const elements = {
        hamburger: document.getElementById('hamburgerBtn'),
        navMenu: document.getElementById('navMenu'),
        sidebar: document.getElementById('sidebarDrawer'),
        openSidebar: document.getElementById('mobileContactsBtn'),
        closeSidebar: document.getElementById('closeSidebar'),
        chatMain: document.getElementById('chatMain'),
        themeToggle: document.getElementById('themeToggle'),
        contactList: document.getElementById('contactList'),
        messageList: document.getElementById('messageList'),
        msgInput: document.getElementById('msgInput'),
        sendBtn: document.getElementById('sendBtn'),
        contactSearch: document.getElementById('contactSearch'),
        activeChatName: document.getElementById('activeChatName'),
        activeChatStatus: document.getElementById('activeChatStatus'),
        activeAvatar: document.getElementById('activeAvatar'),
        dashboardBtn: document.getElementById('dashboard'),
        sessionBtn: document.getElementById('btnLiveSession'),
        
        // Identity Elements
        myName: document.getElementById('myName'),
        myID: document.getElementById('myID'),
        myAvatar: document.getElementById('myAvatar')
    };

    // 3. INITIALIZATION & IDENTITY LOGIC
    if (!userData.ikhId) {
        console.warn("No Registration ID found, redirecting to login.");
        window.location.href = 'login.html';
        return;
    }

    // Display User Identity in Sidebar
    elements.myName.textContent = `${userData.firstName} ${userData.lastName || ''}`;
    elements.myID.textContent = userData.ikhId;
    elements.myAvatar.textContent = userData.firstName.charAt(0).toUpperCase();

    // Role-based Dashboard Redirection
    elements.dashboardBtn.onclick = (e) => {
        e.preventDefault();
        window.location.href = userData.role === 'teacher' ? 'dashboard-teacher.html' : 'dashboard-student.html';
    };
    
    if(userData.role === 'teacher') elements.sessionBtn.style.display = 'block';

    // Socket Registration
    socket.emit('register', userData.ikhId);

    // 4. CONTACTS LOADING LOGIC
    const loadContacts = async () => {
        try {
            const res = await fetch(`${API_BASE}/chat/contacts`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            if (data.success) {
                contacts = data.contacts;
                renderContacts(contacts);
            }
        } catch (err) { console.error("Contact Load Error:", err); }
    };

    const renderContacts = (list) => {
        elements.contactList.innerHTML = list.map(c => `
            <div class="contact-item" data-id="${c.ikhId}" data-name="${c.name}">
                <div class="avatar">${c.name.charAt(0)}</div>
                <div>
                    <p style="margin:0; font-weight:700; font-size:0.9rem;">${c.name}</p>
                    <p style="margin:0; font-size:0.7rem; opacity:0.6;">${c.role.toUpperCase()} • ${c.ikhId}</p>
                </div>
            </div>
        `).join('');

        document.querySelectorAll('.contact-item').forEach(item => {
            item.onclick = () => selectContact(item.dataset.id, item.dataset.name);
        });
    };

    // 5. CHAT FUNCTIONS
    const selectContact = async (id, name) => {
        activeRecipient = id;
        elements.activeChatName.textContent = name;
        elements.activeChatStatus.textContent = "Loading history...";
        elements.activeAvatar.innerHTML = name.charAt(0);
        
        document.querySelectorAll('.contact-item').forEach(i => i.classList.remove('active'));
        const activeItem = document.querySelector(`[data-id="${id}"]`);
        if(activeItem) activeItem.classList.add('active');

        if (window.innerWidth <= 768) elements.sidebar.classList.remove('active');
        await loadMessages(id);
    };

    const loadMessages = async (recipientId) => {
        try {
            const res = await fetch(`${API_BASE}/messages/${recipientId}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
            });
            const data = await res.json();
            elements.messageList.innerHTML = '';
            if (data.success) {
                data.messages.forEach(msg => appendMessage(msg));
                elements.activeChatStatus.textContent = "Encrypted Connection";
            }
        } catch (err) { console.error("Msg Load Error:", err); }
    };

    const appendMessage = (msg) => {
        const isMe = msg.sender === userData.ikhId;
        const time = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const div = document.createElement('div');
        div.className = `message ${isMe ? 'msg-sent' : 'msg-received'}`;
        div.innerHTML = `${msg.content} <span class="msg-time">${time}</span>`;
        elements.messageList.appendChild(div);
        elements.messageList.scrollTop = elements.messageList.scrollHeight;
        
        const placeholder = document.getElementById('portalPlaceholder');
        if(placeholder) placeholder.remove();
    };

    const sendMessage = () => {
        const content = elements.msgInput.value.trim();
        if (!content || !activeRecipient) return;

        const msgData = {
            sender: userData.ikhId,
            recipient: activeRecipient,
            content: content,
            createdAt: new Date()
        };

        socket.emit('private-message', msgData);
        appendMessage(msgData);
        elements.msgInput.value = '';
    };

    // 6. UI EVENT LISTENERS
    elements.sendBtn.onclick = sendMessage;
    elements.msgInput.onkeypress = (e) => { if(e.key === 'Enter') sendMessage(); };

    socket.on('receive-message', (msg) => {
        if (msg.sender === activeRecipient) appendMessage(msg);
    });

    elements.contactSearch.oninput = (e) => {
        const term = e.target.value.toLowerCase();
        const filtered = contacts.filter(c => 
            c.name.toLowerCase().includes(term) || 
            c.ikhId.toLowerCase().includes(term)
        );
        renderContacts(filtered);
    };

    // Sidebar & Navigation Toggles
    elements.hamburger.onclick = (e) => {
        e.stopPropagation();
        elements.navMenu.classList.toggle('active');
        const icon = elements.hamburger.querySelector('i');
        icon.classList.toggle('fa-bars');
        icon.classList.toggle('fa-xmark');
    };

    elements.openSidebar.onclick = (e) => {
        e.stopPropagation();
        elements.sidebar.classList.add('active');
    };

    elements.closeSidebar.onclick = () => elements.sidebar.classList.remove('active');

    // Theme Logic
    const applyTheme = (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        const icon = elements.themeToggle.querySelector('i');
        icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    };

    elements.themeToggle.onclick = () => {
        const current = document.documentElement.getAttribute('data-theme');
        applyTheme(current === 'dark' ? 'light' : 'dark');
    };

    // Global Click Listener for mobile UX
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            if (!elements.sidebar.contains(e.target) && !elements.openSidebar.contains(e.target)) {
                elements.sidebar.classList.remove('active');
            }
            if (!elements.navMenu.contains(e.target) && !elements.hamburger.contains(e.target)) {
                elements.navMenu.classList.remove('active');
                const icon = elements.hamburger.querySelector('i');
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-xmark');
            }
        }
    });

    // Run Initial Load
    applyTheme(localStorage.getItem('theme') || 'light');
    loadContacts();
});