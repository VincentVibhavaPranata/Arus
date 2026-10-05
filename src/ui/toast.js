/* ============================ TOAST ============================ */
var toastN = 0;

export function toast(msg, opt) {
  opt = opt || {};
  var host = document.getElementById('toasts');
  var el = document.createElement('div');
  el.className = 'toast';
  el.dataset.tid = ++toastN;
  var m = document.createElement('span');
  m.className = 'msg';
  m.textContent = msg;
  el.appendChild(m);
  var timer;
  function close() {
    if (!el.parentNode) return;
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
  }
  if (opt.actionLabel) {
    var b = document.createElement('button');
    b.className = 'act';
    b.textContent = opt.actionLabel;
    b.addEventListener('click', function () { close(); opt.action && opt.action(); });
    el.appendChild(b);
  }
  host.appendChild(el);
  timer = setTimeout(close, opt.ms || (opt.actionLabel ? 6500 : 3000));
  return el;
}
