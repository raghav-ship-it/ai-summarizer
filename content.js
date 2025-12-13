// Extract text function
function extractVisibleText() {
    const title = document.title;
    const description = document.querySelector('meta[name="description"]')?.content || "";
    const bodyText = document.body.innerText;
    return `Title: ${title}\nDescription: ${description}\n\nContent:\n${bodyText}`;
}

// Create floating button
function createFloatingButton() {
    if (document.getElementById('ai-summarizer-btn')) return; // Already exists

    const button = document.createElement('button');
    button.id = 'ai-summarizer-btn';
    button.innerHTML = '✨';
    button.title = 'Summarize Page';
    document.body.appendChild(button);

    button.addEventListener('click', handleSummarize);
}

// Create summary modal
function createModal() {
    if (document.getElementById('ai-summarizer-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'ai-summarizer-modal';
    modal.innerHTML = `
        <div class="ai-summarizer-header">
            <h3>AI Summary</h3>
            <button class="ai-summarizer-close">×</button>
        </div>
        <div class="ai-summarizer-content"></div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.ai-summarizer-close').addEventListener('click', () => {
        modal.classList.remove('visible');
    });
}

// Handle summarize action
async function handleSummarize() {
    const button = document.getElementById('ai-summarizer-btn');
    const modal = document.getElementById('ai-summarizer-modal');
    const content = modal.querySelector('.ai-summarizer-content');

    // Show loading state
    button.classList.add('loading');
    button.disabled = true;
    modal.classList.add('visible');
    content.textContent = 'Analyzing page...';

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
            content.textContent = response.data;
        } else {
            content.textContent = 'Error: ' + response.error;
        }
    } catch (error) {
        console.error('Summarization error:', error);

        // Check if it's a context invalidation error
        if (error.message.includes('Extension context invalidated') ||
            error.message.includes('message port closed') ||
            !chrome.runtime?.id) {
            content.innerHTML = '⚠️ Extension was reloaded. Please <strong>reload this page</strong> and try again.';
        } else {
            content.textContent = 'Error: Could not summarize page. ' + error.message;
        }
    } finally {
        button.classList.remove('loading');
        button.disabled = false;
    }
}

// Initialize
createFloatingButton();
createModal();

// Legacy message listener for popup compatibility
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg === "GET_TEXT") {
        sendResponse(extractVisibleText());
    }
});
