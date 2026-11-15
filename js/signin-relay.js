// The sign-in comes back to /entrar/ (?code=…, or an error, sometimes in the #fragment).
// Hand it to the app at grotesk://auth, then tidy the address bar. Nothing is sent anywhere else.
// Only the keys of the PKCE code flow are passed on: a link carrying someone else's tokens
// (#access_token=…) must never reach the app as if it were this sign-in.
(function () {
  var KEYS = ['code', 'state', 'error', 'error_code', 'error_description'];
  var search = new URLSearchParams(location.search);
  var hash = new URLSearchParams(location.hash.slice(1));
  var params = new URLSearchParams();
  KEYS.forEach(function (key) {
    var value = search.has(key) ? search.get(key) : hash.get(key);
    if (value !== null) params.set(key, value);
  });

  var query = params.toString();
  var target = 'grotesk://auth' + (query ? '?' + query : '');
  var title = document.getElementById('title');
  var detail = document.getElementById('detail');
  document.getElementById('open').href = target;

  if (params.has('error') || params.has('error_code') || params.has('error_description')) {
    title.textContent = "Couldn't sign you in.";
    detail.textContent = 'Go back to Grotesk and try again.';
  } else if (!params.has('code')) {
    // opened by hand, not by a sign-in: don't claim one happened
    title.textContent = 'Sign in from Grotesk.';
    detail.textContent = 'Open the app to start signing in.';
  }

  history.replaceState(null, '', location.pathname);
  if (query) location.href = target;
})();
