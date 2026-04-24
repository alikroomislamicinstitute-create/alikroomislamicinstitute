/**
 * Al-Ikroom Call Handler - WhatsApp Style Pro
 * Dynamic Theme Support (Dark/Light) based on messages.html
 * Optimized for Mobile & Desktop Responsiveness
 */

const CallUI = {
    state: 'idle', 
    callType: 'video', 
    isInitiator: false,
    currentChannel: null,
    remoteUser: null,
    client: null, 
    localTracks: {
        videoTrack: null,
        audioTrack: null
    },
    isScreenSharing: false, // Add this
    screenTrack: null,
    timerInterval: null,
    secondsElapsed: 0,
        sounds: {
        // Professional Digital Pulse for Incoming
        ringtone: new Audio('https://assets.mixkit.co/active_storage/sfx/2569/2569-preview.mp3'), 
        
        // Clean Tech Blip for Outgoing
        dialtone: new Audio('https://assets.mixkit.co/active_storage/sfx/2513/2513-preview.mp3'), 
        
        // Short System Alert for Reconnecting
        reconnect: new Audio('https://assets.mixkit.co/active_storage/sfx/2561/2561-preview.mp3') 
    },

    
    
    init() {
        this.sounds.ringtone.loop = true;
        this.sounds.dialtone.loop = true;
        this.injectStyles();
        this.makeDraggable(document.getElementById('local-video'));
        this.listenForBackbutton();
        this.setupSocketListeners();
        this.syncTheme();
        this.setupProximitySensor();
        const ssBtn = document.getElementById('screenShareToggle');
        if(ssBtn) ssBtn.onclick = () => this.toggleScreenShare();
        // Check for active session after reload
        this.checkPersistentCall();
    },

    checkPersistentCall() {
        const savedChannel = sessionStorage.getItem('activeCallChannel');
        if (savedChannel) {
            this.currentChannel = savedChannel;
            this.remoteUser = sessionStorage.getItem('activeCallRemoteUser');
            this.callType = sessionStorage.getItem('activeCallType');
            this.state = 'active'; 
            
            // Restore UI
            document.getElementById('activeCallerName').innerText = sessionStorage.getItem('activeCallRemoteName') || "User";
            this.expandCall();
            
            // Re-join the stream
            this.startAgoraStream(this.currentChannel);
        }
    },

    setupProximitySensor() {
        if ('ProximitySensor' in window && this.callType === 'voice') {
            const sensor = new ProximitySensor();
            sensor.addEventListener('reading', () => {
                if (sensor.near) {
                    document.body.style.filter = 'brightness(0)'; // Dim screen
                } else {
                    document.body.style.filter = 'none';
                }
            });
            sensor.start();
        }
    },

    

    makeDraggable(el) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        el.onmousedown = dragMouseDown;
        el.ontouchstart = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;
            pos3 = clientX;
            pos4 = clientY;
            document.onmouseup = closeDragElement;
            document.ontouchend = closeDragElement;
            document.onmousemove = elementDrag;
            document.ontouchmove = elementDrag;
        }

        function elementDrag(e) {
            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;
            pos1 = pos3 - clientX;
            pos2 = pos4 - clientY;
            pos3 = clientX;
            pos4 = clientY;
            
            // Boundaries check to keep inside screen
            let newTop = el.offsetTop - pos2;
            let newLeft = el.offsetLeft - pos1;
            
            el.style.top = Math.max(0, Math.min(newTop, window.innerHeight - el.offsetHeight)) + "px";
            el.style.left = Math.max(0, Math.min(newLeft, window.innerWidth - el.offsetWidth)) + "px";
            el.style.right = 'auto'; 
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            document.ontouchend = null;
            document.ontouchmove = null;
        }
    },

    syncTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const overlay = document.getElementById('callOverlay');
        if(overlay) overlay.setAttribute('data-theme', currentTheme);
    },

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            :root {
                --whatsapp-green: #075e54;
                --whatsapp-dark-bg: #0b141a;
                --whatsapp-light-bg: #f0f2f5;
                --whatsapp-toast-dark: #233138;
                --whatsapp-toast-light: #ffffff;
                --control-bg: rgba(0, 0, 0, 0.6);
                
            }

        
            .btn-call.active-feature { 
            background: #25d366 !important; 
    color: white !important; 
    box-shadow: 0 0 15px rgba(37, 211, 102, 0.5);
}
    #switchToVideoBtn {
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.4);
}

