// injector.js — Content script (ISOLATED world, runs at document_start)
// Only injects network-interceptor.js into the MAIN world.
// content.js is injected directly by Chrome (declared in manifest as content_script).

(function () {
    'use strict';

    function injectMainWorldScript(src) {
        const s = document.createElement('script');
        s.src = chrome.runtime.getURL(src);
        s.onload = () => s.remove();
        (document.head || document.documentElement).appendChild(s);
    }

    // Inject network interceptor into MAIN world (must run before page makes API calls)
    injectMainWorldScript('network-interceptor.js');
})();
