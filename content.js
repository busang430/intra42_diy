// content.js — Intra42 DIY v1.3.0 (ISOLATED world content script)
// Logtime widget + calendar extension using native #user-locations SVG

(function () {
  'use strict';

  if (window.__intra42DIY_content) return;
  window.__intra42DIY_content = true;

  const VERSION = '1.3.0';
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
  let logtimeStats = null;

  // =============================================
  // Logger
  // =============================================
  function log(level, msg, data) {
    const entry = {
      time: new Date().toISOString(), level, msg,
      data: data !== undefined ? String(JSON.stringify(data)).substring(0, 500) : null
    };
    logs.push(entry);
    if (logs.length > 200) logs = logs.slice(-180);
    console.log(`[Intra42 DIY v${VERSION}] [${level}] ${msg}`, data !== undefined ? data : '');
  }

  log('info', `=== Intra42 DIY v${VERSION} started ===`);

  // =============================================
  // Collect API captures from network-interceptor.js (MAIN world)
  // =============================================
  window.addEventListener('intra42diy_api_capture', (e) => {
    if (!e || !e.detail) return;
    apiCaptures.push(e.detail);
    if (apiCaptures.length > 200) apiCaptures.shift();

    const url = e.detail.url || '';
    const body = e.detail.body;

    if (url.includes('locations_stats') && body && typeof body === 'object') {
      logtimeStats = body;
      log('info', `✅ locations_stats captured: ${Object.keys(body).length} days`);
      scheduleUpdate();
    }
  });

  // =============================================
  // Parse "HH:MM:SS" → seconds
  // =============================================
  function parseTimeToSeconds(str) {
    if (!str || str === '00:00:00') return 0;
    const parts = str.split(':').map(Number);
    if (parts.length !== 3) return 0;
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  // =============================================
  // Format seconds → "Xh YYm"
  // =============================================
  function formatSeconds(totalSec) {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    if (h === 0) return `${m}m`;
    return m > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
  }

  // =============================================
  // Compute total hours for selected period
  // =============================================
  function computeHoursForPeriod(days) {
    if (!logtimeStats) return null;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    cutoff.setHours(0, 0, 0, 0);
    let totalSec = 0, dayCount = 0, activeDays = 0;
    for (const [dateStr, timeStr] of Object.entries(logtimeStats)) {
      const date = new Date(dateStr + 'T00:00:00');
      if (date >= cutoff) {
        const secs = parseTimeToSeconds(timeStr);
        totalSec += secs;
        dayCount++;
        if (secs > 0) activeDays++;
      }
    }
    return { totalSec, dayCount, activeDays };
  }

  // =============================================
  // Inline styles
  // =============================================
  function injectStyles() {
    if (document.getElementById('intra42diy-styles')) return;
    const style = document.createElement('style');
    style.id = 'intra42diy-styles';
    style.textContent = `
      #intra42diy-widget {
        display: flex;
        align-items: center;
        gap: 6px;
        margin: 6px 0 10px 0;
        flex-wrap: wrap;
        font-family: inherit;
      }
      #intra42diy-period-select {
        background: rgba(255,255,255,0.06);
        color: #cdd5e0;
        border: 1px solid rgba(255,255,255,0.15);
        border-radius: 5px;
        padding: 3px 22px 3px 8px;
        font-size: 12px;
        font-family: inherit;
        cursor: pointer;
        outline: none;
        transition: border-color .2s;
        appearance: none;
        -webkit-appearance: none;
        background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath fill='%23888' d='M0 0l5 6 5-6z'/%3E%3C/svg%3E");
        background-repeat: no-repeat;
        background-position: right 6px center;
        min-width: 100px;
      }
      #intra42diy-period-select:hover { border-color: #00babc; }
      #intra42diy-period-select option { background: #1a2236; color: #e0e6f0; }
      #intra42diy-hours-badge {
        font-size: 12px; font-weight: 700; color: #00babc;
        padding: 2px 8px;
        background: rgba(0,186,188,.12);
        border: 1px solid rgba(0,186,188,.35);
        border-radius: 4px; display: none; white-space: nowrap;
      }
      #intra42diy-hours-badge.show { display: inline-block; }
      #intra42diy-sub {
        font-size: 10px; color: #7a8899; display: none; white-space: nowrap;
      }
      #intra42diy-sub.show { display: inline-block; }
      #intra42diy-debug-btn {
        display: inline-flex; align-items: center; gap: 4px;
        background: rgba(255,255,255,0.04); color: #5a6878;
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 5px; padding: 3px 8px; font-size: 10px;
        font-family: inherit; cursor: pointer; transition: all .18s;
        white-space: nowrap; margin-left: auto;
      }
      #intra42diy-debug-btn:hover { border-color: #00babc; color: #e0e6f0; }
    `;
    document.head.appendChild(style);
  }

  // =============================================
  // Find the LOGTIME container
  // =============================================
  function findLogtimeContainer() {
    const h4s = document.querySelectorAll('h4.profile-title');
    for (const h4 of h4s) {
      if (/^\s*logtime\s*$/i.test(h4.textContent)) return h4.parentElement;
    }
    const headings = document.querySelectorAll('h1,h2,h3,h4,h5,h6');
    for (const h of headings) {
      if (/^\s*logtime\s*$/i.test(h.textContent)) return h.parentElement;
    }
    const svg = document.getElementById('user-locations');
    if (svg) return svg.closest('.container-inner-item') || svg.parentElement;
    return null;
  }

  // =============================================
  // Build and inject the widget
  // =============================================
  function injectWidget() {
    if (document.getElementById(WIDGET_ID)) return;
    injectStyles();
    const container = findLogtimeContainer();
    if (!container) { log('warn', 'Container not found'); return; }

    const widget = document.createElement('div');
    widget.id = WIDGET_ID;

    const select = document.createElement('select');
    select.id = 'intra42diy-period-select';
    select.title = "Période d'historique à cumuler";
    PERIOD_OPTIONS.forEach(opt => {
      const o = document.createElement('option');
      o.value = opt.days;
      o.textContent = opt.label;
      if (opt.days === selectedPeriodDays) o.selected = true;
      select.appendChild(o);
    });
    select.addEventListener('change', () => {
      selectedPeriodDays = parseInt(select.value, 10);
      // Reset calendar guard so it redraws
      const svg = document.getElementById('user-locations');
      if (svg) svg.removeAttribute('data-diy-period');
      log('info', `Period changed: ${selectedPeriodDays}d`);
      scheduleUpdate();
    });

    const badge = document.createElement('span');
    badge.id = 'intra42diy-hours-badge';

    const sub = document.createElement('span');
    sub.id = 'intra42diy-sub';

    const btn = document.createElement('button');
    btn.id = 'intra42diy-debug-btn';
    btn.textContent = '📥 Debug';
    btn.title = 'Télécharger les données de debug';
    btn.addEventListener('click', downloadDebugData);

    widget.appendChild(select);
    widget.appendChild(badge);
    widget.appendChild(sub);
    widget.appendChild(btn);

    const h4 = container.querySelector('h4.profile-title');
    if (h4 && h4.parentNode === container) {
      h4.insertAdjacentElement('afterend', widget);
    } else if (h4) {
      h4.parentElement.insertAdjacentElement('afterend', widget);
    } else {
      container.prepend(widget);
    }

    log('info', `✅ Widget injected into ${container.tagName}#${container.id}.${container.className.split(' ')[0]}`);
    scheduleUpdate();
  }

  // =============================================
  // Extend the native #user-locations SVG calendar
  //
  // EXACT NATIVE COORDINATES (verified from DOM snapshot):
  //   blockOriginX(m) = 162 + m * 144  (m=0: Dec, m=1: Jan, m=2: Feb, m=3: Mar)
  //   month label x   = blockOriginX + 63
  //   day rect x      = blockOriginX + col * 18  (col 0..6)
  //   day rect y      = 40 + row * 18             (row 0..4)
  //   native viewBox  = "150 0 600 200" (4 months)
  // =============================================
  function extendCalendar() {
    if (!logtimeStats) return;

    const nativeSvg = document.getElementById('user-locations');
    if (!nativeSvg) { log('warn', '#user-locations not found yet'); return; }

    // Don't rebuild if already done for this period
    if (nativeSvg.getAttribute('data-diy-period') === String(selectedPeriodDays)) return;
    nativeSvg.setAttribute('data-diy-period', String(selectedPeriodDays));

    const CELL = 18;
    const MON_STRIDE = 144;
    const NATIVE_MONTHS = 4;
    const NATIVE_FIRST_BLOCK_X = 162; // x of Dec's col-0 in native SVG

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Oldest month to show
    const targetStart = new Date(today);
    targetStart.setDate(today.getDate() - selectedPeriodDays + 1);
    targetStart.setDate(1);

    // Total months to display
    const totalMonths = Math.max(NATIVE_MONTHS,
      (today.getFullYear() - targetStart.getFullYear()) * 12
      + (today.getMonth() - targetStart.getMonth()) + 1
    );
    const extraMonths = totalMonths - NATIVE_MONTHS;

    // The LAST month is always the current month.
    // In native: last month index = 3 (Mar) → blockOriginX = 162 + 3*144 = 594
    // When we add extra months, they go to the LEFT.
    // So month index 0 (oldest) = last month - (totalMonths-1)
    // blockOriginX(m) = nativeLastBlockX - (totalMonths-1-m) * MON_STRIDE
    //                 = 594 - (totalMonths-1-m) * 144
    const NATIVE_LAST_BLOCK_X = 162 + (NATIVE_MONTHS - 1) * MON_STRIDE; // = 594

    // ViewBox: extend leftward for extra months
    const newMinX = 150 - extraMonths * MON_STRIDE;
    const newWidth = 600 + extraMonths * MON_STRIDE;

    const svgNS = "http://www.w3.org/2000/svg";
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // 1. Clear existing SVG content
    while (nativeSvg.firstChild) {
      nativeSvg.removeChild(nativeSvg.firstChild);
    }

    // 2. Rebuild with proper createElementNS to keep SVG namespace intact
    for (let m = 0; m < totalMonths; m++) {
      const monthDate = new Date(targetStart.getFullYear(), targetStart.getMonth() + m, 1);
      const curYear = monthDate.getFullYear();
      const curMonth = monthDate.getMonth();
      const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();

      const blockOriginX = NATIVE_LAST_BLOCK_X - (totalMonths - 1 - m) * MON_STRIDE;
      const labelX = blockOriginX + 63;

      const title = document.createElementNS(svgNS, 'text');
      title.setAttribute('x', labelX);
      title.setAttribute('y', '20');
      title.setAttribute('fill', '#999');
      title.setAttribute('width', '126');
      title.setAttribute('height', '126');
      title.setAttribute('font-family', 'sans-serif');
      title.setAttribute('font-size', '10');
      title.textContent = monthNames[curMonth];
      nativeSvg.appendChild(title);

      let col = 0, row = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const boxDate = new Date(curYear, curMonth, d);
        if (boxDate > today) break;

        const dateStr = curYear + '-'
          + String(curMonth + 1).padStart(2, '0') + '-'
          + String(d).padStart(2, '0');

        const timeStr = logtimeStats[dateStr] || '00:00:00';
        const sec = parseTimeToSeconds(timeStr);
        const hours = sec / 3600;

        let fill = '#fafafa';
        let textFill = '#ccc';
        if (hours > 0) {
          if (hours < 3) { fill = '#004b4c'; textFill = '#9dd'; }
          else if (hours < 6) { fill = '#008183'; textFill = '#fff'; }
          else if (hours < 9) { fill = '#00babc'; textFill = '#fff'; }
          else { fill = '#1de9eb'; textFill = '#005'; }
        }

        const hoverTitle = hours > 0 ? formatSeconds(sec).replace(' ', '') : '0h00';
        const cx = blockOriginX + col * CELL;
        const cy = 40 + row * CELL;
        const textX = cx + (d < 10 ? 4.5 : 2.5);
        const textY = cy + 11;

        const g = document.createElementNS(svgNS, 'g');
        g.setAttribute('data-toggle', 'tooltip');
        g.setAttribute('data-original-title', hoverTitle);

        const rect = document.createElementNS(svgNS, 'rect');
        rect.setAttribute('x', cx);
        rect.setAttribute('y', cy);
        rect.setAttribute('width', '18');
        rect.setAttribute('height', '18');
        rect.setAttribute('stroke', '#fff');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('fill', fill);

        const text = document.createElementNS(svgNS, 'text');
        text.setAttribute('x', textX);
        text.setAttribute('y', textY);
        text.setAttribute('fill', textFill);
        text.setAttribute('width', '18');
        text.setAttribute('height', '18');
        text.setAttribute('font-family', 'sans-serif');
        text.setAttribute('font-size', '9');
        text.textContent = d;

        g.appendChild(rect);
        g.appendChild(text);
        nativeSvg.appendChild(g);

        col++;
        if (col > 6) { col = 0; row++; }
      }
    }

    nativeSvg.setAttribute('viewBox', `${newMinX} 0 ${newWidth} 200`);
    log('info', `✅ Calendar: ${totalMonths} months, viewBox="${newMinX} 0 ${newWidth} 200"`);

    try {
      if (window.jQuery) window.jQuery(nativeSvg).find('[data-toggle="tooltip"]').tooltip();
    } catch (e) { }
  }

  // =============================================
  // Update hours badge + calendar
  // =============================================
  let updateTimer = null;
  function scheduleUpdate() {
    clearTimeout(updateTimer);
    updateTimer = setTimeout(doUpdate, 300);
  }

  function doUpdate() {
    const badge = document.getElementById('intra42diy-hours-badge');
    const sub = document.getElementById('intra42diy-sub');
    if (!badge || !logtimeStats) return;

    const result = computeHoursForPeriod(selectedPeriodDays);
    if (!result) return;

    const { totalSec, dayCount, activeDays } = result;
    const label = PERIOD_OPTIONS.find(o => o.days === selectedPeriodDays)?.label || `${selectedPeriodDays}j`;

    badge.textContent = `⏱ ${formatSeconds(totalSec)}`;
    badge.classList.add('show');
    if (sub) {
      sub.textContent = `${activeDays} jours actifs / ${dayCount} jours`;
      sub.classList.add('show');
    }

    log('info', `${label}: ${formatSeconds(totalSec)} | ${activeDays}/${dayCount} jours actifs`);
    extendCalendar();
  }

  // =============================================
  // Debug data download
  // =============================================
  function downloadDebugData() {
    const exportData = {
      meta: { extension: `Intra42 DIY v${VERSION}`, exportTime: new Date().toISOString(), url: location.href },
      user: getUserLogin(),
      logtimeStats,
      apiCaptures,
      logs,
      domSnapshot: (() => {
        const c = findLogtimeContainer();
        return c ? c.outerHTML.substring(0, 20000) : null;
      })(),
      selectorChecks: {
        'h4.profile-title[text=Logtime]': (() => {
          const h4s = document.querySelectorAll('h4.profile-title');
          return Array.from(h4s).filter(h => /logtime/i.test(h.textContent)).length;
        })(),
        '#user-locations': !!document.getElementById('user-locations'),
        '#intra42diy-widget': !!document.getElementById(WIDGET_ID),
      }
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
    log('info', `Debug downloaded: ${(json.length / 1024).toFixed(1)}KB`);
  }

  function getUserLogin() {
    const el = document.querySelector('[data-login]');
    if (el) return el.getAttribute('data-login');
    const m = location.href.match(/\/users\/([a-z0-9_-]+)/i);
    return m ? m[1] : 'unknown';
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
          log('info', 'Widget missing, re-injecting...');
          injectWidget();
        }
      }, 500);
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  // =============================================
  // Entry point with retry
  // =============================================
  let retries = 0;
  function tryInject() {
    injectWidget();
    if (!document.getElementById(WIDGET_ID) && retries < 20) {
      retries++;
      setTimeout(tryInject, 800);
    }
  }

  tryInject();
  startObserver();

  window.intra42DIY = {
    version: VERSION,
    getStats: () => logtimeStats,
    getLogs: () => logs,
    getCaptures: () => apiCaptures,
    download: downloadDebugData,
    reinject: () => {
      document.getElementById(WIDGET_ID)?.remove();
      const svg = document.getElementById('user-locations');
      if (svg) svg.removeAttribute('data-diy-period');
      retries = 0;
      tryInject();
    },
  };

  log('info', '✅ Init complete. Debug: window.intra42DIY');

})();
