const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "SUMMARIZE") {
        handleSummarize(sender.tab.id, request.text)
            .then(result => sendResponse({ success: true, data: result }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep channel open for async response
    }
});

async function handleSummarize(tabId, text) {
    try {
        // Capture screenshot
        const screenshotUrl = await chrome.tabs.captureVisibleTab(null, { format: "jpeg" });
        const base64Image = screenshotUrl.split(",")[1];

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: "Analyze this webpage screenshot and the extracted text below. Provide a comprehensive summary of the content I am seeing, including any visual insights (like charts or layout) if relevant.\n\n" + text
                        },
                        {
                            inline_data: {
                                mime_type: "image/jpeg",
                                data: base64Image
                            }
                        }
                    ]
                }]
            })
        });

        const data = await response.json();

        if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error("Invalid response: " + JSON.stringify(data));
        }
    } catch (error) {
        console.error("Error in handleSummarize:", error);
        throw error;
    }
}
