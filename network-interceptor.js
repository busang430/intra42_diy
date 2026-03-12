// network-interceptor.js — Runs in MAIN world
// Intercepts all fetch() and XMLHttpRequest calls to capture API responses
// Dispatches captured data to the isolated world via CustomEvent

(function () {
    'use strict';

    if (window.__intra42DIY_interceptor) return; // prevent double injection
    window.__intra42DIY_interceptor = true;

    const captures = [];
    const MAX_CAPTURES = 200;

    // Keywords to filter relevant URLs (logtime, locations, users)
    const RELEVANT_PATTERNS = [
        '/v2/users',
        '/v2/locations',
        '/v2/campus',
        'logtime',
        'locations',
        'cursus_users',
        '/profile',
        'coalitions',
        '/scale_teams',
        '/events'
    ];

    function isRelevant(url) {
        return RELEVANT_PATTERNS.some(p => url.includes(p));
    }

    function dispatchCapture(entry) {
        captures.push(entry);
        if (captures.length > MAX_CAPTURES) captures.shift();
        window.dispatchEvent(new CustomEvent('intra42diy_api_capture', { detail: entry }));
    }

    // ======== Intercept fetch ========
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || '');
        const response = await originalFetch.apply(this, args);

        if (isRelevant(url)) {
            try {
                const cloned = response.clone();
                const text = await cloned.text();
                let body;
                try { body = JSON.parse(text); } catch (_) { body = text; }

                dispatchCapture({
                    type: 'fetch',
                    url,
                    status: response.status,
                    timestamp: new Date().toISOString(),
                    body: typeof body === 'string'
                        ? body.substring(0, 5000)
                        : JSON.parse(JSON.stringify(body).substring(0, 50000)) // truncate
                });
            } catch (e) {
                // silently ignore capture errors
            }
        }

        return response;
    };

    // ======== Intercept XMLHttpRequest ========
    const OrigXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function () {
        const xhr = new OrigXHR();
        const origOpen = xhr.open.bind(xhr);
        let capturedUrl = '';

        xhr.open = function (method, url, ...rest) {
            capturedUrl = url;
            return origOpen(method, url, ...rest);
        };

        xhr.addEventListener('load', function () {
            if (!capturedUrl || !isRelevant(capturedUrl)) return;
            try {
                let body;
                try { body = JSON.parse(xhr.responseText); } catch (_) { body = xhr.responseText; }

                dispatchCapture({
                    type: 'xhr',
                    url: capturedUrl,
                    status: xhr.status,
                    timestamp: new Date().toISOString(),
                    body: typeof body === 'string'
                        ? body.substring(0, 5000)
                        : JSON.parse(JSON.stringify(body).substring(0, 50000))
                });
            } catch (e) {
                // silently ignore
            }
        });

        return xhr;
    };
    window.XMLHttpRequest.prototype = OrigXHR.prototype;

    console.log('[Intra42 DIY] Network interceptor loaded ✅');
})();
