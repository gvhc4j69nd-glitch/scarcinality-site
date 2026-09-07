/* Moved: the like control now ships with the share control in actions.js.
   This shim only exists so pages cached before the change keep working. */
(function () {
  if (window.__scarcActions) return;
  var s = document.createElement('script');
  s.src = '/assets/actions.js';
  s.defer = true;
  document.head.appendChild(s);
})();
