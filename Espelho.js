// ===== ESPELHO DE PONTO — arquivo separado =====
(function() {
  function getDayKey(date) {
    var d = new Date(date);
    return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
  }

  function buildDayMap() {
    var map = {};
    try {
      var h = JSON.parse(localStorage.getItem('med_history') || '[]');
      h.forEach(function(item) {
        if (!item || !item.timestamp) return;
        var k = getDayKey(item.timestamp);
        map[k] = (map[k] || 0) + (item.amount || 0);
      });
    } catch(e) {}
    return map;
  }

  function renderMirror() {
    var grid = document.getElementById('mirrorGrid');
    if (!grid) return;

    var stock = parseInt(localStorage.getItem('med_stock') || 30);
    var dailyDose = parseInt(localStorage.getItem('med_dailyDose') || 2);
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth();
    var firstDay = new Date(year, month, 1).getDay();
    var daysInMonth = new Date(year, month + 1, 0).getDate();
    var today = now.getDate();
    var dayMap = buildDayMap();
    var expected = dailyDose > 0 ? dailyDose : 1;

    var html = '';
    for (var i = 0; i < firstDay; i++) html += '<div class="mirror-day empty"></div>';

    for (var d = 1; d <= daysInMonth; d++) {
      var key = year + '-' + (month+1) + '-' + d;
      var count = dayMap[key] || 0;
      var classes = 'mirror-day';
      var content = '<span class="day-num">' + d + '</span>';

      if (d > today) {
        classes += ' future';
      } else if (d === today) {
        classes += ' today';
        if (count > 0) {
          classes += count >= expected * 1.5 ? ' registered-heavy' : ' registered';
          content += '<span class="day-count">' + count + '</span>';
        }
      } else {
        if (count === 0) classes += ' missed';
        else {
          classes += count >= expected * 1.5 ? ' registered-heavy' : ' registered';
          content += '<span class="day-count">' + count + '</span>';
        }
      }

      html += '<div class="' + classes + '" onclick="window.__openDayModal(\'' + key + '\',' + d + ')">' + content + '</div>';
    }
    grid.innerHTML = html;
  }

  window.__openDayModal = function(dayKey, dayNum) {
    var parts = dayKey.split('-');
    var d = new Date(parts[0], parts[1]-1, parts[2]);
    if (d > new Date()) return;
    if (navigator.vibrate) navigator.vibrate(15);

    var old = document.getElementById('dayModal');
    if (old) old.remove();

    var dayMap = buildDayMap();
    var current = dayMap[dayKey] || 0;
    var dayStr = d.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });

    var modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'dayModal';
    modal.onclick = function(e) { if (e.target === modal) modal.remove(); };

    modal.innerHTML = '<div class="modal-box">' +
      '<div class="modal-title">📝 ' + dayStr + '</div>' +
      '<div class="modal-sub">Registrado: <b style="color:#c084fc;">' + current + ' CP</b> — Quantos você tomou?</div>' +
      '<div class="modal-doses">' +
        '<button class="modal-btn" onclick="window.__registerForDay(\'' + dayKey + '\',1)">+1</button>' +
        '<button class="modal-btn" onclick="window.__registerForDay(\'' + dayKey + '\',2)">+2</button>' +
        '<button class="modal-btn" onclick="window.__registerForDay(\'' + dayKey + '\',3)">+3</button>' +
        '<button class="modal-btn" onclick="window.__registerForDay(\'' + dayKey + '\',4)">+4</button>' +
        '<button class="modal-btn" onclick="window.__registerForDay(\'' + dayKey + '\',6)">+6</button>' +
        '<button class="modal-btn primary" onclick="window.__registerCustomForDay(\'' + dayKey + '\')">Outro</button>' +
      '</div>' +
      (current > 0 ? '<button class="modal-btn" style="width:100%;background:#7f1d1d;border-color:#dc2626;color:#fca5a5;" onclick="window.__clearDay(\'' + dayKey + '\')">🗑 Limpar esse dia</button>' : '') +
      '<button class="modal-btn" style="width:100%;margin-top:8px;background:transparent;border:1px solid #4c1d95;" onclick="document.getElementById(\'dayModal\').remove()">Fechar</button>' +
    '</div>';
    document.body.appendChild(modal);
  };

  window.__registerForDay = function(dayKey, amount) {
    var parts = dayKey.split('-');
    var d = new Date(parts[0], parts[1]-1, parts[2]);
    d.setHours(12, 0, 0, 0);

    var stock = parseInt(localStorage.getItem('med_stock') || 30);
    if (amount > stock) { alert('Estoque insuficiente! Você tem ' + stock + ' CP.'); return; }
    stock -= amount;
    localStorage.setItem('med_stock', stock);

    var history = [];
    try { history = JSON.parse(localStorage.getItem('med_history') || '[]'); } catch(e) {}
    history.unshift({ amount: amount, timestamp: d.toISOString() });
    localStorage.setItem('med_history', JSON.stringify(history));

    if (navigator.vibrate) navigator.vibrate([25, 20, 25]);

    var modal = document.getElementById('dayModal');
    if (modal) modal.remove();

    if (typeof window.updateUI === 'function') window.updateUI();
    else location.reload();
  };

  window.__registerCustomForDay = function(dayKey) {
    var v = prompt('Quantos comprimidos?');
    v = parseInt(v);
    if (!v || v <= 0) return;
    window.__registerForDay(dayKey, v);
  };

  window.__clearDay = function(dayKey) {
    if (!confirm('Apagar todos os registros desse dia?')) return;
    var history = [];
    try { history = JSON.parse(localStorage.getItem('med_history') || '[]'); } catch(e) {}
    var removed = 0;
    var kept = history.filter(function(item) {
      if (getDayKey(item.timestamp) === dayKey) { removed += item.amount || 0; return false; }
      return true;
    });
    localStorage.setItem('med_history', JSON.stringify(kept));
    var stock = parseInt(localStorage.getItem('med_stock') || 30);
    localStorage.setItem('med_stock', stock + removed);

    var modal = document.getElementById('dayModal');
    if (modal) modal.remove();
    if (typeof window.updateUI === 'function') window.updateUI();
    else location.reload();
  };

  // Expõe globalmente para o index chamar
  window.renderMirror = renderMirror;

  // Re-renderiza sempre que o updateUI do index rodar
  var origUpdateUI = null;
  window.addEventListener('DOMContentLoaded', function() {
    if (typeof window.updateUI === 'function') {
      origUpdateUI = window.updateUI;
      window.updateUI = function() {
        origUpdateUI.apply(this, arguments);
        renderMirror();
      };
    }
    renderMirror();
  });
})();