.btn-mute.switch-btn {
    background: #25d366; /* WhatsApp Green */
    border: 2px solid white;
}

            .call-overlay {
                position: fixed; top: 0; left: 0; width: 100vw; height: 100dvh;
                background-color: var(--whatsapp-green);
                background-image: url("https://www.transparenttextures.com/patterns/cubes.png");
                z-index: 9999; display: none;
                flex-direction: column; align-items: center; justify-content: space-between;
                color: white; font-family: 'Plus Jakarta Sans', sans-serif;
                transition: all 0.3s ease; overflow: hidden;
            }

            [data-theme="dark"] .call-overlay { background-color: var(--whatsapp-dark-bg); }

            .call-overlay::before {
                content: ""; position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                opacity: 0.07; pointer-events: none;
                background-image: url('https://www.svgrepo.com/show/395874/book-education.svg'), 
                                  url('https://www.svgrepo.com/show/398048/pencil.svg'),
                                  url('https://www.svgrepo.com/show/397144/ink-pen.svg');
                background-size: 80px; background-repeat: space;
            }

            .call-overlay.active { display: flex; }

            .reconnect-overlay {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.7); z-index: 20;
                display: none; flex-direction: column; align-items: center; justify-content: center;
                backdrop-filter: blur(5px);
            }
            .reconnect-overlay.visible { display: flex; }
            .spinner { 
                width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); 
                border-top-color: white; border-radius: 50%; animation: spin 1s linear infinite; 
                margin-bottom: 15px;
            }
            @keyframes spin { to { transform: rotate(360deg); } }
            
            #remote-video { position: absolute; width: 100%; height: 100%; object-fit: cover; background: #000; z-index: 1; }
            #local-video { 
                position: absolute; top: 20px; right: 20px; width: 120px; height: 160px; 
                border-radius: 12px; border: 2px solid rgba(255,255,255,0.3); z-index: 10; 
                background: #222; overflow: hidden; box-shadow: 0 8px 25px rgba(0,0,0,0.5);
                cursor: grab; touch-action: none; display: none;
            }
            #local-video:active { cursor: grabbing; }

            .dynamic-bg {
                position: absolute; top: 0; left: 0; width: 100%; height: 100%;
                background-size: cover; background-position: center;
                filter: blur(40px) brightness(0.4); transform: scale(1.1);
                z-index: 0; transition: opacity 1s ease;
            }

            .call-header {
                position: relative; z-index: 11; margin-top: 6vh; text-align: center;
                text-shadow: 0 2px 10px rgba(0,0,0,0.5); width: 90%;
            }
            .call-header h2 { margin: 0; font-size: clamp(1.5rem, 5vw, 2.2rem); font-weight: 700; }
            #callDurationText { font-size: 1.1rem; opacity: 0.9; margin-top: 5px; font-family: monospace; }

            .call-controls { 
                position: relative; bottom: 40px; display: flex; gap: 15px; z-index: 11; 
                background: var(--control-bg); padding: 15px 25px; border-radius: 40px;
                backdrop-filter: blur(15px); border: 1px solid rgba(255,255,255,0.1);
                flex-wrap: wrap; justify-content: center; max-width: 90%;
            }
            .btn-call { 
                width: 50px; height: 50px; border-radius: 50%; border: none; 
                display: flex; align-items: center; justify-content: center; font-size: 18px; cursor: pointer;
                transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            }
            .btn-call:active { transform: scale(0.9); }
            .btn-end { background: #ea4335; color: white; width: 60px; height: 60px; font-size: 24px; }
            .btn-mute { background: rgba(255,255,255,0.15); color: white; }
            .btn-mute.off { background: white; color: #1e293b; }
            .btn-call.active-feature { background: #25d366; color: white; }

            .minimized-bar {
                position: fixed; top: 0; left: 0; width: 100%; height: 60px;
                background: #1b6e5f; color: white; display: none;
                align-items: center; padding: 0 15px; z-index: 9998;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2); cursor: pointer;
            }
            [data-theme="dark"] .minimized-bar { background: #202c33; border-bottom: 1px solid #374045; }
            .minimized-bar.active { display: flex; }

            .incoming-toast {
                position: fixed; top: 15px; left: 50%; transform: translateX(-50%);
                width: 95%; max-width: 450px; background: var(--whatsapp-toast-light); 
                border-radius: 12px; padding: 12px 16px; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                display: none; align-items: center; justify-content: space-between; z-index: 10000;
            }
            [data-theme="dark"] .incoming-toast { background: var(--whatsapp-toast-dark); color: white; border: 1px solid #374045; }
            .incoming-toast.active { display: flex; animation: slideDown 0.4s ease-out; }

            @media (min-width: 1024px) {
                #local-video { width: 200px; height: 280px; top: 40px; right: 40px; }
                .call-controls { gap: 25px; bottom: 60px; padding: 20px 40px; }
                .btn-call { width: 60px; height: 60px; font-size: 22px; }
                .btn-end { width: 70px; height: 70px; }
            }

            
            @media (max-width: 480px) {
                .call-controls { padding: 10px 15px; bottom: 30px; gap: 10px; }
                .btn-call { width: 45px; height: 45px; font-size: 16px; }
                .btn-end { width: 55px; height: 55px; }
                #local-video { width: 100px; height: 140px; top: 15px; right: 15px; }
                z-index: 30;
            }

            @keyframes slideDown {
                from { transform: translate(-50%, -120%); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
        this.renderStructure();
    },

    renderStructure() {
        const container = document.createElement('div');
        container.innerHTML = `
            <div id="incomingToast" class="incoming-toast">
                <div style="display:flex; align-items:center; gap:12px">
                    <div id="callerAvatar" style="width:45px; height:45px; border-radius:50%; background:#128c7e; display:flex; align-items:center; justify-content:center; color:white; font-size:20px; border:1px solid rgba(255,255,255,0.1)">
                        <i class="fas fa-user"></i>
                    </div>
                    <div style="max-width:180px">
                        <strong id="callerName" style="display:block; font-size:16px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis">...</strong>
                        <div style="font-size:12px; opacity:0.8">Incoming <span id="callTypeText">video</span> call...</div>
                    </div>
                </div>
                <div style="display:flex; gap:10px">
                    <button onclick="CallUI.declineCall()" style="background:#ff4b4b; color:white; border:none; width:42px; height:42px; border-radius:50%; cursor:pointer; font-size:18px"><i class="fas fa-times"></i></button>
                    <button onclick="CallUI.acceptCall()" style="background:#25d366; color:white; border:none; width:42px; height:42px; border-radius:50%; cursor:pointer; font-size:18px"><i class="fas fa-phone"></i></button>
                </div>
            </div>

            <div id="callOverlay" class="call-overlay">
                <div id="dynamicBg" class="dynamic-bg"></div>
                <div id="remote-video"></div>
                
<div id="reaction-container" style="position:absolute; bottom:120px; left:0; width:100%; height:300px; pointer-events:none; z-index:15; overflow:hidden;"></div>

<div id="reactionPicker" style="position:absolute; bottom:110px; background:rgba(0,0,0,0.8); padding:10px; border-radius:30px; display:none; gap:10px; z-index:20; backdrop-filter:blur(10px);">
    <span onclick="CallUI.sendReaction('💖')" style="cursor:pointer; font-size:24px;">💖</span>
    <span onclick="CallUI.sendReaction('👍')" style="cursor:pointer; font-size:24px;">👍</span>
    <span onclick="CallUI.sendReaction('😂')" style="cursor:pointer; font-size:24px;">😂</span>
    <span onclick="CallUI.sendReaction('😮')" style="cursor:pointer; font-size:24px;">😮</span>
    <span onclick="CallUI.sendReaction('🔥')" style="cursor:pointer; font-size:24px;">🔥</span>
    <span onclick="CallUI.sendReaction('👏')" style="cursor:pointer; font-size:24px;">👏</span>
</div>

                <div id="reconnectOverlay" class="reconnect-overlay">
                    <div class="spinner"></div>
                    <p style="font-weight:500; letter-spacing:0.5px">Reconnecting...</p>
                </div>
                
                <div class="call-header">
                    <h2 id="activeCallerName">...</h2>
                    <div id="callDurationText">00:00</div>
                    <p id="callStatusLabel" style="font-size:12px; margin-top:10px; opacity:0.7; font-weight:600; text-transform:uppercase; letter-spacing:1.5px">Encrypted</p>
                </div>

                <div id="voice-placeholder" style="position:absolute; top:35%; width:100%; text-align:center; display:none; z-index:2; flex-direction:column; align-items:center">
                    <div style="width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; border: 4px solid rgba(255,255,255,0.05); box-shadow: 0 15px 35px rgba(0,0,0,0.3)">
                         <i class="fas fa-user fa-4x" style="opacity:0.8"></i>
                    </div>
                </div>

                <div id="local-video"></div>

<div class="call-controls">
    <button class="btn-call btn-mute" title="Speaker" id="speakerToggle" onclick="CallUI.toggleSpeaker()">
        <i class="fas fa-volume-up"></i>
    </button>
    <button class="btn-call btn-mute" title="Microphone" id="micToggle" onclick="CallUI.toggleMic()">
        <i class="fas fa-microphone"></i>
    </button>
    
    <button class="btn-call btn-mute" title="Share Screen" id="screenShareToggle">
        <i class="fas fa-desktop"></i>
    </button>

    <button class="btn-call btn-end" title="End Call" onclick="CallUI.endCall()">
        <i class="fas fa-phone-slash"></i>
    </button>

    <button class="btn-call btn-mute" title="Switch to Video" id="switchToVideoBtn" onclick="CallUI.switchToVideoCall()" style="display: none;">
        <i class="fas fa-video"></i>
    </button>

    <button class="btn-call btn-mute" title="Camera" id="camToggle" onclick="CallUI.toggleCam()">
        <i class="fas fa-video"></i>
    </button>
    <button class="btn-call btn-mute" title="Flip" id="flipToggle" onclick="CallUI.flipCamera()">
        <i class="fas fa-sync-alt"></i>
    </button>
    <button class="btn-call btn-mute" title="Reactions" onclick="CallUI.showReactionPicker()">
    <i class="far fa-smile"></i>
</button>
</div>

            <div id="minimizedBar" class="minimized-bar" onclick="CallUI.expandCall()">
                <div style="width:34px; height:34px; border-radius:50%; background:rgba(255,255,255,0.15); display:flex; align-items:center; justify-content:center; margin-right:12px;">
                    <i class="fas fa-phone-alt" style="font-size:14px"></i>
                </div>
                <div style="flex:1">
                    <div style="font-weight:700; font-size:13px; line-height:1.2">Ongoing <span id="minimizedType">Call</span></div>
                    <div id="miniTimer" style="font-size:11px; opacity:0.8; font-family:monospace">00:00</div>
                </div>
                <i class="fas fa-expand-alt" style="opacity:0.6; font-size:16px"></i>
            </div>
        `;
        document.body.appendChild(container);
    },

            setupSocketListeners() {
        socket.on('incoming-call-notice', (data) => {
            this.handleIncomingCall(data);
            socket.emit('call-ringing', { to: data.from });
        });

        socket.on('call-ringing', () => {
            if (this.state === 'outgoing') {
                document.getElementById('callStatusLabel').innerText = "Ringing...";
            }
        });

        socket.on('call-accepted', async (data) => {
            this.sounds.dialtone.pause();
            this.sounds.dialtone.currentTime = 0;
            document.getElementById('callStatusLabel').innerText = "Connecting...";
            await this.startAgoraStream(data.channelName);
        });

        socket.on('call-declined', () => {
            this.endCall(false);
        });

        socket.on('call-ended', () => {
            this.endCall(false);
        });

        socket.on('call-type-changed', (data) => {
            if (data.newType === 'video') {
                this.callType = 'video';
                document.getElementById('voice-placeholder').style.display = 'none';
                document.getElementById('remote-video').style.display = 'block';
                document.getElementById('local-video').style.display = 'block';
                document.getElementById('dynamicBg').style.opacity = '0';
                document.getElementById('camToggle').style.display = 'flex';
                document.getElementById('flipToggle').style.display = 'flex';
                document.getElementById('screenShareToggle').style.display = 'flex';
                document.getElementById('switchToVideoBtn').style.display = 'none';
            }
        });

        // FIXED: Explicitly listen for the reaction from socket
        socket.on('call-reaction', (data) => {
            if (this.state !== 'idle') {
                this.animateReaction(data.emoji);
            }
        });
    },
        handleIncomingCall(data) {
        this.syncTheme(); 
        this.state = 'incoming';
        this.isInitiator = false;
        this.remoteUser = data.from;
        this.currentChannel = data.channelName;
        this.callType = data.type;

        // Hardcoded Display Logic for Receiver
        const role = typeof userRole !== 'undefined' ? userRole : localStorage.getItem('userRole');
        const callerDisplayName = (role === 'teacher') ? "Student" : "Ustadh Teacher";
        const callerAvatar = data.fromAvatar || '';

        document.getElementById('callerName').innerText = callerDisplayName;
        document.getElementById('activeCallerName').innerText = callerDisplayName;
        document.getElementById('callStatusLabel').innerText = "Incoming...";
        
        const toastAvatar = document.getElementById('callerAvatar');
        if (callerAvatar) {
            toastAvatar.innerHTML = `<img src="${callerAvatar}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
        }

        const dynBg = document.getElementById('dynamicBg');
        if (callerAvatar) {
            dynBg.style.backgroundImage = `url(${callerAvatar})`;
        }

        document.getElementById('callTypeText').innerText = data.type;
        document.getElementById('incomingToast').classList.add('active');
        if (data.type === 'voice') {
    document.getElementById('switchToVideoBtn').style.display = 'flex'; // Show for receiver
} else {
    document.getElementById('switchToVideoBtn').style.display = 'none';
        }

        this.sounds.ringtone.play().catch(e => console.log("Audio blocked"));
        
        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    },

initiateCall(type) {
    if (typeof activeChatUser === 'undefined' || !activeChatUser) {
        return alert("Please select a user to call first.");
    }
    
    this.syncTheme();
    this.state = 'outgoing';
    this.isInitiator = true;
    this.callType = type;
    this.remoteUser = activeChatUser;
    const channelName = `room_${Math.random().toString(36).slice(2, 9)}`;
    this.currentChannel = channelName;
    
    const recipientImgEl = document.querySelector('.chat-header .chat-user-img img');
    const role = typeof userRole !== 'undefined' ? userRole : localStorage.getItem('userRole');

    const displayAs = (role === 'student') ? "Ustadh Teacher" : "Student";
    document.getElementById('activeCallerName').innerText = displayAs;
    document.getElementById('callStatusLabel').innerText = "Calling...";
    
    const recipientImg = recipientImgEl ? recipientImgEl.src : '';
    const dynBg = document.getElementById('dynamicBg');
    const voicePlaceholder = document.getElementById('voice-placeholder');
    
    if (recipientImg) {
        dynBg.style.backgroundImage = `url(${recipientImg})`;
        if (voicePlaceholder) {
            voicePlaceholder.innerHTML = `<div style="width:140px; height:140px; border-radius:50%; background:rgba(255,255,255,0.1); display:flex; align-items:center; justify-content:center; border: 4px solid rgba(255,255,255,0.05); box-shadow: 0 15px 35px rgba(0,0,0,0.3)"><img src="${recipientImg}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;"></div>`;
        }
    }

    const myImgEl = document.querySelector('.user-profile img');
    const myAvatar = myImgEl ? myImgEl.src : '';
    const localBox = document.getElementById('local-video');

    // CORRECTED LOGIC BLOCK
    if (type === 'voice') {
        voicePlaceholder.style.display = 'flex';
        document.getElementById('remote-video').style.display = 'none';
        document.getElementById('camToggle').style.display = 'none';
        document.getElementById('flipToggle').style.display = 'none';
        document.getElementById('screenShareToggle').style.display = 'none';
        document.getElementById('switchToVideoBtn').style.display = 'flex'; 
        localBox.style.display = 'none';
        dynBg.style.opacity = '1';
    } else {
        voicePlaceholder.style.display = 'none';
        document.getElementById('remote-video').style.display = 'block';
        document.getElementById('camToggle').style.display = 'flex';
        document.getElementById('flipToggle').style.display = 'flex';
        localBox.style.display = 'block';
        dynBg.style.opacity = '0';
    }

    this.expandCall();
    this.sounds.dialtone.play().catch(e => console.log("Audio blocked"));

    // This is the most important part that was being skipped:
    socket.emit('request-call', {
        to: activeChatUser,
        from: userId,
        fromAvatar: myAvatar,
        type: type,
        channelName: channelName
    });
},


    
    async acceptCall() {
        this.state = 'active';
        this.sounds.ringtone.pause();
        this.sounds.ringtone.currentTime = 0;
        document.getElementById('incomingToast').classList.remove('active');
        document.getElementById('activeCallerName').innerText = document.getElementById('callerName').innerText;
        this.expandCall();

        socket.emit('accept-call', {
            to: this.remoteUser,
            from: userId,
            channelName: this.currentChannel
        });

        await this.startAgoraStream(this.currentChannel);
    },

    declineCall() {
        if (this.remoteUser) {
            const role = typeof userRole !== 'undefined' ? userRole : localStorage.getItem('userRole');
            const myNameEl = document.querySelector('.user-profile h4');
            let baseName = myNameEl ? myNameEl.innerText : (role === 'teacher' ? 'Teacher' : 'Student');
            
            let myDisplayName = (role === 'teacher' && !baseName.includes('Ustadh')) 
                ? `Ustadh ${baseName}` 
                : baseName;

            socket.emit('send_private_message', {
                recipientId: this.remoteUser,
                senderId: userId,
                text: `📵 Missed ${this.callType} call from ${myDisplayName}`,
                isCallLog: true
            });
            socket.emit('decline-call', { to: this.remoteUser });
        }
        this.endCall(false, true); 
    },

        startTimer() {
        if (this.timerInterval) return; 

        let startTime = sessionStorage.getItem('activeCallStartTime');
        if (!startTime) {
            startTime = Date.now();
            sessionStorage.setItem('activeCallStartTime', startTime);
        }

        this.timerInterval = setInterval(() => {
            // Only update UI if we aren't currently reconnecting
            if (this.client && this.client.connectionState === "RECONNECTING") return;

            const now = Date.now();
            this.secondsElapsed = Math.floor((now - startTime) / 1000);

            const mins = Math.floor(this.secondsElapsed / 60).toString().padStart(2, '0');
            const secs = (this.secondsElapsed % 60).toString().padStart(2, '0');
            const timeStr = `${mins}:${secs}`;
            
            document.getElementById('callDurationText').innerText = timeStr;
            document.getElementById('miniTimer').innerText = timeStr;
        }, 1000);
    },


    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    },

            async startAgoraStream(channelName) {
    try {
        const response = await fetch(`${API_BASE}/agora/token?channelName=${channelName}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        if (!data.success) throw new Error("Token failed");

        sessionStorage.setItem('activeCallChannel', channelName);
        sessionStorage.setItem('activeCallRemoteUser', this.remoteUser);
        sessionStorage.setItem('activeCallType', this.callType);
        sessionStorage.setItem('activeCallRemoteName', document.getElementById('activeCallerName').innerText);

        this.client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });

        // Connection State Logic
        this.client.on("connection-state-change", (curState, revState) => {
            const statusLabel = document.getElementById('callStatusLabel');
            const reconnectUI = document.getElementById('reconnectOverlay');
            const timerDisplay = document.getElementById('callDurationText');

            if (curState === "CONNECTED") {
                statusLabel.innerText = "End-to-End Encrypted";
                reconnectUI.classList.remove('visible');
                timerDisplay.style.color = "white";
                this.sounds.reconnect.pause();
            } 
            else if (curState === "RECONNECTING") {
                statusLabel.innerText = "Reconnecting...";
                reconnectUI.classList.add('visible');
                timerDisplay.style.color = "#ff4b4b";
                this.sounds.reconnect.play().catch(e => {});
            } 
            else if (curState === "DISCONNECTED") {
                this.endCall(false);
            }
        });

        // Remote User Activity Monitoring
        this.client.on("user-published", async (user, mediaType) => {
            await this.client.subscribe(user, mediaType);
            if (mediaType === "video") user.videoTrack.play("remote-video");
            if (mediaType === "audio") user.audioTrack.play();
            
            if (this.callType === 'video') {
                // Force loudspeaker for video calls
                AgoraRTC.getPlaybackDevices().then(devices => {
                    const speaker = devices.find(d => d.label.toLowerCase().includes('speaker')) || devices[0];
                    user.audioTrack.setPlaybackDevice(speaker.deviceId);
                });
            }
            
            // If media starts flowing again, hide reconnecting UI
            document.getElementById('reconnectOverlay').classList.remove('visible');
            document.getElementById('callStatusLabel').innerText = "End-to-End Encrypted";
            
            if (this.state !== 'idle') this.startTimer();
        });

        // Handle when the OTHER person's network breaks
        this.client.on("user-left", (user, reason) => {
            if (reason === "ServerTimeOut") {
                // Show "Reconnecting" on Teacher side because Student dropped
                document.getElementById('callStatusLabel').innerText = "User connection lost...";
                document.getElementById('reconnectOverlay').classList.add('visible');
                document.getElementById('callDurationText').style.color = "#ff4b4b";
            } else {
                // Regular hang up
                this.endCall(false);
            }
        });

        document.getElementById('callStatusLabel').innerText = "Connecting...";
        await this.client.join(data.appId, channelName, data.token, null);

        if (this.callType === 'video') {
            [this.localTracks.audioTrack, this.localTracks.videoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();
            document.getElementById('local-video').style.display = 'block';
            this.localTracks.videoTrack.play('local-video');
            await this.client.publish([this.localTracks.audioTrack, this.localTracks.videoTrack]);
        } else {
            this.localTracks.audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
            await this.client.publish([this.localTracks.audioTrack]);
        }

    } catch (err) {
        console.error("Agora error:", err);
        this.endCall();
    }
},
    toggleMic() {
        if (!this.localTracks.audioTrack) return;
        const btn = document.getElementById('micToggle');
        const isEnabled = this.localTracks.audioTrack.enabled;
        this.localTracks.audioTrack.setEnabled(!isEnabled);
        btn.classList.toggle('off', isEnabled);
        btn.innerHTML = isEnabled ? '<i class="fas fa-microphone-slash"></i>' : '<i class="fas fa-microphone"></i>';
    },

    toggleCam() {
        if (!this.localTracks.videoTrack) return;
        const btn = document.getElementById('camToggle');
        const isEnabled = this.localTracks.videoTrack.enabled;
        this.localTracks.videoTrack.setEnabled(!isEnabled);
        btn.classList.toggle('off', isEnabled);
        btn.innerHTML = isEnabled ? '<i class="fas fa-video-slash"></i>' : '<i class="fas fa-video"></i>';
        document.getElementById('local-video').style.opacity = isEnabled ? '0' : '1';
    },

async flipCamera() {
        if (!this.localTracks.videoTrack) return;
        
        try {
            const cameras = await AgoraRTC.getCameras();
            if (cameras.length < 2) {
                console.warn("Only one camera detected.");
                return;
            }

            // Get current device ID
            const currentDeviceId = this.localTracks.videoTrack.getTrackLabel();
            // Find the other camera (switches between Front and Back on mobile)
            const nextCam = cameras.find(c => c.label !== currentDeviceId) || cameras[0];
            
            // Switch the device
            await this.localTracks.videoTrack.setDevice(nextCam.deviceId);
            
            // Visual feedback for the user
            const btn = document.getElementById('flipToggle');
            btn.style.transform = 'rotate(180deg)';
            setTimeout(() => btn.style.transform = 'rotate(0deg)', 300);

            console.log("Switched to camera:", nextCam.label);
        } catch (e) {
            console.error("Flip failed:", e);
        }
    },

        async toggleSpeaker() {
        if (!this.client) return;
        const btn = document.getElementById('speakerToggle');
        const isLoudspeakerActive = btn.classList.contains('active-feature');

        try {
            // Get all audio output devices
            const devices = await AgoraRTC.getPlaybackDevices();
            
            // Standard strategy: 
            // - Speakers usually have "Speaker" or "Loudspeaker" in the label.
            // - Earpieces usually have "Receiver" or "Internal" or are the default.
            
            let targetDevice;

            if (!isLoudspeakerActive) {
                // Switching TO Loudspeaker
                targetDevice = devices.find(d => d.label.toLowerCase().includes('speaker')) || devices[0];
                console.log("Switching to Loudspeaker:", targetDevice.label);
            } else {
                // Switching TO Earpiece
                targetDevice = devices.find(d => d.label.toLowerCase().includes('earpiece') || d.label.toLowerCase().includes('receiver')) || devices[0];
                console.log("Switching to Earpiece/Receiver:", targetDevice.label);
            }

            // Apply to all remote users
            this.client.remoteUsers.forEach(user => {
                if (user.audioTrack) {
                    user.audioTrack.setPlaybackDevice(targetDevice.deviceId);
                }
            });

            btn.classList.toggle('active-feature');
            btn.innerHTML = !isLoudspeakerActive ? '<i class="fas fa-volume-up"></i>' : '<i class="fas fa-volume-down"></i>';

        } catch (e) {
            console.error("Speaker switch failed:", e);
        }
    },


    async expandCall() {
        this.syncTheme();
        if (document.pictureInPictureElement) await document.exitPictureInPicture();
        document.getElementById('callOverlay').classList.add('active');
        document.getElementById('minimizedBar').classList.remove('active');
        window.history.pushState({ inCall: true }, 'Calling', '#active-call');
    },

    
    async minimizeCall() {
        document.getElementById('callOverlay').classList.remove('active');
        document.getElementById('minimizedBar').classList.add('active');
        document.getElementById('minimizedType').innerText = this.callType.charAt(0).toUpperCase() + this.callType.slice(1);

        const remoteVideoElement = document.querySelector('#remote-video video');
        if (remoteVideoElement && document.pictureInPictureEnabled) {
            try { await remoteVideoElement.requestPictureInPicture(); } catch (e) {}
        }
    },

    listenForBackbutton() {
        window.onpopstate = () => {
            if (this.state !== 'idle') this.minimizeCall();
        };

    },

    
async toggleScreenShare() {
    try {
        if (!this.isScreenSharing) {
            // 1. Create Screen Track
            this.screenTrack = await AgoraRTC.createScreenVideoTrack({
                optimizationMode: "detail",
                cursor: "always"
            });

            // Handle manual "Stop Sharing" from browser bar
            this.screenTrack.on("track-ended", () => this.stopScreenShare());

            // 2. Switch Tracks: Unpublish camera, publish screen
            if (this.localTracks.videoTrack) {
                await this.client.unpublish(this.localTracks.videoTrack);
            }
            await this.client.publish(this.screenTrack);

            // 3. Play locally and update UI
            this.screenTrack.play('local-video'); 
            document.getElementById('screenShareToggle').classList.add('active-feature');
            this.isScreenSharing = true;

            // Notify remote user to prepare for incoming screen stream
            socket.emit('screen-share-started', { to: this.remoteUser });

        } else {
            await this.stopScreenShare();
        }
    } catch (err) {
        console.error("Screen share failed:", err);
    }
},

async stopScreenShare() {
    if (!this.isScreenSharing || !this.screenTrack) return;

    try {
        await this.client.unpublish(this.screenTrack);
        this.screenTrack.stop();
        this.screenTrack.close();
        this.screenTrack = null;

        // Restore Camera if it was active
        if (this.localTracks.videoTrack) {
            await this.client.publish(this.localTracks.videoTrack);
            this.localTracks.videoTrack.play('local-video');
        }

        document.getElementById('screenShareToggle').classList.remove('active-feature');
        this.isScreenSharing = false;
        socket.emit('screen-share-stopped', { to: this.remoteUser });
    } catch (e) {
        console.error("Stop screen share error:", e);
    }
},

    async stopScreenShare() {
        if (!this.isScreenSharing) return;

        // 1. Unpublish and close screen track
        await this.client.unpublish(this.screenTrack);
        this.screenTrack.stop();
        this.screenTrack.close();
        this.screenTrack = null;

        // 2. Re-publish camera track if it exists
        if (this.localTracks.videoTrack) {
            await this.client.publish(this.localTracks.videoTrack);
            this.localTracks.videoTrack.play('local-video');
        }

        // 3. Reset UI
        document.getElementById('screenShareToggle').classList.remove('active-feature');
        this.isScreenSharing = false;
    },

    async switchToVideoCall() {
        try {
            // 1. Create the video track
            this.localTracks.videoTrack = await AgoraRTC.createCameraVideoTrack();
            
            // 2. Publish the new video track to the existing stream
            await this.client.publish(this.localTracks.videoTrack);
            
            // 3. Update UI Elements
            this.callType = 'video';
            sessionStorage.setItem('activeCallType', 'video');

            document.getElementById('voice-placeholder').style.display = 'none';
            document.getElementById('remote-video').style.display = 'block';
            document.getElementById('local-video').style.display = 'block';
            document.getElementById('dynamicBg').style.opacity = '0';
            
            // Show video controls, hide switch button
            document.getElementById('camToggle').style.display = 'flex';
            document.getElementById('flipToggle').style.display = 'flex';
            document.getElementById('screenShareToggle').style.display = 'flex';
            document.getElementById('switchToVideoBtn').style.display = 'none';

            // 4. Play local video
            this.localTracks.videoTrack.play('local-video');

            // 5. Notify the other user via Socket so their UI switches too
            socket.emit('call-type-changed', { 
                to: this.remoteUser, 
                newType: 'video' 
            });

        } catch (err) {
            console.error("Failed to switch to video:", err);
            alert("Could not access camera.");
        }
    },

    showReactionPicker() {
        const picker = document.getElementById('reactionPicker');
        picker.style.display = picker.style.display === 'none' ? 'flex' : 'none';
    },

    sendReaction(emoji) {
        this.animateReaction(emoji);
        socket.emit('call-reaction', { to: this.remoteUser, emoji: emoji });
        document.getElementById('reactionPicker').style.display = 'none';
    },

    animateReaction(emoji) {
        const container = document.getElementById('reaction-container');
        const el = document.createElement('div');
        el.innerText = emoji;
        el.style.cssText = `
            position: absolute; bottom: 0; left: ${Math.random() * 80 + 10}%;
            font-size: 30px; transition: all 3s ease-out; opacity: 1;
            transform: translateY(0);
        `;
        container.appendChild(el);

        // Trigger animation
        setTimeout(() => {
            el.style.transform = `translateY(-300px) translateX(${Math.random() * 40 - 20}px)`;
            el.style.opacity = '0';
        }, 50);

        setTimeout(() => el.remove(), 3000);
    },
    
    async endCall(shouldEmit = true, isRejected = false) {
        sessionStorage.removeItem('activeCallChannel');
        sessionStorage.removeItem('activeCallRemoteUser');
        sessionStorage.removeItem('activeCallType');
        sessionStorage.removeItem('activeCallRemoteName');
        sessionStorage.removeItem('activeCallStartTime');

        if (this.state === 'idle') return;

        const finalDuration = document.getElementById('callDurationText').innerText;
        const finalCallType = this.callType;
        const finalRemoteUser = this.remoteUser;
        const finalIsInitiator = this.isInitiator;

        this.stopTimer();
        this.state = 'idle';

        if (finalIsInitiator && !isRejected && finalRemoteUser) {
            const icon = finalCallType === 'video' ? '📹' : '📞';
            socket.emit('send_private_message', {
                recipientId: finalRemoteUser,
                senderId: userId,
                text: `${icon} Call ended • ${finalDuration}`,
                isCallLog: true
            });
        }

        if (shouldEmit && finalRemoteUser) socket.emit('end-call', { to: finalRemoteUser });

        this.isInitiator = false;
        this.currentChannel = null;
        this.remoteUser = null;
        this.sounds.ringtone.pause();
        this.sounds.dialtone.pause();

        if (this.localTracks.audioTrack) {
            this.localTracks.audioTrack.stop();
            this.localTracks.audioTrack.close();
            this.localTracks.audioTrack = null;
        }
        if (this.localTracks.videoTrack) {
            this.localTracks.videoTrack.stop();
            this.localTracks.videoTrack.close();
            this.localTracks.videoTrack = null;
        }

        if (this.client) {
            try { await this.client.leave(); } catch (e) {}
            this.client = null;
        }

        if (this.screenTrack) {
    this.screenTrack.stop();
    this.screenTrack.close();
    this.screenTrack = null;
    this.isScreenSharing = false;
}

        document.getElementById('callOverlay').classList.remove('active');
        document.getElementById('minimizedBar').classList.remove('active');
        document.getElementById('incomingToast').classList.remove('active');
        document.getElementById('reconnectOverlay').classList.remove('visible');
        
        document.getElementById('local-video').style.display = 'none';
        document.getElementById('callDurationText').innerText = "00:00";
        document.getElementById('miniTimer').innerText = "00:00";
        
        document.getElementById('micToggle').classList.remove('off');
        document.getElementById('micToggle').innerHTML = '<i class="fas fa-microphone"></i>';
        document.getElementById('camToggle').classList.remove('off');
        document.getElementById('camToggle').innerHTML = '<i class="fas fa-video"></i>';

        if (window.location.hash === '#active-call') {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    }
};


// Auto-initialize
document.addEventListener('DOMContentLoaded', () => CallUI.init());
