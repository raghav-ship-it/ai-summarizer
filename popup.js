const GEMINI_API_KEY = "AIzaSyAyS7xDN4gzycg7IP5A-ipCPJxWpuB62Ic";

// State
let sessions = {};
let currentSessionId = null;
let pageContext = null; // { text: string, base64Image: string }
let currentFile = null; // { name: string, size: number, content: string, type: string }

// DOM Elements
const chatHistoryEl = document.getElementById("chat-history");
const userInputEl = document.getElementById("userInput");
const sendBtnEl = document.getElementById("sendBtn");
const summarizeBtnEl = document.getElementById("summarizeBtn");
const sessionListEl = document.getElementById("sessionList");
const newChatBtnEl = document.getElementById("newChatBtn");
const fileUploadBtnEl = document.getElementById("fileUploadBtn");
const fileInputEl = document.getElementById("fileInput");
const filePreviewEl = document.getElementById("filePreview");

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
    await loadSessions();

    // If no sessions, create one. If sessions exist, load the last one.
    const sessionIds = Object.keys(sessions).sort((a, b) => sessions[b].timestamp - sessions[a].timestamp);
    if (sessionIds.length > 0) {
        loadSession(sessionIds[0]);
    } else {
        createNewSession();
    }
});

// --- Event Listeners ---
sendBtnEl.addEventListener("click", handleUserMessage);
userInputEl.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleUserMessage();
    }
});
userInputEl.addEventListener("input", () => {
    sendBtnEl.disabled = userInputEl.value.trim() === "";
    userInputEl.style.height = "auto";
    userInputEl.style.height = Math.min(userInputEl.scrollHeight, 100) + "px";
});

summarizeBtnEl.addEventListener("click", handleSummarize);
newChatBtnEl.addEventListener("click", createNewSession);
fileUploadBtnEl.addEventListener("click", () => fileInputEl.click());
fileInputEl.addEventListener("change", handleFileUpload);

// --- Core Logic ---

async function handleUserMessage() {
    const text = userInputEl.value.trim();
    if (!text) return;

    userInputEl.value = "";
    userInputEl.style.height = "auto";
    sendBtnEl.disabled = true;

    // Add to UI
    appendMessage("user", text);

    // Update State
    const session = sessions[currentSessionId];
    session.messages.push({ role: "user", parts: [{ text: text }] });

    // Update Title if it's the first user message
    if (session.messages.filter(m => m.role === "user").length === 1) {
        session.title = text.substring(0, 30) + (text.length > 30 ? "..." : "");
        renderSessionList();
    }

    await saveSessions();
    await processAIResponse();
}

async function handleSummarize() {
    const text = "Summarize this page for me.";

    // Add to UI
    appendMessage("user", text);

    // Update State
    const session = sessions[currentSessionId];
    session.messages.push({ role: "user", parts: [{ text: text }] });

    if (session.title === "New Chat") {
        session.title = "Page Summary";
        renderSessionList();
    }

    await saveSessions();
    await processAIResponse();
}

async function processAIResponse() {
    const loadingId = appendLoadingIndicator();
    const session = sessions[currentSessionId];

    try {
        if (!pageContext) {
            pageContext = await capturePageContext();
        }

        const responseText = await callGemini(session.messages, pageContext);

        removeLoadingIndicator(loadingId);
        appendMessage("ai", responseText);

        session.messages.push({ role: "model", parts: [{ text: responseText }] });
        await saveSessions();

    } catch (error) {
        removeLoadingIndicator(loadingId);
        console.error("AI Error:", error);

        let errorMessage = "Sorry, I encountered an error. Please try again.";
        if (error.message.includes("429") || error.message.includes("Resource exhausted")) {
            errorMessage = "⚠️ **Quota Exceeded**: The free API limit has been reached. Please wait a minute and try again.";
        } else if (error.message.includes("Failed to fetch")) {
            errorMessage = "⚠️ **Connection Error**: Please check your internet connection.";
        } else {
            errorMessage += " " + (error.message || "");
        }

        appendMessage("ai", errorMessage);
    }
}

