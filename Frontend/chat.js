const socket = io("https://alikroomislamicinstitute.onrender.com");

let currentUserId = ""; // SET THIS
let currentChatId = "";

// 🔥 CHANGE THIS MANUALLY FOR NOW
currentUserId = prompt("Enter your userId");

// LOAD USER CHATS
async function loadChats() {
    const res = await fetch(`/api/chats/user/${currentUserId}`);
    const chats = await res.json();

    const chatList = document.getElementById("chatList");
    chatList.innerHTML = "";

    chats.forEach(chat => {
        const div = document.createElement("div");
        div.className = "chat-item";
        div.innerText = chat.courseId?.title || "Chat";

        div.onclick = () => openChat(chat._id);

        chatList.appendChild(div);

        const chats = await res.json();

console.log("Chats response:", chats);

// FIX
const chatArray = Array.isArray(chats) ? chats : chats.data || [];

chatArray.forEach(chat => {
    const div = document.createElement("div");
    div.className = "chat-item";
    div.innerText = chat.courseId?.title || "Chat";

    div.onclick = () => openChat(chat._id);

    chatList.appendChild(div);
});
}

// OPEN CHAT
async function openChat(chatId) {
    currentChatId = chatId;

    document.getElementById("messages").innerHTML = "";

    // JOIN SOCKET ROOM
    socket.emit("join-chat", chatId);

    // LOAD OLD MESSAGES
    const res = await fetch(`/api/messages/${chatId}`);
    const messages = await res.json();

    messages.forEach(showMessage);
}

// SHOW MESSAGE
function showMessage(msg) {
    const div = document.createElement("div");
    div.innerText = msg.text;
    document.getElementById("messages").appendChild(div);
}

// SEND MESSAGE
function sendMessage() {
    const input = document.getElementById("messageInput");
    const text = input.value;

    if (!text) return;

    socket.emit("send-message", {
        chatId: currentChatId,
        sender: currentUserId,
        text
    });

    input.value = "";
}

// RECEIVE MESSAGE
socket.on("receive-message", (msg) => {
    if (msg.chatId === currentChatId) {
        showMessage(msg);
    }
});

// INIT
loadChats();