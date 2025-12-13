// Extract text function with improved content detection
function extractVisibleText() {
    const title = document.title;
    const description = document.querySelector('meta[name="description"]')?.content || "";

    // Try to find main content area (article, main, or body)
    const mainContent = document.querySelector('article, main, [role="main"]') || document.body;

    // Remove script, style, and nav elements from extraction
    const clone = mainContent.cloneNode(true);
    clone.querySelectorAll('script, style, nav, header, footer, aside').forEach(el => el.remove());

    const bodyText = clone.innerText;

    return `Title: ${title}\nDescription: ${description}\n\nContent:\n${bodyText}`;
}

// Create floating button with improved styling
function createFloatingButton() {
    if (document.getElementById('ai-summarizer-btn')) return; // Already exists

    const button = document.createElement('button');
    button.id = 'ai-summarizer-btn';
    button.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
        </svg>
    `;
    button.title = 'AI Summarize Page';
    button.setAttribute('aria-label', 'Summarize page with AI');
    document.body.appendChild(button);

    // Make button draggable
    makeDraggable(button);

    button.addEventListener('click', handleSummarize);
}

// Make button draggable for better UX
function makeDraggable(element) {
    let isDragging = false;
    let currentX;
    let currentY;
    let initialX;
    let initialY;

    element.addEventListener('mousedown', dragStart);
    document.addEventListener('mousemove', drag);
    document.addEventListener('mouseup', dragEnd);

    function dragStart(e) {
        if (e.target === element) {
            initialX = e.clientX - element.offsetLeft;
            initialY = e.clientY - element.offsetTop;
            isDragging = true;
        }
    }

    function drag(e) {
        if (isDragging) {
            e.preventDefault();
            currentX = e.clientX - initialX;
            currentY = e.clientY - initialY;
            element.style.left = currentX + 'px';
            element.style.top = currentY + 'px';
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
    }

    function dragEnd() {
        isDragging = false;
    }
}

// Create summary modal with improved design
function createModal() {
    if (document.getElementById('ai-summarizer-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ai-summarizer-modal';
    modal.innerHTML = `
        <div class="ai-summarizer-backdrop"></div>
        <div class="ai-summarizer-dialog">
            <div class="ai-summarizer-header">
                <h3>✨ AI Summary</h3>
                <button class="ai-summarizer-close" aria-label="Close">×</button>
            </div>
            <div class="ai-summarizer-content"></div>
            <div class="ai-summarizer-footer">
                <button class="ai-summarizer-copy-btn">📋 Copy</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Close button handler
    modal.querySelector('.ai-summarizer-close').addEventListener('click', () => {
        modal.classList.remove('visible');
    });

    // Backdrop click to close
    modal.querySelector('.ai-summarizer-backdrop').addEventListener('click', () => {
        modal.classList.remove('visible');
    });

    // Copy button handler
    modal.querySelector('.ai-summarizer-copy-btn').addEventListener('click', () => {
        const content = modal.querySelector('.ai-summarizer-content').textContent;
        navigator.clipboard.writeText(content).then(() => {
            const btn = modal.querySelector('.ai-summarizer-copy-btn');
            const originalText = btn.textContent;
            btn.textContent = '✓ Copied!';
            setTimeout(() => {
                btn.textContent = originalText;
            }, 2000);
        });
    });

    // ESC key to close
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('visible')) {
            modal.classList.remove('visible');
        }
    });
}

// Handle summarize action with better error handling
async function handleSummarize() {
    const button = document.getElementById('ai-summarizer-btn');
    const modal = document.getElementById('ai-summarizer-modal');
    const content = modal.querySelector('.ai-summarizer-content');

    // Show loading state
    button.classList.add('loading');
    button.disabled = true;
    modal.classList.add('visible');
    content.innerHTML = `
        <div class="loading-spinner"></div>
        <p>Analyzing page content...</p>
    `;

    try {
        const text = extractVisibleText();

        // Check if extension context is valid
        if (!chrome.runtime?.id) {
            throw new Error('Extension context invalidated. Please reload this page.');
        }

        // Send message to background script
        const response = await chrome.runtime.sendMessage({
            action: 'SUMMARIZE',
            text: text
        });

        if (response.success) {
            // Format the response with markdown-like styling
            content.innerHTML = formatSummary(response.data);
        } else {
            content.innerHTML = `
                <div class="error-message">
                    <strong>⚠️ Error:</strong> ${response.error}
                </div>
            `;
        }
    } catch (error) {
        console.error('Summarization error:', error);

        // Check if it's a context invalidation error
        if (error.message.includes('Extension context invalidated') ||
            error.message.includes('message port closed') ||
            !chrome.runtime?.id) {
            content.innerHTML = `
                <div class="error-message">
                    <strong>⚠️ Extension Reloaded</strong>
                    <p>Please <strong>reload this page</strong> and try again.</p>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="error-message">
                    <strong>⚠️ Error:</strong> ${error.message}
                </div>
            `;
        }
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Format summary with better readability
function formatSummary(text) {
    // Convert markdown-like formatting to HTML
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')  // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')              // Italic
        .replace(/\n\n/g, '</p><p>')                       // Paragraphs
        .replace(/\n- /g, '<li>')                          // List items
        .replace(/\n/g, '<br>');                           // Line breaks

    // Wrap in paragraph tags
    formatted = '<p>' + formatted + '</p>';

    // Fix list items
    formatted = formatted.replace(/(<li>.*?<\/p>)/g, '<ul>$1</ul>');
    formatted = formatted.replace(/<\/p><ul>/g, '<ul>').replace(/<\/ul><p>/g, '</ul>');

    return formatted;
}

// Initialize
createFloatingButton();
createModal();

// Message listener for popup compatibility
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg === "GET_TEXT") {
        sendResponse(extractVisibleText());
    } else if (msg.action === "SUMMARIZE_FROM_POPUP") {
        handleSummarize();
        sendResponse({ success: true });
    }
    return true; // Keep message channel open for async response
});

// Show button only after page is fully loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        const button = document.getElementById('ai-summarizer-btn');
        if (button) button.style.opacity = '1';
    });
} else {
    const button = document.getElementById('ai-summarizer-btn');
    if (button) button.style.opacity = '1';
}
