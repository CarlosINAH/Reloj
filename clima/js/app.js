/* ============================================================================
   app.js — Clima Astral en tiempo real. Sin carta natal, sin fechas:
   calcula el cielo de AHORA y sus aspectos, y los muestra en 3D + paneles.
   ========================================================================== */
(function () {
  'use strict';
  if (!window.THREE || !window.Astronomy) {
    document.getElementById('lib-error').style.display = 'block';
    return;
  }
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    simTime: new Date(),
    speed: 'realtime',       // realtime | hour | day | week
    focus: null,
    enabled: {}              // tipos de aspecto activados
  };
  Astro.ASPECT_TYPES.forEach(function (t) { state.enabled[t.name] = !t.minor; });

  var sky = { pos: {}, spd: {}, retro: {}, helio: {} };

  function compute(date) {
    var pos = {}, spd = {}, retro = {}, helio = {};
    Astro.BODIES.forEach(function (b) {
      pos[b] = Astro.geoLon(b, date);       // geocéntrico (para el clima/aspectos)
      spd[b] = Astro.speed(b, date);
      retro[b] = Astro.isRetro(b, date);
    });
    Astro.HELIO.forEach(function (b) { helio[b] = Astro.helioLon(b, date); }); // para el modelo 3D
    return { pos: pos, spd: spd, retro: retro, helio: helio };
  }

  function activeAspects() {
    var incMinor = Object.keys(state.enabled).some(function (k) {
      var t = Astro.ASPECT_TYPES.find(function (x) { return x.name === k; });
      return t && t.minor && state.enabled[k];
    });
    return Astro.findAspects(sky.pos, sky.spd, incMinor)
      .filter(function (a) { return state.enabled[a.type.name]; });
  }

  // --------------------------- Render UI --------------------------------
  function render() {
    var aspects = activeAspects();
    renderHeadline(aspects);
    renderAspectList(aspects);
    renderPlanets();
    renderChips(aspects);
    // Líneas 3D
    Scene.setAspectLines(aspects.map(function (a, i) {
      return { id: 'a' + i, a: a.a, b: a.b, color: a.type.color, minor: a.type.minor };
    }));
  }

  function renderHeadline(aspects) {
    var tense = 0, harm = 0, fus = 0;
    aspects.forEach(function (a) {
      var tone = Data.ASPECTS[a.type.name].tone;
      if (tone === 'tenso') tense++; else if (tone === 'armónico') harm++; else fus++;
    });
    var mood, cls;
    if (tense > harm + 1) { mood = 'Cielo tenso'; cls = 'tense'; }
    else if (harm > tense + 1) { mood = 'Cielo fluido'; cls = 'harm'; }
    else { mood = 'Cielo mixto'; cls = 'mix'; }
    var retros = Astro.BODIES.filter(function (b) { return sky.retro[b]; });
    var tip = aspects[0];
    $('headline').innerHTML =
      '<div class="mood ' + cls + '">' + mood + '</div>' +
      '<div class="mood-sub">' +
        harm + ' armónicos · ' + tense + ' tensos · ' + fus + ' conjunciones</div>' +
      (tip ? '<div class="mood-top">Lo más exacto ahora: <b>' + Data.glyph(tip.a) + ' ' + tip.a +
        ' ' + tip.type.sym + ' ' + Data.glyph(tip.b) + ' ' + tip.b + '</b> (' + tip.orb.toFixed(1) + '°)</div>' : '') +
      (retros.length ? '<div class="mood-retro">Retrógrados: ' + retros.map(function (r) { return Data.glyph(r) + ' ' + r; }).join(' · ') + '</div>' : '');
  }

  function renderAspectList(aspects) {
    var box = $('aspect-list');
    if (!aspects.length) { box.innerHTML = '<div class="hint">Sin aspectos de los tipos activados.</div>'; return; }
    box.innerHTML = aspects.map(function (a, i) {
      var t = a.type, tone = Data.ASPECTS[t.name].tone;
      var flow = a.applying === null ? '' : (a.applying
        ? '<span class="flow ap">↗ aplicando</span>' : '<span class="flow se">↘ separando</span>');
      var dim = state.focus && a.a !== state.focus && a.b !== state.focus ? ' dim' : '';
      return '<div class="asp ' + t.cls + dim + '" data-id="a' + i + '" data-a="' + a.a + '" data-b="' + a.b + '">' +
        '<div class="asp-head"><span class="asp-sym">' + t.sym + '</span> ' +
        '<b>' + Data.glyph(a.a) + ' ' + a.a + '</b> ' + t.name.toLowerCase() + ' <b>' + Data.glyph(a.b) + ' ' + a.b + '</b>' +
        ' <span class="orb">' + a.orb.toFixed(1) + '°</span> ' + flow + '</div>' +
        '<div class="asp-phrase tone-' + tone + '">' + Data.phrase(t.name, a.a, a.b) + '</div></div>';
    }).join('');
    Array.prototype.forEach.call(box.querySelectorAll('.asp'), function (card) {
      var id = card.getAttribute('data-id');
      card.addEventListener('mouseenter', function () { Scene.highlightAspect(id, true); });
      card.addEventListener('mouseleave', function () { Scene.highlightAspect(id, false); });
      card.addEventListener('click', function () { setFocus(card.getAttribute('data-a')); });
    });
  }

  function renderPlanets() {
    $('planet-list').innerHTML = Astro.BODIES.map(function (b) {
      var lon = sky.pos[b], s = Data.signOf(lon), dms = Astro.formatDMS(lon);
      var foc = state.focus === b ? ' foc' : '';
      return '<div class="prow' + foc + '" data-p="' + b + '" title="' + Data.PLANETS[b].kw + '">' +
        '<span><b>' + Data.glyph(b) + ' ' + b + '</b></span>' +
        '<span class="psign">' + s.glyph + ' ' + dms.d + '°' + String(dms.m).padStart(2, '0') + "' <small>" + s.name + '</small></span>' +
        '<span class="' + (sky.retro[b] ? 'rx' : 'dir') + '">' + (sky.retro[b] ? 'Rx' : 'D') + '</span></div>';
    }).join('');
    Array.prototype.forEach.call($('planet-list').querySelectorAll('.prow'), function (row) {
      row.addEventListener('click', function () { setFocus(row.getAttribute('data-p')); });
    });
  }

  function renderChips(aspects) {
    var counts = {};
    Astro.findAspects(sky.pos, sky.spd, true).forEach(function (a) {
      counts[a.type.name] = (counts[a.type.name] || 0) + 1;
    });
    $('chips').innerHTML = '';
    Astro.ASPECT_TYPES.forEach(function (t) {
      var n = counts[t.name] || 0, hex = '#' + t.color.toString(16).padStart(6, '0');
      var chip = document.createElement('div');
      chip.className = 'chip' + (state.enabled[t.name] ? ' on' : '') + (n === 0 ? ' z' : '');
      chip.style.color = hex;
      chip.innerHTML = '<span class="s">' + t.sym + '</span>' + t.name + '<span class="c">' + n + '</span>';
      chip.title = t.name + (t.minor ? ' (menor)' : '');
      chip.addEventListener('click', function () { state.enabled[t.name] = !state.enabled[t.name]; render(); });
      $('chips').appendChild(chip);
    });
  }

  function setFocus(name) {
    state.focus = (state.focus === name) ? null : name;
    Scene.setFocus(state.focus);
    $('focus-chip').style.display = state.focus ? 'inline-flex' : 'none';
    if (state.focus) $('focus-name').textContent = Data.glyph(state.focus) + ' ' + state.focus;
    render();
  }

  // --------------------------- Reloj / tiempo ---------------------------
  var SPEED_DAYS = { realtime: 0, hour: 1 / 24, day: 1, week: 7 };
  var lastTick = Date.now(), counter = 0;

  function tick() {
    var now = Date.now(), dt = (now - lastTick) / 1000; lastTick = now;
    if (state.speed === 'realtime') state.simTime = new Date();
    else state.simTime = new Date(state.simTime.getTime() + SPEED_DAYS[state.speed] * dt * 86400000);
    sky = compute(state.simTime);
    Scene.setPositions(sky.helio, sky.pos.Luna);
    // Paneles: refrescar cada ~1.5 s (son cálculos ligeros, pero evitamos parpadeo).
    if (++counter % 3 === 0 || state.speed !== 'realtime') render();
    updateClock();
  }

  function updateClock() {
    $('clock').textContent = (state.speed === 'realtime' ? 'EN VIVO · ' : '') +
      state.simTime.toLocaleString('es', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  // Tooltip 3D
  function onHover(name, x, y) {
    var tip = $('tooltip');
    if (!name) { tip.style.display = 'none'; return; }
    if (name === 'Tierra') {
      tip.innerHTML = '<h4>⊕ Tierra</h4><div class="kw">Desde aquí observamos el cielo: el clima astral se mide visto desde la Tierra (geocéntrico).</div>';
    } else {
      var lon = sky.pos[name], s = Data.signOf(lon), dms = Astro.formatDMS(lon);
      tip.innerHTML = '<h4>' + Data.glyph(name) + ' ' + name + (sky.retro[name] ? ' <span class="rx">℞</span>' : '') + '</h4>' +
        '<div class="meta">' + s.glyph + ' ' + dms.text + ' ' + s.name + '</div>' +
        '<div class="kw">' + Data.PLANETS[name].kw + '</div>';
    }
    tip.style.display = 'block';
    tip.style.left = Math.min(x + 16, innerWidth - tip.offsetWidth - 12) + 'px';
    tip.style.top = Math.min(y + 16, innerHeight - tip.offsetHeight - 12) + 'px';
  }
  function onSelect(name) { setFocus(name === 'Tierra' ? null : name); }

  function init() {
    Scene.init($('canvas-container'), { onHover: onHover, onSelect: onSelect });
    sky = compute(state.simTime);
    Scene.setPositions(sky.helio, sky.pos.Luna);
    render(); updateClock();

    $('cam-select').addEventListener('change', function () { Scene.setCameraMode(this.value); });
    $('speed-select').addEventListener('change', function () { state.speed = this.value; lastTick = Date.now(); });
    $('focus-chip').addEventListener('click', function () { setFocus(state.focus); });
    Array.prototype.forEach.call(document.querySelectorAll('.panel-header'), function (h) {
      h.addEventListener('click', function () { h.parentElement.classList.toggle('collapsed'); });
    });
    if (innerWidth < 760) {
      Array.prototype.forEach.call(document.querySelectorAll('.ui-window'), function (w) { w.classList.add('collapsed'); });
    }
    setInterval(tick, 500);
  }
  init();
})();
