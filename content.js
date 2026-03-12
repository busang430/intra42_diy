// content.js — Intra42 DIY v1.0.0
// Main world script: injects period selector + debug data downloader
// into intra.42.fr attendance/logtime calendar section.

(function () {
    'use strict';

    if (window.__intra42DIY_content) return;
    window.__intra42DIY_content = true;

    // =============================================
    // Configuration
    // =============================================
    const VERSION = '1.0.0';
    const WIDGET_ID = 'intra42diy-widget';

    const PERIOD_OPTIONS = [
        { label: '1 Semaine', days: 7 },
        { label: '1 Mois', days: 30 },
        { label: '2 Mois', days: 60 },
        { label: '3 Mois', days: 90 },
        { label: '6 Mois', days: 180 },
        { label: '12 Mois', days: 365 },
        { label: '18 Mois', days: 548 },
        { label: '24 Mois', days: 730 },
    ];

    // =============================================
    // Internal state
    // =============================================
    let logs = [];
    let apiCaptures = [];
    let selectedPeriodDays = 30; // default: 1 month
    let widgetInjected = false;

    // =============================================
    // Logger
    // =============================================
    function log(level, msg, data) {
        const entry = {
            time: new Date().toISOString(),
            level,
            msg,
            data: data !== undefined ? JSON.stringify(data).substring(0, 2000) : null
        };
        logs.push(entry);
        if (logs.length > 300) logs = logs.slice(-250);
        console.log(`[Intra42 DIY] [${level.toUpperCase()}] ${msg}`, data !== undefined ? data : '');
    }

    log('info', `=== Intra42 DIY v${VERSION} started ===`);
    log('info', `Page: ${location.href}`);

    // =============================================
    // Collect API captures from network-interceptor.js
    // =============================================
    window.addEventListener('intra42diy_api_capture', (e) => {
        if (e.detail) {
            apiCaptures.push(e.detail);
            if (apiCaptures.length > 200) apiCaptures.shift();
            log('info', `API capture: ${e.detail.type} ${e.detail.url} (${e.detail.status})`);
        }
    });

    // =============================================
    // Inject CSS stylesheet
    // =============================================
    function injectStyles() {
        if (document.getElementById('intra42diy-styles')) return;
        const link = document.createElement('link');
        link.id = 'intra42diy-styles';
        link.rel = 'stylesheet';
        // Use inline styles if we can't load external (e.g. CSP) — fallback
        try {
            link.href = (window.__intra42DIY_base || '') + 'styles.css';
            document.head.appendChild(link);
        } catch (_) {
            injectInlineStyles();
        }
    }

    function injectInlineStyles() {
        if (document.getElementById('intra42diy-inline-styles')) return;
        const style = document.createElement('style');
        style.id = 'intra42diy-inline-styles';
        style.textContent = `
      #intra42diy-widget{display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap;}
      #intra42diy-label{font-size:12px;font-weight:600;color:#b0b8c4;letter-spacing:.5px;text-transform:uppercase;}
      #intra42diy-period-select{appearance:none;-webkit-appearance:none;background:#1e2533;color:#e8eaf0;border:1px solid #3a4555;border-radius:6px;padding:5px 28px 5px 10px;font-size:12px;font-family:inherit;cursor:pointer;outline:none;transition:border-color .2s,box-shadow .2s;min-width:120px;}
      #intra42diy-period-select:hover,#intra42diy-period-select:focus{border-color:#00babc;box-shadow:0 0 0 2px rgba(0,186,188,.2);}
      #intra42diy-debug-btn{display:inline-flex;align-items:center;gap:5px;background:linear-gradient(135deg,#1e2533 0%,#252e3e 100%);color:#b0b8c4;border:1px solid #3a4555;border-radius:6px;padding:5px 10px;font-size:11px;font-family:inherit;cursor:pointer;transition:all .2s ease;white-space:nowrap;}
      #intra42diy-debug-btn:hover{background:linear-gradient(135deg,#252e3e 0%,#2e3a50 100%);border-color:#00babc;color:#e8eaf0;box-shadow:0 0 0 2px rgba(0,186,188,.15);}
      #intra42diy-debug-btn:active{transform:scale(.97);}
      #intra42diy-hours-display{font-size:12px;color:#e8eaf0;padding:4px 8px;background:rgba(0,186,188,.1);border:1px solid rgba(0,186,188,.3);border-radius:6px;display:none;}
      #intra42diy-hours-display.visible{display:inline-flex;align-items:center;gap:4px;}
      #intra42diy-status{font-size:11px;color:#7a8899;font-style:italic;}
      @keyframes intra42diy-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      .intra42diy-spinner{display:inline-block;width:12px;height:12px;border:2px solid rgba(0,186,188,.3);border-top-color:#00babc;border-radius:50%;animation:intra42diy-spin .8s linear infinite;}
    `;
        document.head.appendChild(style);
    }

    // =============================================
    // Find the logtime/attendance section in the DOM
    // =============================================
    function findLogtimeSection() {
        // Try multiple known selectors for the logtime widget on intra.42.fr
        const candidateSelectors = [
            // Profile page logtime section
            '.logtime',
            '[id*="logtime"]',
            '[class*="logtime"]',
            // Attendance calendar (sometimes called "location")
            '.location-calendar',
            '[id*="location"]',
            '[class*="calendar"]',
            // The section header often says "Logtime" or "Attendance"
            '.profile-infos-container',
            '.user-profile',
            // Generic fallback: any section that might contain logtime data
            'section',
            '.box',
            '.panel',
        ];

        for (const sel of candidateSelectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const text = el.textContent || '';
                if (
                    text.match(/logtime|attendance|location|présence|heures/i) ||
                    el.querySelector('canvas, svg, table') // calendar-like child
                ) {
                    log('info', `Found logtime section via selector: ${sel}`);
                    return el;
                }
            }
        }

        log('warn', 'Could not find logtime section — will attach to best available container');

        // Fallback: find the main content area
        return (
            document.querySelector('.main-content') ||
            document.querySelector('main') ||
            document.querySelector('#content') ||
            document.querySelector('body')
        );
    }

    // =============================================
    // Build and inject the widget
    // =============================================
    function buildWidget() {
        const widget = document.createElement('div');
        widget.id = WIDGET_ID;
        widget.setAttribute('data-intra42diy', '1');

        // Label
        const label = document.createElement('span');
        label.id = 'intra42diy-label';
        label.textContent = '📅 Période';

        // Period dropdown
        const select = document.createElement('select');
        select.id = 'intra42diy-period-select';
        select.title = 'Choisir la durée d\'historique à afficher';

        PERIOD_OPTIONS.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt.days;
            option.textContent = opt.label;
            if (opt.days === selectedPeriodDays) option.selected = true;
            select.appendChild(option);
        });

        select.addEventListener('change', () => {
            selectedPeriodDays = parseInt(select.value, 10);
            const chosen = PERIOD_OPTIONS.find(o => o.days === selectedPeriodDays);
            log('info', `Period changed to: ${chosen?.label} (${selectedPeriodDays} days)`);
            updateHoursDisplay();
        });

        // Hours display (shown once we have data to compute)
        const hoursDisplay = document.createElement('span');
        hoursDisplay.id = 'intra42diy-hours-display';
        hoursDisplay.title = 'Heures cumulées sur la période';

        // Status span
        const status = document.createElement('span');
        status.id = 'intra42diy-status';
        status.textContent = '⏳ Collecte des données…';

        // Debug download button
        const debugBtn = document.createElement('button');
        debugBtn.id = 'intra42diy-debug-btn';
        debugBtn.title = 'Télécharger les données de debug (DOM + API) pour analyse';
        debugBtn.innerHTML = '📥 Debug Data';
        debugBtn.addEventListener('click', downloadDebugData);

        widget.appendChild(label);
        widget.appendChild(select);
        widget.appendChild(hoursDisplay);
        widget.appendChild(status);
        widget.appendChild(debugBtn);

        return widget;
    }

    function injectWidget() {
        if (document.getElementById(WIDGET_ID)) return; // already injected

        injectInlineStyles(); // prefer inline for reliability

        const target = findLogtimeSection();
        if (!target) {
            log('warn', 'No injection target found');
            return;
        }

        const widget = buildWidget();

        // Try to insert at a sensible position:
        // - After the first heading inside the section, OR
        // - At the beginning of the section
        const heading = target.querySelector('h1, h2, h3, h4');
        if (heading && heading.nextSibling) {
            target.insertBefore(widget, heading.nextSibling);
        } else {
            target.prepend(widget);
        }

        widgetInjected = true;
        log('info', `Widget injected into: ${target.tagName}#${target.id}.${target.className.split(' ')[0]}`);

        // Capture a DOM snapshot of the injection area for debug purposes
        captureDOM(target);
    }

    // =============================================
    // Compute and display hours from captured API data
    // =============================================
    function updateHoursDisplay() {
        const hoursDisplay = document.getElementById('intra42diy-hours-display');
        const status = document.getElementById('intra42diy-status');
        if (!hoursDisplay) return;

        // Look for location/logtime records in our captures
        const locationCaptures = apiCaptures.filter(c =>
            c.url.includes('location') || c.url.includes('logtime')
        );

        if (locationCaptures.length === 0) {
            if (status) status.textContent = '⚠️ Aucune donnée API capturée encore';
            return;
        }

        // Try to merge all location records
        let allRecords = [];
        locationCaptures.forEach(cap => {
            const body = cap.body;
            if (Array.isArray(body)) {
                allRecords = allRecords.concat(body);
            } else if (body && Array.isArray(body.locations)) {
                allRecords = allRecords.concat(body.locations);
            }
        });

        if (allRecords.length === 0) {
            if (status) status.textContent = '⚠️ Données API disponibles mais format inconnu — téléchargez le debug';
            return;
        }

        // Filter by selected period
        const cutoff = new Date(Date.now() - selectedPeriodDays * 24 * 60 * 60 * 1000);
        const filtered = allRecords.filter(r => {
            const begin = new Date(r.begin_at || r.beginAt || r.created_at);
            return begin >= cutoff;
        });

        // Sum durations
        let totalMs = 0;
        filtered.forEach(r => {
            const begin = new Date(r.begin_at || r.beginAt || r.created_at).getTime();
            const end = r.end_at
                ? new Date(r.end_at || r.endAt).getTime()
                : Date.now();
            if (!isNaN(begin) && !isNaN(end)) {
                totalMs += Math.max(0, end - begin);
            }
        });

        const totalHours = (totalMs / (1000 * 60 * 60)).toFixed(1);
        const totalDays = (totalMs / (1000 * 60 * 60 * 24)).toFixed(1);

        hoursDisplay.textContent = `⏱ ${totalHours}h (${filtered.length} sessions)`;
        hoursDisplay.classList.add('visible');

        if (status) status.textContent = `Sur ${PERIOD_OPTIONS.find(o => o.days === selectedPeriodDays)?.label || selectedPeriodDays + ' jours'} · ${filtered.length} sessions`;

        log('info', `Hours computed: ${totalHours}h over ${filtered.length} sessions for ${selectedPeriodDays} days`);
    }

    // =============================================
    // DOM snapshot capture
    // =============================================
    let domSnapshots = [];

    function captureDOM(el) {
        try {
            const snapshot = {
                timestamp: new Date().toISOString(),
                url: location.href,
                selector: `${el.tagName}#${el.id}.${el.className.split(' ')[0]}`,
                outerHTML: el.outerHTML.substring(0, 30000), // cap to 30KB
            };
            domSnapshots.push(snapshot);
            if (domSnapshots.length > 5) domSnapshots.shift();
            log('info', `DOM snapshot captured: ${snapshot.selector}`);
        } catch (e) {
            log('error', 'DOM snapshot failed', e.message);
        }
    }

    // =============================================
    // Debug Data Download
    // =============================================
    function downloadDebugData() {
        log('info', '📥 Starting debug data download...');

        // Capture current state of important DOM sections
        captureDOM(document.body);

        // Gather additional DOM info
        const domInfo = {
            url: location.href,
            title: document.title,
            timestamp: new Date().toISOString(),
            // Key selectors to help identify logtime widget
            knownSelectors: {
                '.logtime': !!document.querySelector('.logtime'),
                '.location-calendar': !!document.querySelector('.location-calendar'),
                '[class*="logtime"]': !!document.querySelector('[class*="logtime"]'),
                '[class*="calendar"]': !!document.querySelector('[class*="calendar"]'),
                '[class*="attendance"]': !!document.querySelector('[class*="attendance"]'),
                'canvas': document.querySelectorAll('canvas').length,
                'svg': document.querySelectorAll('svg').length,
            },
            // All class names visible on the page (useful for finding the right selector)
            allClasses: Array.from(new Set(
                Array.from(document.querySelectorAll('[class]'))
                    .flatMap(el => Array.from(el.classList))
                    .filter(c => c.length > 2 && c.length < 50)
                    .sort()
            )).slice(0, 500),
            // All IDs on the page
            allIds: Array.from(document.querySelectorAll('[id]'))
                .map(el => el.id)
                .filter(Boolean)
                .slice(0, 200),
        };

        // User info from DOM
        const userInfo = {
            login: getUserLoginFromDOM(),
            pageType: detectPageType(),
        };

        // Build final export object
        const exportData = {
            meta: {
                extension: `Intra42 DIY v${VERSION}`,
                exportTime: new Date().toISOString(),
                purpose: 'Debug data for developing the attendance calendar period selector',
                instructions: [
                    '1. Share this file with the developer (Antigravity)',
                    '2. Key sections: apiCaptures (API responses), domInfo (page selectors), domSnapshots (HTML)',
                    '3. The apiCaptures section contains all intercepted fetch/XHR calls',
                ]
            },
            userInfo,
            domInfo,
            domSnapshots,
            apiCaptures,
            extensionLogs: logs,
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `intra42diy_debug_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        log('info', `Debug export downloaded: ${(json.length / 1024).toFixed(1)} KB, ${apiCaptures.length} API captures`);

        // Update status
        const status = document.getElementById('intra42diy-status');
        if (status) {
            status.textContent = `✅ Debug téléchargé (${apiCaptures.length} captures API, ${(json.length / 1024).toFixed(0)} KB)`;
        }
    }

    // =============================================
    // Helpers
    // =============================================
    function getUserLoginFromDOM() {
        // Various places where intra.42.fr exposes the login
        const selectors = [
            '[data-login]',
            '.login[data-login]',
            '.user-login',
            '[class*="login"]',
            'a[href*="/users/"]',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) {
                const dl = el.getAttribute('data-login') || el.textContent?.trim();
                if (dl && dl.length > 1 && dl.length < 40) return dl;
            }
        }
        // Try to extract from URL like /users/zqian
        const urlMatch = location.href.match(/\/users\/([a-z0-9_-]+)/i);
        if (urlMatch) return urlMatch[1];
        return 'unknown';
    }

    function detectPageType() {
        const url = location.href;
        if (url.includes('/users/')) return 'user-profile';
        if (url.includes('/dashboard')) return 'dashboard';
        if (url.includes('/projects')) return 'projects';
        if (url.match(/intra\.42\.fr\/?$/)) return 'home';
        return 'other';
    }

    // =============================================
    // MutationObserver — re-inject when SPA navigates
    // =============================================
    function startObserver() {
        let debounceTimer = null;

        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                if (!document.getElementById(WIDGET_ID)) {
                    widgetInjected = false;
                    log('info', 'Widget lost (SPA navigation?), re-injecting...');
                    injectWidget();
                }
                // Update hours if new API data arrived
                if (apiCaptures.length > 0) {
                    updateHoursDisplay();
                }
            }, 800);
        });

        observer.observe(document.body, { childList: true, subtree: true });
        log('info', 'MutationObserver started');
    }

    // =============================================
    // Initial injection with retry
    // =============================================
    function tryInject(retries = 0) {
        const MAX = 20;
        const DELAY = 500;

        injectWidget();

        if (!widgetInjected && retries < MAX) {
            log('info', `Injection not successful yet (attempt ${retries + 1}/${MAX}), retrying...`);
            setTimeout(() => tryInject(retries + 1), DELAY);
        }
    }

    // =============================================
    // Periodically update hours as API data trickles in
    // =============================================
    function startHoursUpdateLoop() {
        // Update every 3s for the first minute, then every 15s
        let count = 0;
        const fastInterval = setInterval(() => {
            updateHoursDisplay();
            count++;
            if (count >= 20) {
                clearInterval(fastInterval);
                setInterval(() => updateHoursDisplay(), 15000);
            }
        }, 3000);
    }

    // =============================================
    // Entry point
    // =============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        log('info', 'Initializing Intra42 DIY...');
        tryInject();
        startObserver();
        startHoursUpdateLoop();
        log('info', 'Init complete');
    }

    // Expose a global debug handle for manual inspection in console
    window.intra42DIY = {
        version: VERSION,
        getLogs: () => logs,
        getCaptures: () => apiCaptures,
        downloadDebug: downloadDebugData,
        forceReinject: () => {
            widgetInjected = false;
            injectWidget();
        },
        updateHours: updateHoursDisplay,
    };

    log('info', 'window.intra42DIY debug handle exposed. Type intra42DIY in console to inspect.');

})();
