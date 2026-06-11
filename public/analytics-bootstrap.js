// Google Analytics 4 + Consent Mode v2.
// Default to all storage denied; the cookie banner flips ad/analytics storage
// to "granted" once the user opts in. Loaded as an external file so the
// hosting CSP can drop 'unsafe-inline' on script-src.
window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }
window.gtag = gtag;
gtag("consent", "default", {
  analytics_storage: "denied",
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  functionality_storage: "granted",
  security_storage: "granted",
});
gtag("js", new Date());
gtag("config", "G-7JTKQSCGPH");

// Meta Pixel + Consent.
// fbq('consent', 'revoke') queues events instead of sending them; the banner
// flushes the queue via fbq('consent', 'grant') once Marketing is opted in.
(function (f, b, e, v, n, t, s) {
  if (f.fbq) return;
  n = f.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!f._fbq) f._fbq = n;
  n.push = n;
  n.loaded = !0;
  n.version = "2.0";
  n.queue = [];
  t = b.createElement(e);
  t.async = !0;
  t.src = v;
  s = b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t, s);
})(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
fbq("consent", "revoke");
fbq("init", "1292774496305674");
fbq("track", "PageView");
