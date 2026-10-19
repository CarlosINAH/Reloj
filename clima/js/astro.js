/* ============================================================================
   astro.js — Núcleo astronómico (Clima Astral en tiempo real).
   Posiciones geocéntricas eclípticas de fecha + aspectos entre planetas.
   Sin casas ni carta natal. Usa Astronomy Engine (VSOP87/ELP). Global: `Astro`.
   ========================================================================== */
(function () {
  'use strict';
  var A = window.Astronomy;
  var R = Math.PI / 180, DEG = 180 / Math.PI;
  var n360 = function (x) { return ((x % 360) + 360) % 360; };

  // Orden geocéntrico (de la Tierra hacia afuera).
  var BODIES = ['Luna', 'Mercurio', 'Venus', 'Sol', 'Marte', 'Júpiter',
                'Saturno', 'Urano', 'Neptuno', 'Plutón'];
  var AE = {
    Sol: 'Sun', Luna: 'Moon', Mercurio: 'Mercury', Venus: 'Venus', Marte: 'Mars',
    'Júpiter': 'Jupiter', Saturno: 'Saturn', Urano: 'Uranus', Neptuno: 'Neptune', 'Plutón': 'Pluto'
  };

  function geoLon(planet, date) {
    if (planet === 'Sol') return n360(A.SunPosition(date).elon);
    if (planet === 'Luna') return n360(A.EclipticGeoMoon(date).lon);
    return n360(A.Ecliptic(A.GeoVector(A.Body[AE[planet]], date, true)).elon);
  }

  function speed(planet, date) {
    var dt = 0.25;
    var l1 = geoLon(planet, new Date(date.getTime() - dt * 86400000));
    var l2 = geoLon(planet, new Date(date.getTime() + dt * 86400000));
    var d = l2 - l1;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    return d / (2 * dt);
  }
  function isRetro(planet, date) {
    if (planet === 'Sol' || planet === 'Luna') return false;
    return speed(planet, date) < 0;
  }

  function signIndex(lon) { return Math.floor(n360(lon) / 30); }
  function formatDMS(lon) {
    lon = n360(lon); var w = lon % 30;
    var d = Math.floor(w), m = Math.floor((w - d) * 60);
    return { d: d, m: m, text: d + '°' + String(m).padStart(2, '0') + "'" };
  }

  // --------------------------- Aspectos ---------------------------------
  var ASPECT_TYPES = [
    { name: 'Conjunción', sym: '☌', angle: 0,   orb: 6,   cls: 'conj', color: 0xffe600, minor: false },
    { name: 'Oposición',  sym: '☍', angle: 180, orb: 6,   cls: 'opp',  color: 0xff3344, minor: false },
    { name: 'Cuadratura', sym: '□', angle: 90,  orb: 5,   cls: 'sq',   color: 0xff6600, minor: false },
    { name: 'Trígono',    sym: '△', angle: 120, orb: 5,   cls: 'tri',  color: 0x00ffcc, minor: false },
    { name: 'Sextil',     sym: '⚹', angle: 60,  orb: 4,   cls: 'sex',  color: 0x00d4ff, minor: false },
    { name: 'Quincuncio',       sym: '⚻', angle: 150, orb: 2.0, cls: 'min', color: 0xb388ff, minor: true },
    { name: 'Sesquicuadratura', sym: '⚼', angle: 135, orb: 1.5, cls: 'min', color: 0xb388ff, minor: true },
    { name: 'Semicuadratura',   sym: '∠', angle: 45,  orb: 1.5, cls: 'min', color: 0xb388ff, minor: true },
    { name: 'Semisextil',       sym: '⚺', angle: 30,  orb: 1.2, cls: 'min', color: 0xb388ff, minor: true }
  ];

  // Aspectos entre los planetas del cielo actual. Devuelve también si es
  // aplicativo (se está formando) o separativo (se va), por velocidad relativa.
  function findAspects(positions, speeds, includeMinor) {
    var keys = Object.keys(positions), out = [];
    for (var i = 0; i < keys.length; i++) {
      for (var j = i + 1; j < keys.length; j++) {
        var a = keys[i], b = keys[j];
        var diff = Math.abs(positions[a] - positions[b]);
        if (diff > 180) diff = 360 - diff;
        for (var k = 0; k < ASPECT_TYPES.length; k++) {
          var t = ASPECT_TYPES[k];
          if (t.minor && !includeMinor) continue;
          var orb = Math.abs(diff - t.angle);
          if (orb <= t.orb) {
            // Aplicativo si el ángulo entre ambos se acerca al exacto.
            var rel = (speeds[a] - speeds[b]);
            var applying = null;
            if (speeds) {
              var sep = positions[a] - positions[b];
              sep = ((sep % 360) + 360) % 360; if (sep > 180) sep -= 360;
              applying = (sep * rel) < 0; // se dirige hacia 0 de separación
            }
            out.push({ a: a, b: b, type: t, orb: orb, applying: applying });
            break;
          }
        }
      }
    }
    out.sort(function (x, y) { return x.orb - y.orb; });
    return out;
  }

  window.Astro = {
    BODIES: BODIES, n360: n360, geoLon: geoLon, speed: speed, isRetro: isRetro,
    signIndex: signIndex, formatDMS: formatDMS, findAspects: findAspects, ASPECT_TYPES: ASPECT_TYPES
  };
})();
