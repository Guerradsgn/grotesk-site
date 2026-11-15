// The invite: the moth's stroke only travels while the button is on screen.
(function () {
  var invite = document.querySelector('.invite');
  if (!invite) return;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) { invite.classList.toggle('live', en[0].isIntersecting); }).observe(invite);
  } else invite.classList.add('live');
})();
