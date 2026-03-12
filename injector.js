// injector.js — Content script (ISOLATED world, runs at document_start)
// Injects network-interceptor.js into the MAIN world, then loads content.js

(function () {
    'use strict';

    function injectScript(src) {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(src);
        s.onload = () => s.remove();
        (document.head || document.documentElement).appendChild(s);
    }

    function injectContentScript(src) {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(src);
        s.dataset.extensionId = chrome.runtime.id;
        (document.head || document.documentElement).appendChild(s);
    }

    // 1. Inject network interceptor into MAIN world (must be first to catch early requests)
    injectScript('network-interceptor.js');

    // 2. Inject content.js into MAIN world (for full DOM access and event sharing)
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => injectContentScript('content.js'));
    } else {
        injectContentScript('content.js');
    }
})();