// --- Session Management ---

function createNewSession() {
    const id = Date.now().toString();
    sessions[id] = {
        id: id,
        title: "New Chat",
        timestamp: Date.now(),
        messages: []
    };
    currentSessionId = id;
    saveSessions();
    loadSession(id);
    renderSessionList();
}

function loadSession(id) {
    currentSessionId = id;
    const session = sessions[id];

    // Clear UI
    chatHistoryEl.innerHTML = '';

    // Add Welcome Message if empty
    if (session.messages.length === 0) {
        chatHistoryEl.innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">👋</div>
                <h2>Hi there!</h2>
                <p>I'm your AI Study Companion. Click the document icon to summarize this page, or ask me anything about it.</p>
            </div>
        `;
    } else {
        // Render messages
        session.messages.forEach(msg => {
            appendMessage(msg.role === "model" ? "ai" : "user", msg.parts[0].text);
        });
    }

    // Update Sidebar Selection
    renderSessionList();
    scrollToBottom();
}

async function loadSessions() {
    const result = await chrome.storage.local.get("chatSessions");
    if (result.chatSessions) {
        sessions = result.chatSessions;
    }
}

async function saveSessions() {
    // Update timestamp of current session
    if (currentSessionId && sessions[currentSessionId]) {
        sessions[currentSessionId].timestamp = Date.now();
    }
    await chrome.storage.local.set({ chatSessions: sessions });
}

function renderSessionList() {
    sessionListEl.innerHTML = "";

    const sortedSessions = Object.values(sessions).sort((a, b) => b.timestamp - a.timestamp);

    sortedSessions.forEach(session => {
        const el = document.createElement("div");
        el.className = `session-item ${session.id === currentSessionId ? "active" : ""}`;
        el.onclick = () => loadSession(session.id);

        const title = document.createElement("div");
        title.className = "session-title";
        title.innerText = session.title;

        const date = document.createElement("div");
        date.className = "session-date";
        date.innerText = new Date(session.timestamp).toLocaleDateString();

        el.appendChild(title);
        el.appendChild(date);
        sessionListEl.appendChild(el);
    });
}

// --- API & Helpers --- (Kept mostly same, just context integration)

async function capturePageContext() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        let text = await getPageText(tab.id);
        const screenshotUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "jpeg" });
        const base64Image = screenshotUrl.split(",")[1];
        return { text, base64Image };
    } catch (error) {
        console.error("Context Capture Error:", error);
        throw new Error("Failed to capture page context. Try reloading the page.");
    }
}

function getPageText(tabId) {
    return new Promise(async (resolve, reject) => {
        const sendMessage = () => {
            return new Promise((res, rej) => {
                chrome.tabs.sendMessage(tabId, "GET_TEXT", (response) => {
                    if (chrome.runtime.lastError) rej(chrome.runtime.lastError);
                    else res(response);
                });
            });
        };
        try {
            const text = await sendMessage();
            resolve(text);
        } catch (error) {
            await chrome.scripting.executeScript({ target: { tabId: tabId }, files: ["content.js"] });
            try { resolve(await sendMessage()); } catch (e) { reject(e); }
        }
    });
}

async function callGemini(history, context) {
    const apiContents = [...history];

    // Build context parts
    let contextParts = [];

    // Add system prompt for structured responses
    const systemPrompt = `You are a helpful AI assistant. When providing answers:
- Use clear headings (## for main sections, ### for subsections) to organize information
- Use bullet points for lists and key points
- Break down complex answers into well-structured sections
- Use code blocks (\`\`\`) for technical content or code
- Keep paragraphs concise and scannable
- Avoid long, single-paragraph responses

Provide structured, easy-to-read responses that help users quickly understand the information.`;

    contextParts.push({ text: systemPrompt });

    // Add webpage context
    contextParts.push({ text: "\n\nHere is the context of the webpage I am looking at (Screenshot and Text). Use this to answer my questions.\n\nText Content:\n" + context.text });
    contextParts.push({ inline_data: { mime_type: "image/jpeg", data: context.base64Image } });

    // Add file context if available
    if (currentFile) {
        contextParts.push({ text: `\n\n--- Uploaded File: ${currentFile.name} ---\n${currentFile.content}\n--- End of File ---` });
    }

    const contextMessage = {
        role: "user",
        parts: contextParts
    };

    let payloadContents = [];
    if (apiContents.length > 0) {
        const firstMsg = apiContents[0];
        if (firstMsg.role === "user") {
            const newFirstMsg = {
                role: "user",
                parts: [...contextMessage.parts, ...firstMsg.parts]
            };
            payloadContents = [newFirstMsg, ...apiContents.slice(1)];
        } else {
            payloadContents = [contextMessage, ...apiContents];
        }
    } else {
        payloadContents = [contextMessage];
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${GEMINI_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: payloadContents })
    });

    const data = await response.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    } else {
        throw new Error("API Error: " + JSON.stringify(data));
    }
}

