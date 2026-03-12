// content.js — Intra42 DIY v1.1.0 (ISOLATED world content script)
// Injected directly by Chrome via manifest. Runs at document_idle.
// Communicates with network-interceptor.js (MAIN world) via CustomEvents on window.

(function () {
    'use strict';

    if (window.__intra42DIY_content) return;
    window.__intra42DIY_content = true;

    // =============================================
    // Config
    // =============================================
    const VERSION = '1.1.0';
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

    let logs = [];
    let apiCaptures = [];
    let selectedPeriodDays = 30;

    // =============================================
    // Logger
    // =============================================
    function log(level, msg, data) {
        const entry = {
            time: new Date().toISOString(), level, msg,
            data: data !== undefined ? String(JSON.stringify(data)).substring(0, 1000) : null
        };
        logs.push(entry);
        if (logs.length > 300) logs = logs.slice(-250);
        console.log(`[Intra42 DIY v${VERSION}] [${level}] ${msg}`, data !== undefined ? data : '');
    }

    log('info', `=== Intra42 DIY v${VERSION} started (ISOLATED world) ===`);
    log('info', `URL: ${location.href}`);

    // =============================================
    // Listen for API captures from MAIN world (network-interceptor.js)
    // CustomEvents cross world-boundary via window
    // =============================================
    window.addEventListener('intra42diy_api_capture', (e) => {
        if (e && e.detail) {
            apiCaptures.push(e.detail);
            if (apiCaptures.length > 200) apiCaptures.shift();
            log('info', `[API] ${e.detail.type} ${e.detail.url} → ${e.detail.status}`);
            // Update hours display whenever new data arrives
            scheduleHoursUpdate();
        }
    });

    // =============================================
    // Inject inline styles (no external file load needed in isolated world)
    // =============================================
    function injectStyles() {
        if (document.getElementById('intra42diy-styles')) return;
        const style = document.createElement('style');
        style.id = 'intra42diy-styles';
        style.textContent = `
      #intra42diy-widget {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 0 6px 0;
        flex-wrap: wrap;
        font-family: 'Nunito', 'Roboto', system-ui, sans-serif;
      }
      #intra42diy-label {
        font-size: 11px;
        font-weight: 700;
        color: #7a8899;
        text-transform: uppercase;
        letter-spacing: 0.8px;
      }
      #intra42diy-period-select {
        background: #1a2236;
        color: #e0e6f0;
        border: 1px solid #2e3d55;
        border-radius: 5px;
        padding: 4px 24px 4px 8px;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        outline: none;
        transition: border-color .2s, box-shadow .2s;
        min-width: 110px;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%23888' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 7px center;
      }
      #intra42diy-period-select:hover,
      #intra42diy-period-select:focus {
        border-color: #00babc;
        box-shadow: 0 0 0 2px rgba(0,186,188,.18);
      }
      #intra42diy-period-select option {
        background: #1a2236;
      }
      #intra42diy-hours-badge {
        font-size: 11px;
        font-weight: 600;
        color: #00babc;
        padding: 3px 8px;
        background: rgba(0,186,188,.1);
        border: 1px solid rgba(0,186,188,.3);
        border-radius: 4px;
        display: none;
      }
      #intra42diy-hours-badge.show { display: inline-block; }
      #intra42diy-debug-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        background: #1a2236;
        color: #7a8899;
        border: 1px solid #2e3d55;
        border-radius: 5px;
        padding: 4px 9px;
        font-size: 11px;
        font-family: inherit;
        cursor: pointer;
        transition: all .18s;
        white-space: nowrap;
      }
      #intra42diy-debug-btn:hover {
        border-color: #00babc;
        color: #e0e6f0;
        background: #1e2d45;
      }
      #intra42diy-debug-btn:active { transform: scale(.96); }
      #intra42diy-status {
        font-size: 10px;
        color: #4a5a70;
        font-style: italic;
      }
    `;
        document.head.appendChild(style);
        log('info', 'Styles injected');
    }

    // =============================================
    // Find the LOGTIME section in the DOM
    // Uses multiple strategies targeting intra.42.fr structure
    // =============================================
    function findLogtimeSection() {
        // Strategy 1: Look for an element whose visible text starts with "LOGTIME"
        const allEls = document.querySelectorAll('section, div, article, aside');
        for (const el of allEls) {
            // Check direct text node children (not all descendants, to avoid false positives)
            const directText = Array.from(el.childNodes)
                .filter(n => n.nodeType === Node.TEXT_NODE || n.nodeName.match(/^H[1-6]$|^SPAN$|^P$|^LABEL$/i))
                .map(n => (n.textContent || '').trim())
                .join(' ');

            if (/^logtime$/i.test(directText.trim())) {
                log('info', `Found LOGTIME section (text match): ${el.tagName}#${el.id}`);
                return el;
            }
        }

        // Strategy 2: Find a heading or label with text "LOGTIME"
        const headers = document.querySelectorAll('h1,h2,h3,h4,h5,h6,span,label,p,div');
        for (const h of headers) {
            const t = (h.textContent || '').trim();
            if (/^logtime$/i.test(t) && t.length < 15) {
                const parent = h.closest('section, article, .box, .panel, [class*="section"]') || h.parentElement;
                log('info', `Found LOGTIME via header: ${h.tagName} → parent ${parent?.tagName}#${parent?.id}`);
                return parent;
            }
        }

        // Strategy 3: class/id heuristics
        const heuristicSelectors = [
            '[class*="logtime"]', '[id*="logtime"]',
            '[class*="attendance"]', '[id*="attendance"]',
            '[class*="location"]', '[id*="location"]',
            '[class*="calendar"]', '[id*="calendar"]',
        ];
        for (const sel of heuristicSelectors) {
            const el = document.querySelector(sel);
            if (el) {
                log('info', `Found logtime via heuristic selector: ${sel}`);
                return el;
            }
        }

        // Strategy 4: Find a section that contains calendar-like content (month names)
        const monthNames = /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|déc|fév|avr|mai|août/i;
        for (const el of allEls) {
            const text = el.textContent || '';
            const matches = (text.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|déc|fév|avr|mai|août)\b/gi) || []).length;
            if (matches >= 2 && el.querySelectorAll('td, th, [class*="day"]').length > 5) {
                log('info', `Found calendar section via month names: ${el.tagName}#${el.id}`);
                return el;
            }
        }

        log('warn', 'Could not find logtime section. Dumping all sections for debug:');
        allEls.forEach((el, i) => {
            if (i < 30) log('debug', `Section[${i}]: ${el.tagName}#${el.id}.${el.className.substring(0, 40)}`);
        });

        return null;
    }

    // =============================================
    // Build and inject the widget
    // =============================================
    function injectWidget() {
        if (document.getElementById(WIDGET_ID)) return;

        injectStyles();

        const target = findLogtimeSection();
        if (!target) {
            log('warn', 'No logtime section found on this page — widget not injected');
            return;
        }

        const widget = document.createElement('div');
        widget.id = WIDGET_ID;

        // Label
        const label = document.createElement('span');
        label.id = 'intra42diy-label';
        label.textContent = '📅';

        // Dropdown
        const select = document.createElement('select');
        select.id = 'intra42diy-period-select';
        select.title = 'Choisir la période d\'historique';
        PERIOD_OPTIONS.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.days;
            o.textContent = opt.label;
            if (opt.days === selectedPeriodDays) o.selected = true;
            select.appendChild(o);
        });
        select.addEventListener('change', () => {
            selectedPeriodDays = parseInt(select.value, 10);
            log('info', `Period changed to ${selectedPeriodDays} days`);
            updateHoursDisplay();
        });

        // Hours badge
        const badge = document.createElement('span');
        badge.id = 'intra42diy-hours-badge';

        // Status
        const status = document.createElement('span');
        status.id = 'intra42diy-status';
        status.textContent = '⏳ attente données…';

        // Debug button
        const btn = document.createElement('button');
        btn.id = 'intra42diy-debug-btn';
        btn.innerHTML = '📥 Debug';
        btn.title = 'Télécharger les données de debug pour analyse';
        btn.addEventListener('click', downloadDebugData);

        widget.appendChild(label);
        widget.appendChild(select);
        widget.appendChild(badge);
        widget.appendChild(status);
        widget.appendChild(btn);

        // Insert: try after first heading, else prepend
        const heading = target.querySelector('h1,h2,h3,h4,h5,h6');
        if (heading && heading.parentNode === target) {
            heading.insertAdjacentElement('afterend', widget);
        } else if (heading) {
            heading.parentElement.insertAdjacentElement('afterend', widget);
        } else {
            target.prepend(widget);
        }

        log('info', `✅ Widget injected into ${target.tagName}#${target.id}.${target.className.substring(0, 30)}`);

        // Capture DOM snapshot for debug
        captureDOM(target);
    }

    // =============================================
    // Hours computation
    // =============================================
    let hoursUpdateTimer = null;
    function scheduleHoursUpdate() {
        clearTimeout(hoursUpdateTimer);
        hoursUpdateTimer = setTimeout(updateHoursDisplay, 500);
    }

    function updateHoursDisplay() {
        const badge = document.getElementById('intra42diy-hours-badge');
        const status = document.getElementById('intra42diy-status');

        if (!badge) return;

        // Collect all location/logtime records
        let allRecords = [];
        apiCaptures.forEach(cap => {
            const body = cap.body;
            if (Array.isArray(body)) {
                allRecords = allRecords.concat(body);
            } else if (body && Array.isArray(body.data)) {
                allRecords = allRecords.concat(body.data);
            }
        });

        // Filter records that look like location objects (have begin_at)
        const locationRecords = allRecords.filter(r =>
            r && (r.begin_at || r.beginAt) && typeof r === 'object'
        );

        if (locationRecords.length === 0) {
            if (status) status.textContent = `⏳ ${apiCaptures.length} API calls, 0 sessions`;
            return;
        }

        // Filter by period
        const cutoff = new Date(Date.now() - selectedPeriodDays * 86400000);
        const filtered = locationRecords.filter(r => {
            const begin = new Date(r.begin_at || r.beginAt);
            return begin >= cutoff;
        });

        // Sum durations
        let totalMs = 0;
        filtered.forEach(r => {
            const begin = new Date(r.begin_at || r.beginAt).getTime();
            const end = r.end_at
                ? new Date(r.end_at || r.endAt).getTime()
                : Date.now();
            if (!isNaN(begin) && !isNaN(end) && end > begin) {
                totalMs += end - begin;
            }
        });

        const hrs = (totalMs / 3600000).toFixed(1);
        const period = PERIOD_OPTIONS.find(o => o.days === selectedPeriodDays);

        badge.textContent = `⏱ ${hrs}h`;
        badge.classList.add('show');
        if (status) status.textContent = `${filtered.length} sessions sur ${period?.label}`;

        log('info', `Hours: ${hrs}h over ${filtered.length}/${locationRecords.length} sessions (period: ${selectedPeriodDays}d)`);
    }

    // =============================================
    // DOM snapshot
    // =============================================
    let domSnapshots = [];
    function captureDOM(el) {
        try {
            domSnapshots.push({
                timestamp: new Date().toISOString(),
                url: location.href,
                tagName: el.tagName,
                id: el.id,
                className: el.className,
                outerHTML: el.outerHTML.substring(0, 20000),
            });
            if (domSnapshots.length > 3) domSnapshots.shift();
        } catch (_) { }
    }

    // =============================================
    // Debug data download
    // =============================================
    function downloadDebugData() {
        log('info', 'Debug download initiated');

        // Full body snapshot (for finding selectors)
        let bodySnapshot = '';
        try {
            bodySnapshot = document.body.innerHTML.substring(0, 100000);
        } catch (_) { }

        // All class names and IDs on page
        const allClasses = Array.from(new Set(
            Array.from(document.querySelectorAll('[class]'))
                .flatMap(el => Array.from(el.classList))
        )).sort().slice(0, 1000);

        const allIds = Array.from(document.querySelectorAll('[id]'))
            .map(el => el.id).filter(Boolean).slice(0, 300);

        // Key selector checks
        const selectorChecks = {};
        [
            '.logtime', '[class*="logtime"]', '[id*="logtime"]',
            '.calendar', '[class*="calendar"]', '[class*="attendance"]',
            '.location', '[class*="location"]', 'canvas', 'table',
            'section', '.box', '.panel', '[ng-controller]', '[data-ng-controller]'
        ].forEach(sel => {
            selectorChecks[sel] = document.querySelectorAll(sel).length;
        });

        const exportData = {
            meta: {
                extension: `Intra42 DIY v${VERSION}`,
                exportTime: new Date().toISOString(),
                url: location.href,
                title: document.title,
            },
            user: getUserLogin(),
            selectorChecks,
            allClasses,
            allIds,
            domSnapshots,
            bodySnapshot,
            apiCaptures,
            logs,
        };

        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `intra42diy_debug_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);

        const status = document.getElementById('intra42diy-status');
        if (status) status.textContent = `✅ Debug téléchargé (${apiCaptures.length} API, ${(json.length / 1024).toFixed(0)}KB)`;

        log('info', `Downloaded: ${(json.length / 1024).toFixed(1)}KB, ${apiCaptures.length} captures`);
    }

    // =============================================
    // Helpers
    // =============================================
    function getUserLogin() {
        const fromAttr = document.querySelector('[data-login]');
        if (fromAttr) return fromAttr.getAttribute('data-login');
        const urlMatch = location.href.match(/\/users\/([a-z0-9_-]+)/i);
        if (urlMatch) return urlMatch[1];
        return 'unknown';
    }

    // =============================================
    // MutationObserver — re-inject on SPA navigation
    // =============================================
    function startObserver() {
        let timer = null;
        const obs = new MutationObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (!document.getElementById(WIDGET_ID)) {
                    log('info', 'Widget lost, re-injecting...');
                    injectWidget();
                }
            }, 600);
        });
        obs.observe(document.body, { childList: true, subtree: true });
        log('info', 'MutationObserver started');
    }

    // =============================================
    // Entry point with retry
    // =============================================
    let retryCount = 0;
    function tryInject() {
        injectWidget();
        if (!document.getElementById(WIDGET_ID) && retryCount < 15) {
            retryCount++;
            log('info', `Retry ${retryCount}/15 in 1s...`);
            setTimeout(tryInject, 1000);
        }
    }

    tryInject();
    startObserver();

    // Expose debug handle in the page's window
    window.intra42DIY = {
        version: VERSION,
        getLogs: () => logs,
        getCaptures: () => apiCaptures,
        downloadDebug: downloadDebugData,
        reinject: () => { document.getElementById(WIDGET_ID)?.remove(); tryInject(); },
    };

    log('info', '✅ Init complete. Use window.intra42DIY in console to debug.');

})();
