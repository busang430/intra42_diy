// popup.js — Intra42 DIY extension popup

document.addEventListener('DOMContentLoaded', () => {
    const statusDot = document.getElementById('statusDot');
    const statusText = document.getElementById('statusText');
    const openIntraBtn = document.getElementById('openIntraBtn');

    // Check if we're on an intra.42.fr tab
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab) {
            setStatus('inactive', '⚠️ Aucun onglet actif');
            return;
        }

        const url = tab.url || '';
        if (url.includes('intra.42.fr')) {
            // Try to ping the content script
            chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    setStatus('inactive', '⏳ Injection en cours…');
                } else {
                    setStatus('active', `✅ Extension active sur intra`);
                }
            });
        } else {
            setStatus('inactive', '🔴 Pas sur intra.42.fr');
        }
    });

    // Open intra.42.fr button
    openIntraBtn.addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://intra.42.fr' });
        window.close();
    });

    function setStatus(state, text) {
        if (statusDot) {
            statusDot.className = 'dot ' + (state === 'active' ? 'active' : 'inactive');
        }
        if (statusText) statusText.textContent = text;
    }
});