function appendMessage(role, text) {
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerText = role === "user" ? "U" : "AI";

    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = parseMarkdown(text);

    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);

    chatHistoryEl.appendChild(msgDiv);
    scrollToBottom();
}

function appendLoadingIndicator() {
    const id = "loading-" + Date.now();
    const msgDiv = document.createElement("div");
    msgDiv.className = "message ai";
    msgDiv.id = id;
    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.innerText = "AI";
    const content = document.createElement("div");
    content.className = "message-content";
    content.innerHTML = `<div class="typing-indicator"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
    msgDiv.appendChild(avatar);
    msgDiv.appendChild(content);
    chatHistoryEl.appendChild(msgDiv);
    scrollToBottom();
    return id;
}

function removeLoadingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function scrollToBottom() {
    chatHistoryEl.scrollTop = chatHistoryEl.scrollHeight;
}

function parseMarkdown(text) {
    if (!text) return "";
    let html = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/^\s*-\s+(.*$)/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    if (!html.startsWith('<')) html = '<p>' + html + '</p>';
    return html;
}

// --- File Upload Functions ---

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
        alert("File size must be less than 10MB");
        fileInputEl.value = "";
        return;
    }

    try {
        let content = "";
        const fileType = file.name.split(".").pop().toLowerCase();

        if (fileType === "pdf") {
            content = await extractPDFText(file);
        } else if (["txt", "md", "doc", "docx"].includes(fileType)) {
            content = await readTextFile(file);
        } else {
            alert("Unsupported file type. Please upload PDF, TXT, MD, DOC, or DOCX files.");
            fileInputEl.value = "";
            return;
        }

        currentFile = {
            name: file.name,
            size: file.size,
            content: content,
            type: fileType
        };

        displayFilePreview();

    } catch (error) {
        console.error("File processing error:", error);
        alert("Failed to process file. Please try again.");
        fileInputEl.value = "";
    }
}

async function extractPDFText(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n\n";
    }

    return fullText.trim();
}

async function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(file);
    });
}

function displayFilePreview() {
    if (!currentFile) {
        filePreviewEl.style.display = "none";
        return;
    }

    const sizeKB = (currentFile.size / 1024).toFixed(1);
    filePreviewEl.style.display = "flex";
    filePreviewEl.innerHTML = `
        <div class="file-preview-item">
            <div class="file-preview-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                </svg>
            </div>
            <div class="file-preview-name">${currentFile.name}</div>
            <div class="file-preview-size">${sizeKB} KB</div>
            <button class="file-preview-remove" onclick="removeFile()" title="Remove file">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `;
}

function removeFile() {
    currentFile = null;
    fileInputEl.value = "";
    displayFilePreview();
}

