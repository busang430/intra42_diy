// background.js — Service Worker for Intra42 DIY extension
// Handles messages from content scripts if needed in the future.

chrome.runtime.onInstalled.addListener(() => {
    console.log('[Intra42 DIY] Extension installed/updated (v1.0.0)');
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ping') {
        sendResponse({ status: 'ok', version: '1.0.0' });
        return true;
    }
});
