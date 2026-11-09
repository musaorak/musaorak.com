// Visit beacon: tells the site's Cloudflare Worker (worker/visits.js) which page was
// opened so it can record the visitor's network organization. No cookies, no IPs stored.
(function () {
  if (navigator.webdriver) return;                              // skip automated browsers
  if (!/(^|\.)musaorak\.com$/.test(location.hostname)) return;  // skip local previews
  var url = 'https://visits.musaorak.com/?p=' + encodeURIComponent(location.pathname) +
            '&r=' + encodeURIComponent(document.referrer);
  fetch(url, { keepalive: true, credentials: 'omit' }).catch(function () {});
})();
