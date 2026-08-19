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
  // Siempre es una bi-rueda: tránsito (esferas en movimiento) + natal (fijo).
  var state = {
    houseSystem: 'placidus',
    simTime: new Date(),
    playing: false,
    speed: 'realtime',     // realtime | hour | day | week | month
    aspectScope: 'natal',  // natal | transit  (panel de aspectos)
    natal: null            // { positions, retro, houses, meta }
  };
  var transit = { positions: {}, retro: {}, speed: {} };
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
    if (!dateVal) { toast('Ingresa tu fecha de nacimiento.'); return; }
    if (isNaN(lat) || isNaN(lon)) { toast('Elige tu lugar de nacimiento en el buscador.'); return; }
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
    updateSunHub();
    renderHousesSummary();
    Scene.setNatalMarkers(natalT.positions);
    Scene.setHouses(houses);
    refreshScene();
    refreshEphemerisTable();
    saveInputs();
    toast('Carta natal calculada · ' + systemName(state.houseSystem), true);
  }

  // ------------------- Persistencia y enlace para compartir -------------
  var FIELDS = ['natal-date', 'natal-time', 'natal-lat', 'natal-lon', 'natal-tz', 'natal-offset'];

  function collectInputs() {
    var o = { hs: state.houseSystem };
    FIELDS.forEach(function (id) { o[id] = $(id).value; });
    var place = $('place-search').value.trim();
    if (place) o.place = place;
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
    if (src.place) $('place-search').value = src.place;
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

  // Signo solar del consultante en el centro de la carta, con luz y sombra.
  function updateSunHub() {
    var hub = $('center-hub');
    if (!state.natal) { hub.style.display = 'none'; return; }
    var lon = state.natal.positions['Sol'];
    var s = Data.SIGNS[Astro.signIndex(lon)];
    var dms = Astro.formatDMS(lon);
    hub.innerHTML =
      '<div class="glyph" style="color:' + s.color + '">' + s.glyph + '</div>' +
      '<div class="sun-name">Sol en ' + s.name + '</div>' +
      '<div class="sun-sub">' + dms.d + '° · ' + s.element + ' ' + s.quality + '</div>' +
      '<div class="ls"><span><b>Luz:</b> ' + s.light + '.</span><br>' +
      '<span class="sh"><b>Sombra:</b> ' + s.shadow + '.</span></div>';
    hub.style.display = 'block';
  }

  // ---------------- Panel de aspectos (según el modo de vista) ----------
  // En modo tránsito: aspectos Tránsito → Natal y qué casa natal activan.
  // En modo natal: aspectos internos de la carta natal.
  // Tipos de aspecto activados por el usuario (clic en los chips).
  var aspectEnabled = {};
  Astro.ASPECT_TYPES.forEach(function (t) { aspectEnabled[t.name] = !t.minor; }); // mayores on, menores off

  // Calcula todos los aspectos del ámbito actual (mayores + menores).
  function computeScopeAspects() {
    if (!state.natal) return [];
    if (state.aspectScope === 'transit') {
      var tSet = {};
      Astro.BODIES.forEach(function (p) { tSet[p] = transit.positions[p]; });
      return Astro.findAspects(tSet, state.natal.positions, false, true);
    }
    return Astro.findAspects(state.natal.positions, state.natal.positions, true, true);
  }

  function rebuildAspects() {
    var container = $('transit-aspects-container');
    var titleEl = $('aspects-title');
    var chipsEl = $('aspect-chips');
    if (!state.natal) {
      if (titleEl) titleEl.textContent = 'Aspectos';
      chipsEl.innerHTML = '';
      container.innerHTML = '<div class="hint">Calcula tu carta para ver sus aspectos.</div>';
      Scene.setAspectLines([]);
      return;
    }
    var isTransit = state.aspectScope === 'transit';
    if (titleEl) titleEl.textContent = isTransit ? 'Tránsito → Natal' : 'Aspectos natales';

    var all = computeScopeAspects();

    // Conteo por tipo para los chips.
    var counts = {};
    all.forEach(function (a) { counts[a.type.name] = (counts[a.type.name] || 0) + 1; });
    renderAspectChips(chipsEl, counts);

    // Filtra por tipos activados.
    var shown = all.filter(function (a) { return aspectEnabled[a.type.name]; });
    var cusps = state.natal.houses.cusps;
    var html = '', specs = [];
    shown.forEach(function (asp, i) {
      var id = 'asp-' + i, t = asp.type;
      var card, spec;
      if (isTransit) {
        var tP = asp.a, nP = asp.b;
        var house = Astro.houseOf(transit.positions[tP], cusps);
        card = '<div class="aspect-card ' + t.cls + '" data-id="' + id + '">' +
          '<strong style="color:#ffe600;">' + t.sym + ' ' + Data.planetGlyph(tP) + ' ' + tP + ' TR</strong> ' +
          t.name + ' <strong>' + Data.planetGlyph(nP) + ' ' + nP + '</strong>' +
          ' <span class="orb">(' + asp.orb.toFixed(1) + '°)</span>' +
          '<div class="hint" style="margin-top:3px">' + Data.interpretAspect(t.name, tP, nP, true) + '</div>' +
          '<div class="house-badge">Activa Casa ' + house + '</div></div>';
        spec = { id: id, a: tP, b: nP, kindA: 'transit', kindB: 'natal', color: t.color, minor: t.minor };
      } else {
        var aP = asp.a, bP = asp.b;
        var ha = Astro.houseOf(state.natal.positions[aP], cusps);
        var hb = Astro.houseOf(state.natal.positions[bP], cusps);
        card = '<div class="aspect-card ' + t.cls + '" data-id="' + id + '">' +
          '<strong style="color:#00d4ff;">' + t.sym + ' ' + Data.planetGlyph(aP) + ' ' + aP + '</strong> ' +
          t.name + ' <strong>' + Data.planetGlyph(bP) + ' ' + bP + '</strong>' +
          ' <span class="orb">(' + asp.orb.toFixed(1) + '°)</span>' +
          '<div class="hint" style="margin-top:3px">' + Data.interpretAspect(t.name, aP, bP, false) + '</div>' +
          '<div class="house-badge">' + aP + ' C' + ha + ' · ' + bP + ' C' + hb + '</div></div>';
        spec = { id: id, a: aP, b: bP, kindA: 'natal', kindB: 'natal', color: t.color, minor: t.minor };
      }
      html += card; specs.push(spec);
    });
    container.innerHTML = html || '<div class="hint">Ningún aspecto de los tipos activados. Activa más símbolos arriba.</div>';
    Scene.setAspectLines(specs);

    Array.prototype.forEach.call(container.querySelectorAll('.aspect-card'), function (card) {
      var id = card.getAttribute('data-id');
      card.addEventListener('mouseenter', function () { card.classList.add('active-highlight'); Scene.highlightAspect(id, true); });
      card.addEventListener('mouseleave', function () { card.classList.remove('active-highlight'); Scene.highlightAspect(id, false); });
    });
  }

  // Chips clicables por tipo de aspecto (símbolo + conteo).
  function renderAspectChips(el, counts) {
    el.innerHTML = '';
    Astro.ASPECT_TYPES.forEach(function (t) {
      var n = counts[t.name] || 0;
      var chip = document.createElement('div');
      var hex = '#' + t.color.toString(16).padStart(6, '0');
      chip.className = 'aspect-chip' + (aspectEnabled[t.name] ? ' on' : '') + (n === 0 ? ' dim' : '');
      chip.style.color = hex;
      chip.title = t.name + (t.minor ? ' (menor)' : '');
      chip.innerHTML = '<span class="sym">' + t.sym + '</span>' +
        '<span style="color:#dfe4f2">' + t.name + '</span><span class="cnt">' + n + '</span>';
      chip.addEventListener('click', function () {
        aspectEnabled[t.name] = !aspectEnabled[t.name];
        rebuildAspects();
      });
      el.appendChild(chip);
    });
  }

  // ---------------- Resumen de casas (signo + planetas) ------------------
  function renderHousesSummary() {
    var box = $('houses-summary');
    if (!state.natal) { box.innerHTML = '<div class="hint">Calcula tu carta para ver las 12 casas.</div>'; return; }
    var cusps = state.natal.houses.cusps;
    // Planetas en cada casa.
    var inHouse = {};
    Astro.BODIES.forEach(function (b) {
      var h = Astro.houseOf(state.natal.positions[b], cusps);
      (inHouse[h] = inHouse[h] || []).push(Data.planetGlyph(b));
    });
    var html = '';
    for (var i = 0; i < 12; i++) {
      var num = i + 1;
      var s = Data.SIGNS[Astro.signIndex(cusps[i])];
      var angle = (i === 0 || i === 3 || i === 6 || i === 9) ? ' angle' : '';
      var plns = (inHouse[num] || []).join(' ');
      html += '<div class="house-row' + angle + '">' +
        '<span class="hn">C' + num + '</span>' +
        '<span class="sign">' + s.glyph + ' ' + s.name + '</span>' +
        '<span class="plns" style="color:#ffe066">' + plns + '</span></div>';
    }
    box.innerHTML = html;
  }

  // -------- Bi-rueda: tránsito (móvil) + natal (fijo), siempre juntos -----
  function refreshScene() {
    Scene.setTransitLongitudes(transit.positions, transit.retro);
    Scene.setNatalMarkersVisible(!!state.natal);
    rebuildAspects(); // reconstruye panel + líneas 3D
  }

  // --------------------------- Tiempo real ------------------------------
  var SPEED_DAYS = { realtime: 0, hour: 1 / 24, day: 1, week: 7, month: 30 };
  var lastTick = Date.now();
  var aspectTickCounter = 0;

  function tick() {
    var now = Date.now();
    var dtSec = (now - lastTick) / 1000;
    lastTick = now;

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
    updateClockReadout();
  }

  function updateClockReadout() {
    var d = state.simTime;
    var opts = { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' };
    var label = (state.speed === 'realtime' && state.playing ? 'AHORA · ' : '') + d.toLocaleString('es', opts);
    $('sim-clock').textContent = label;
  }

  // ----------------- Buscador de lugar (integrado + online) -------------
  var placeTimer = null;

  function renderPlaceResults(list, online) {
    var box = $('place-results');
    if (!list.length) { box.classList.remove('show'); box.innerHTML = ''; return; }
    box.innerHTML = '';
    list.forEach(function (c) {
      var el = document.createElement('div');
      el.className = 'geo-item';
      el.innerHTML = '<strong>' + c.name + '</strong><small>' + (c.region || '') + '</small>';
      el.addEventListener('click', function () { pickPlace(c); });
      box.appendChild(el);
    });
    if (online) {
      var tag = document.createElement('div');
      tag.className = 'geo-item'; tag.style.color = '#8895b5'; tag.style.cursor = 'default';
      tag.innerHTML = '<small>Buscando más ciudades en línea…</small>';
      box.appendChild(tag);
    }
    box.classList.add('show');
  }

  function doPlaceSearch() {
    var q = $('place-search').value.trim();
    if (q.length < 2) { $('place-results').classList.remove('show'); return; }
    var local = Cities.search(q, 8);
    renderPlaceResults(local, true);
    // Complemento en línea (si hay conexión); si falla, se queda con la lista local.
    var url = 'https://geocoding-api.open-meteo.com/v1/search?count=6&language=es&format=json&name=' + encodeURIComponent(q);
    fetch(url).then(function (r) { return r.json(); }).then(function (data) {
      var extra = (data.results || []).map(function (c) {
        return { name: c.name, region: [c.admin1, c.country].filter(Boolean).join(', '),
                 lat: c.latitude, lon: c.longitude, tz: c.timezone };
      }).filter(function (c) {
        return !local.some(function (l) { return l.name === c.name && l.region === c.region; });
      });
      renderPlaceResults(local.concat(extra), false);
    }).catch(function () { renderPlaceResults(local, false); });
  }

  function pickPlace(c) {
    $('natal-lat').value = c.lat;
    $('natal-lon').value = c.lon;
    $('natal-tz').value = c.tz || '';
    try {
      if (c.tz) {
        var dv = $('natal-date').value || '2000-01-01';
        $('natal-offset').value = tzOffsetMinutes(new Date(dv + 'T12:00:00Z'), c.tz) / 60;
      }
    } catch (e) {}
    $('place-search').value = c.name;
    $('place-results').classList.remove('show');
  }

  // Aplica el lugar por defecto (Ciudad de México) sin calcular nada aún.
  function applyDefaultPlace() {
    var c = Cities.byName(Cities.DEFAULT);
    if (c) { pickPlace(c); }
  }

  // --------------------------- Tooltip ----------------------------------
  function describe(name, kind) {
    // Bi-rueda: las esferas son tránsito; los marcadores fijos son natales.
    var isNatal = (kind === 'natal');
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
    Scene.attachHub($('center-hub'));

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
    $('aspect-scope').addEventListener('change', function () {
      state.aspectScope = this.value;
      rebuildAspects();
    });
    $('house-system').addEventListener('change', function () {
      state.houseSystem = $('house-system').value;
      if (state.natal) onCalculate();
    });

    // Ángulo de cámara (Carta cenital / 3D)
    $('view-mode-select').addEventListener('change', function () {
      Scene.setCameraMode(this.value);
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
      refreshScene();
      updateClockReadout();
    });

    // Buscador de lugar (integrado + online)
    $('place-search').addEventListener('input', function () {
      clearTimeout(placeTimer);
      placeTimer = setTimeout(doPlaceSearch, 220);
    });
    $('place-search').addEventListener('focus', doPlaceSearch);
    document.addEventListener('click', function (ev) {
      if (!ev.target.closest('.geo-wrap')) $('place-results').classList.remove('show');
    });

    setInterval(tick, 200);

    // Colapsa los paneles en pantallas pequeñas para no tapar la escena.
    if (window.innerWidth < 760) {
      Array.prototype.forEach.call(document.querySelectorAll('.ui-window'), function (w) {
        w.classList.add('collapsed');
      });
    }

    // Restaura la última carta (URL o localStorage). Si no hay, usa CDMX por defecto.
    if (loadInputs()) {
      if ($('natal-date').value) onCalculate();
    } else {
      applyDefaultPlace();
    }
  }

  init();
})();
