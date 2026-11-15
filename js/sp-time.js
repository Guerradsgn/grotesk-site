// The time in São Paulo, where Grotesk is made ("3:29pm", as on euguerra.com).
(function () {
  var time = document.getElementById('sp-time'), fmt;
  if (!time) return;
  try {
    fmt = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/Sao_Paulo' });
  } catch (e) { return; }
  function tick() {
    var now = new Date();
    time.textContent = fmt.format(now).replace(/\s/g, '').toLowerCase();
    time.setAttribute('datetime', now.toISOString());
  }
  tick();
  setInterval(tick, 15000);
})();
