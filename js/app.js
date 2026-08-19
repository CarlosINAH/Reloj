/* ============================================================================
   app.js — Orquestación: estado, efemérides en vivo, cálculo de carta natal,
   geocoding, control de tiempo real, interacción y tooltips.
   ========================================================================== */
(function () {
  'use strict';

  // Verifica que las librerías se hayan cargado (soporte offline / file://).
  if (!window.THREE || !window.Astronomy) {
    var e = document.getElementById('lib-error');
    if (e) {
      e.style.display = 'block';
      e.innerHTML = '<h2>No se pudieron cargar las librerías locales.</h2>' +
        '<p>Falta ' + (!window.THREE ? 'Three.js' : '') +
        (!window.THREE && !window.Astronomy ? ' y ' : '') +
        (!window.Astronomy ? 'Astronomy Engine' : '') + '.</p>' +
        '<p>Asegúrate de abrir <b>index.html</b> junto a la carpeta <b>vendor/</b>.</p>';
    }
    return;
  }

  var $ = function (id) { return document.getElementById(id); };
  var n360 = Astro.n360;

  // ------------------------------- Estado -------------------------------
  var state = {
    mode: 'transit',
    houseSystem: 'placidus',
    simTime: new Date(),
    playing: false,
    speed: 'realtime',     // realtime | hour | day | week | month
    natal: null            // { positions, retro, houses, meta }
  };
  var transit = { positions: {}, retro: {}, speed: {} };
  var lastTransitNatalSpecs = [];
  var tooltipPinned = false;

  // --------------------------- Cálculo tránsito -------------------------
  function computeTransit(date) {
    var pos = {}, retro = {}, spd = {};
    Astro.BODIES.forEach(function (b) {
      pos[b] = Astro.geoLon(b, date);
      retro[b] = Astro.isRetro(b, date);
      spd[b] = Astro.speed(b, date);
    });
    return { positions: pos, retro: retro, speed: spd };
  }

  function signLabel(lon) {
    var s = Data.SIGNS[Astro.signIndex(lon)];
    return s.glyph + ' ' + Astro.formatDMS(lon).text + ' ' + s.name;
  }

  function esc(s) { return (s || '').replace(/"/g, '&quot;'); }

  // --------------------- Tabla de efemérides (panel izq) ----------------
  function refreshEphemerisTable() {
    var tbody = $('transit-tbody');
    var rows = '';
    var cusps = state.natal ? state.natal.houses.cusps : null;
    Astro.BODIES.forEach(function (b) {
      var lon = transit.positions[b];
      var s = Data.SIGNS[Astro.signIndex(lon)];
      var dms = Astro.formatDMS(lon);
      var house = cusps ? Astro.houseOf(lon, cusps) : null;
      var retro = transit.retro[b];
      var tip = esc(Data.interpretTransit(b, s.name, house));
      rows += '<tr title="' + tip + '">' +
        '<td><strong>' + Data.planetGlyph(b) + ' ' + b + '</strong></td>' +
        '<td>' + s.glyph + ' ' + dms.d + '°' + String(dms.m).padStart(2, '0') + "' <small>" + s.name + '</small></td>' +
        '<td>' + (house ? 'C' + house : '—') + '</td>' +
        '<td class="' + (retro ? 'retro' : 'direct') + '">' + (retro ? 'Rx' : 'D') + '</td>' +
        '</tr>';
    });
    tbody.innerHTML = rows;
  }

  // ----------------------- Cálculo de carta natal -----------------------
  function tzOffsetMinutes(date, timeZone) {
    var dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit',
      day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    var parts = {};
    dtf.formatToParts(date).forEach(function (p) { parts[p.type] = p.value; });
    var asUTC = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    return (asUTC - date.getTime()) / 60000; // minutos al este de UTC
  }

  function birthToUTC(dateStr, timeStr) {
    var dp = dateStr.split('-').map(Number);
    var tp = (timeStr || '12:00').split(':').map(Number);
    var y = dp[0], mo = dp[1], d = dp[2], h = tp[0] || 0, mi = tp[1] || 0;
    var tz = $('natal-tz').value.trim();
    if (tz) {
      // Convierte hora local del huso a UTC (respeta DST histórico vía Intl).
      var guess = Date.UTC(y, mo - 1, d, h, mi);
      var off = tzOffsetMinutes(new Date(guess), tz);
      return new Date(guess - off * 60000);
    }
    var offH = parseFloat($('natal-offset').value) || 0;
    return new Date(Date.UTC(y, mo - 1, d, h, mi) - offH * 3600000);
  }

  function onCalculate() {
    var dateVal = $('natal-date').value;
    var timeVal = $('natal-time').value;
    var lat = parseFloat($('natal-lat').value);
    var lon = parseFloat($('natal-lon').value);
    if (!dateVal || isNaN(lat) || isNaN(lon)) {
      toast('Completa fecha, latitud y longitud.');
      return;
    }
    var birthUTC = birthToUTC(dateVal, timeVal);
    if (isNaN(birthUTC.getTime())) { toast('Fecha u hora inválida.'); return; }

    var natalT = computeTransit(birthUTC);
    var houses = Astro.houses(state.houseSystem, birthUTC, lon, lat);

    state.natal = {
      positions: natalT.positions,
      retro: natalT.retro,
      speed: natalT.speed,
      houses: houses,
      meta: { date: birthUTC, lat: lat, lon: lon }
    };

    renderNatalGrid();
    Scene.setNatalMarkers(natalT.positions);
    Scene.setHouses(houses);
    applyViewMode();
    refreshEphemerisTable();
    saveInputs();
    toast('Carta natal calculada · ' + systemName(state.houseSystem), true);
  }

  // ------------------- Persistencia y enlace para compartir -------------
  var FIELDS = ['natal-date', 'natal-time', 'natal-lat', 'natal-lon', 'natal-tz', 'natal-offset'];

  function collectInputs() {
    var o = { hs: state.houseSystem };
    FIELDS.forEach(function (id) { o[id] = $(id).value; });
    var city = $('geo-search').value.trim();
    if (city) o.city = city;
    return o;
  }

  function saveInputs() {
    var o = collectInputs();
    try { localStorage.setItem('reloj-natal', JSON.stringify(o)); } catch (e) {}
    // Actualiza la URL para poder compartir la carta (sin recargar).
    var params = new URLSearchParams();
    Object.keys(o).forEach(function (k) { if (o[k] !== '' && o[k] != null) params.set(k, o[k]); });
    try { history.replaceState(null, '', location.pathname + '?' + params.toString()); } catch (e) {}
  }

  // Lee de la URL (prioridad) o de localStorage. Devuelve true si aplicó datos.
  function loadInputs() {
    var src = null;
    var qs = new URLSearchParams(location.search);
    if (qs.toString()) {
      src = {}; qs.forEach(function (v, k) { src[k] = v; });
    } else {
      try { src = JSON.parse(localStorage.getItem('reloj-natal') || 'null'); } catch (e) { src = null; }
    }
    if (!src) return false;
    FIELDS.forEach(function (id) { if (src[id] != null && src[id] !== '') $(id).value = src[id]; });
    if (src.city) $('geo-search').value = src.city;
    if (src.hs) { state.houseSystem = src.hs; $('house-system').value = src.hs; }
    return true;
  }

  function shareLink() {
    saveInputs();
    var url = location.href;
    var done = function () { toast('Enlace copiado al portapapeles ✓', true); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () { toast('Copia el enlace desde la barra del navegador.'); });
    } else {
      toast('Copia el enlace desde la barra del navegador.');
    }
  }

  function systemName(s) {
    return { placidus: 'Placidus', koch: 'Koch', porphyry: 'Porphyry',
             equal: 'Casas Iguales', whole: 'Signo Completo' }[s] || s;
  }

  function renderNatalGrid() {
    var grid = $('natal-positions-container');
    var cusps = state.natal.houses.cusps;
    var html = '';
    Astro.BODIES.forEach(function (b) {
      var lon = state.natal.positions[b];
      var s = Data.SIGNS[Astro.signIndex(lon)];
      var dms = Astro.formatDMS(lon);
      var house = Astro.houseOf(lon, cusps);
      var retro = state.natal.retro[b] ? ' <span class="rx" style="color:#ff6b7a">℞</span>' : '';
      var tip = esc(Data.interpretNatal(b, s.name, house));
      html += '<div class="natal-item" title="' + tip + '"><span><strong>' + Data.planetGlyph(b) + ' ' + b + '</strong>' + retro + '</span>' +
        '<span>' + s.glyph + ' ' + dms.d + '°' + String(dms.m).padStart(2, '0') +
        "'<span class=\"h\"> C" + house + '</span></span></div>';
    });
    grid.innerHTML = html;

    // Ejes ASC / MC
    var asc = state.natal.houses.asc, mc = state.natal.houses.mc;
    $('natal-angles').innerHTML =
      '<div class="angle-chip"><b>ASC</b> ' + signLabelShort(asc) + '</div>' +
      '<div class="angle-chip mc"><b>MC</b> ' + signLabelShort(mc) + '</div>';
  }

  function signLabelShort(lon) {
    var s = Data.SIGNS[Astro.signIndex(lon)];
    var dms = Astro.formatDMS(lon);
    return s.glyph + ' ' + dms.d + '°' + String(dms.m).padStart(2, '0') + "'";
  }

  // ---------------- Panel de aspectos (según el modo de vista) ----------
  // En modo tránsito: aspectos Tránsito → Natal y qué casa natal activan.
  // En modo natal: aspectos internos de la carta natal.
  function rebuildAspects() {
    var container = $('transit-aspects-container');
    var titleEl = $('aspects-title');
    if (!state.natal) {
      if (titleEl) titleEl.textContent = 'Aspectos';
      container.innerHTML = '<div class="hint">Calcula tu carta natal para leer sus aspectos y los tránsitos que la activan.</div>';
      Scene.setAspectLines([]);
      return;
    }
    if (state.mode === 'natal') { buildNatalAspects(container, titleEl); }
    else { buildTransitAspects(container, titleEl); }

    // Interacción tarjeta ↔ línea 3D (en ambos modos las líneas existen).
    Array.prototype.forEach.call(container.querySelectorAll('.aspect-card'), function (card) {
      var id = card.getAttribute('data-id');
      card.addEventListener('mouseenter', function () { card.classList.add('active-highlight'); Scene.highlightAspect(id, true); });
      card.addEventListener('mouseleave', function () { card.classList.remove('active-highlight'); Scene.highlightAspect(id, false); });
    });
  }

  function buildTransitAspects(container, titleEl) {
    if (titleEl) titleEl.textContent = 'Aspectos Tránsito → Natal';
    var filter = $('transit-filter').value;
    var slowSet = { 'Júpiter': 1, Saturno: 1, Urano: 1, Neptuno: 1, 'Plutón': 1 };
    var transitPlanets = Astro.BODIES.filter(function (p) { return filter === 'all' || slowSet[p]; });
    var tSet = {};
    transitPlanets.forEach(function (p) { tSet[p] = transit.positions[p]; });
    var aspects = Astro.findAspects(tSet, state.natal.positions, false);
    var cusps = state.natal.houses.cusps;
    var html = '', specs = [];
    aspects.forEach(function (asp, i) {
      var id = 'asp-' + i, tP = asp.a, nP = asp.b, t = asp.type;
      var house = Astro.houseOf(transit.positions[tP], cusps);
      var hInfo = Data.HOUSES[house];
      html += '<div class="aspect-card ' + t.cls + '" data-id="' + id + '">' +
        '<strong style="color:#ffe600;">' + Data.planetGlyph(tP) + ' ' + tP + ' TR</strong> ' +
        t.name + ' <strong>' + Data.planetGlyph(nP) + ' ' + nP + ' natal</strong>' +
        ' <span class="orb">(orbe ' + asp.orb.toFixed(1) + '°)</span>' +
        '<div class="hint" style="margin-top:3px">' + Data.interpretAspect(t.name, tP, nP, true) + '</div>' +
        '<div class="house-badge">Activa ' + (hInfo ? hInfo.name : 'Casa ' + house) + '</div>' +
        '</div>';
      specs.push({ id: id, a: tP, b: nP, kindA: 'transit', kindB: 'natal', color: t.color });
    });
    container.innerHTML = html || '<div class="hint">No hay aspectos mayores activos bajo este filtro.</div>';
    lastTransitNatalSpecs = specs;
    Scene.setAspectLines(specs);
  }

  function buildNatalAspects(container, titleEl) {
    if (titleEl) titleEl.textContent = 'Aspectos Natales';
    var aspects = Astro.findAspects(state.natal.positions, state.natal.positions, true);
    var cusps = state.natal.houses.cusps;
    var html = '', specs = [];
    aspects.forEach(function (asp, i) {
      var id = 'nat-' + i, aP = asp.a, bP = asp.b, t = asp.type;
      var ha = Astro.houseOf(state.natal.positions[aP], cusps);
      var hb = Astro.houseOf(state.natal.positions[bP], cusps);
      html += '<div class="aspect-card ' + t.cls + '" data-id="' + id + '">' +
        '<strong style="color:#00d4ff;">' + Data.planetGlyph(aP) + ' ' + aP + '</strong> ' +
        t.name + ' <strong>' + Data.planetGlyph(bP) + ' ' + bP + '</strong>' +
        ' <span class="orb">(orbe ' + asp.orb.toFixed(1) + '°)</span>' +
        '<div class="hint" style="margin-top:3px">' + Data.interpretAspect(t.name, aP, bP, false) + '</div>' +
        '<div class="house-badge">' + aP + ' C' + ha + ' · ' + bP + ' C' + hb + '</div>' +
        '</div>';
      specs.push({ id: id, a: aP, b: bP, kindA: 'transit', kindB: 'transit', color: t.color });
    });
    container.innerHTML = html || '<div class="hint">Sin aspectos mayores entre los planetas natales.</div>';
    Scene.setAspectLines(specs);
  }

  // --------------------------- Vista 3D ---------------------------------
  function applyViewMode() {
    if (state.mode === 'natal' && state.natal) {
      Scene.setTransitLongitudes(state.natal.positions, state.natal.retro);
      Scene.setNatalMarkersVisible(false);
    } else {
      Scene.setTransitLongitudes(transit.positions, transit.retro);
      Scene.setNatalMarkersVisible(!!state.natal);
    }
    rebuildAspects(); // reconstruye panel + líneas 3D acordes al modo
  }

  // --------------------------- Tiempo real ------------------------------
  var SPEED_DAYS = { realtime: 0, hour: 1 / 24, day: 1, week: 7, month: 30 };
  var lastTick = Date.now();
  var aspectTickCounter = 0;

  function tick() {
    var now = Date.now();
    var dtSec = (now - lastTick) / 1000;
    lastTick = now;

    if (state.mode === 'transit') {
      if (state.speed === 'realtime') {
        if (state.playing) state.simTime = new Date();
      } else if (state.playing) {
        state.simTime = new Date(state.simTime.getTime() + SPEED_DAYS[state.speed] * dtSec * 86400000);
      }
      if (state.playing) {
        transit = computeTransit(state.simTime);
        Scene.setTransitLongitudes(transit.positions, transit.retro);
        refreshEphemerisTable();
        // Reconstruir aspectos con menor frecuencia (cada ~1.5 s).
        if (++aspectTickCounter >= 8) { aspectTickCounter = 0; if (state.natal) rebuildAspects(); }
      }
    }
    updateClockReadout();
  }

  function updateClockReadout() {
    var d = state.simTime;
    var opts = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    var label = (state.mode === 'natal') ? 'Carta Natal fija' :
      (state.speed === 'realtime' && state.playing ? 'AHORA · ' : '') + d.toLocaleString('es', opts);
    $('sim-clock').textContent = label;
  }

  // --------------------------- Geocoding --------------------------------
  function doGeocode() {
    var q = $('geo-search').value.trim();
    if (!q) return;
    var results = $('geo-results');
    results.innerHTML = '<div class="geo-item">Buscando…</div>';
    results.classList.add('show');
    var url = 'https://geocoding-api.open-meteo.com/v1/search?count=6&language=es&format=json&name=' + encodeURIComponent(q);
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      if (!data.results || !data.results.length) { results.innerHTML = '<div class="geo-item">Sin resultados.</div>'; return; }
      results.innerHTML = '';
      data.results.forEach(function (city) {
        var el = document.createElement('div');
        el.className = 'geo-item';
        var admin = [city.admin1, city.country].filter(Boolean).join(', ');
        el.innerHTML = '<strong>' + city.name + '</strong><small>' + admin +
          ' · ' + city.latitude.toFixed(2) + ', ' + city.longitude.toFixed(2) +
          (city.timezone ? ' · ' + city.timezone : '') + '</small>';
        el.addEventListener('click', function () { pickCity(city); });
        results.appendChild(el);
      });
    }).catch(function () {
      results.innerHTML = '<div class="geo-item">Sin conexión: ingresa lat/lon manualmente.</div>';
    });
  }

  function pickCity(city) {
    $('natal-lat').value = city.latitude.toFixed(4);
    $('natal-lon').value = city.longitude.toFixed(4);
    if (city.timezone) {
      $('natal-tz').value = city.timezone;
      // Muestra el offset calculado para la fecha de nacimiento como referencia.
      try {
        var dv = $('natal-date').value || '2000-01-01';
        var off = tzOffsetMinutes(new Date(dv + 'T12:00:00Z'), city.timezone) / 60;
        $('natal-offset').value = off;
      } catch (e) {}
    }
    $('geo-city-label').textContent = city.name + ' (' + (city.timezone || 'offset manual') + ')';
    $('geo-results').classList.remove('show');
    $('geo-search').value = city.name;
  }

  // --------------------------- Tooltip ----------------------------------
  function describe(name, kind) {
    // En modo natal, las esferas (kind 'transit') muestran posiciones natales.
    var isNatal = (kind === 'natal') || (state.mode === 'natal' && !!state.natal);
    var lon = isNatal ? state.natal.positions[name] : transit.positions[name];
    var s = Data.SIGNS[Astro.signIndex(lon)];
    var dms = Astro.formatDMS(lon);
    var retro = isNatal ? state.natal.retro[name] : transit.retro[name];
    var cusps = state.natal ? state.natal.houses.cusps : null;
    var house = cusps ? Astro.houseOf(lon, cusps) : null;

    var meta = s.glyph + ' ' + dms.text + ' ' + s.name;
    if (house) meta += ' · Casa ' + house;
    var interp = isNatal ? Data.interpretNatal(name, s.name, house)
                         : Data.interpretTransit(name, s.name, house);
    return {
      title: Data.planetGlyph(name) + ' ' + name + (isNatal ? ' (natal)' : ' (tránsito)'),
      meta: meta, retro: retro, interp: interp
    };
  }

  function showTooltip(name, kind, x, y, pin) {
    if (kind === 'natal' && !state.natal) return;
    if (kind !== 'natal' && !transit.positions[name]) return;
    var info = describe(name, kind);
    var tip = $('tooltip');
    tip.innerHTML = (pin ? '<span class="close" id="tip-close">✕</span>' : '') +
      '<h4>' + info.title + (info.retro ? ' <span class="rx">℞ Retro</span>' : '') + '</h4>' +
      '<div class="meta">' + info.meta + '</div>' +
      '<div class="interp">' + info.interp + '</div>';
    tip.style.display = 'block';
    tip.classList.toggle('pinned', !!pin);
    var w = tip.offsetWidth, h = tip.offsetHeight;
    var px = Math.min(x + 16, window.innerWidth - w - 12);
    var py = Math.min(y + 16, window.innerHeight - h - 12);
    tip.style.left = px + 'px';
    tip.style.top = py + 'px';
    if (pin) {
      tooltipPinned = true;
      var c = $('tip-close');
      if (c) c.addEventListener('click', hideTooltip);
    }
  }

  function hideTooltip() { tooltipPinned = false; $('tooltip').style.display = 'none'; }

  function onHover(name, kind, x, y) {
    if (tooltipPinned) return;
    if (!name) { $('tooltip').style.display = 'none'; return; }
    showTooltip(name, kind, x, y, false);
  }

  function onSelect(name, kind, x, y) {
    if (!name) { hideTooltip(); return; }
    showTooltip(name, kind, x, y, true);
    Scene.focusPlanet(name);
  }

  // --------------------------- Utilidades UI ----------------------------
  var toastTimer;
  function toast(msg, ok) {
    var t = $('toast');
    t.textContent = msg;
    t.style.borderColor = ok ? 'rgba(0,212,255,0.5)' : 'rgba(255,60,90,0.5)';
    t.style.background = ok ? 'rgba(8,24,34,0.95)' : 'rgba(40,10,20,0.95)';
    t.style.color = ok ? '#bfe9ff' : '#ffd0d8';
    t.style.display = 'block';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.style.display = 'none'; }, 3200);
  }

  // ------------------------------ Wiring --------------------------------
  function init() {
    Scene.init($('canvas-container'), { onHover: onHover, onSelect: onSelect });

    transit = computeTransit(state.simTime);
    Scene.setTransitLongitudes(transit.positions, transit.retro);
    refreshEphemerisTable();
    rebuildAspects();
    updateClockReadout();

    // Paneles colapsables
    Array.prototype.forEach.call(document.querySelectorAll('.panel-header'), function (h) {
      h.addEventListener('click', function () { h.parentElement.classList.toggle('collapsed'); });
    });

    $('btn-calculate').addEventListener('click', onCalculate);
    $('btn-share').addEventListener('click', shareLink);
    $('transit-filter').addEventListener('change', rebuildAspects);
    $('house-system').addEventListener('change', function () {
      state.houseSystem = $('house-system').value;
      if (state.natal) onCalculate();
    });

    $('view-mode-select').addEventListener('change', function () {
      state.mode = $('view-mode-select').value;
      applyViewMode();
      updateClockReadout();
    });

    $('btn-toggle-orbit').addEventListener('click', function () {
      state.playing = !state.playing;
      lastTick = Date.now();
      this.textContent = state.playing ? '⏸ Pausar' : '▶ Reproducir';
    });
    $('speed-select').addEventListener('change', function () { state.speed = this.value; });
    $('btn-now').addEventListener('click', function () {
      state.simTime = new Date();
      transit = computeTransit(state.simTime);
      refreshEphemerisTable();
      applyViewMode();
      updateClockReadout();
    });

    // Geocoding
    $('btn-geo').addEventListener('click', doGeocode);
    $('geo-search').addEventListener('keydown', function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); doGeocode(); } });
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.geo-wrap')) $('geo-results').classList.remove('show');
    });

    setInterval(tick, 200);

    // Restaura la última carta (URL para compartir, o localStorage) y calcúlala.
    if (loadInputs()) onCalculate();
  }

  init();
})();
