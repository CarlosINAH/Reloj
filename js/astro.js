/* ============================================================================
   astro.js — Núcleo astronómico de alta precisión.
   Usa Astronomy Engine (VSOP87 / ELP) para posiciones geocéntricas eclípticas
   de fecha, más sistemas de casas reales (Placidus, Porphyry, Igual, Signo
   Completo). Expone el objeto global `Astro`.
   ========================================================================== */
(function () {
  'use strict';

  var A = window.Astronomy;
  var R = Math.PI / 180, DEG = 180 / Math.PI;
  var n360 = function (x) { return ((x % 360) + 360) % 360; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  // Orden usado en la escena (de la Luna hacia afuera).
  var BODIES = ['Luna', 'Mercurio', 'Venus', 'Sol', 'Marte', 'Júpiter',
                'Saturno', 'Urano', 'Neptuno', 'Plutón'];

  // Mapa nombre español -> cuerpo de Astronomy Engine.
  var AE = {
    Sol: 'Sun', Luna: 'Moon', Mercurio: 'Mercury', Venus: 'Venus', Marte: 'Mars',
    'Júpiter': 'Jupiter', Saturno: 'Saturn', Urano: 'Uranus', Neptuno: 'Neptune',
    'Plutón': 'Pluto'
  };

  // ------------------------------------------------------------------
  // Longitud eclíptica geocéntrica aparente, EN EL EQUINOCCIO DE FECHA
  // (lo que usa la astrología tropical). Devuelve grados [0,360).
  // ------------------------------------------------------------------
  function geoLon(planet, date) {
    if (planet === 'Sol')  return n360(A.SunPosition(date).elon);
    if (planet === 'Luna') return n360(A.EclipticGeoMoon(date).lon);
    var gv = A.GeoVector(A.Body[AE[planet]], date, true); // corregido por aberración
    return n360(A.Ecliptic(gv).elon);
  }

  // Velocidad en longitud (grados/día) por diferencia central de 12 h.
  function speed(planet, date) {
    var dt = 0.25; // días
    var l1 = geoLon(planet, new Date(date.getTime() - dt * 86400000));
    var l2 = geoLon(planet, new Date(date.getTime() + dt * 86400000));
    var d = l2 - l1;
    if (d > 180) d -= 360; else if (d < -180) d += 360;
    return d / (2 * dt);
  }

  function isRetro(planet, date) {
    if (planet === 'Sol' || planet === 'Luna') return false; // nunca retrogradan
    return speed(planet, date) < 0;
  }

  // Oblicuidad media de la eclíptica en la fecha (grados). Suficiente para casas.
  function obliquity(date) {
    var jd = date.getTime() / 86400000 + 2440587.5;
    var T = (jd - 2451545.0) / 36525;
    return 23.439291 - 0.0130041667 * T - 1.638e-7 * T * T + 5.036e-7 * T * T * T;
  }

  // Tiempo sidéreo local en grados (RAMC). lonEast = longitud geográfica (+E).
  function ramcDeg(date, lonEast) {
    return n360(A.SiderealTime(date) * 15 + lonEast);
  }

  // Ascendente y Medio Cielo (longitudes eclípticas tropicales, grados).
  function angles(ramc, latDeg, oblDeg) {
    var ra = ramc * R, e = oblDeg * R, phi = latDeg * R;
    var mc = n360(Math.atan2(Math.sin(ra), Math.cos(ra) * Math.cos(e)) * DEG);
    var asc = n360(Math.atan2(Math.cos(ra),
      -(Math.sin(ra) * Math.cos(e) + Math.tan(phi) * Math.sin(e))) * DEG);
    return { asc: asc, mc: mc };
  }

  // Placidus: cada cúspide es el punto eclíptico que ha recorrido una fracción
  // (1/3, 2/3) de su semiarco diurno/nocturno. Resuelto por iteración de punto fijo.
  function placidusCusp(ramc, latDeg, oblDeg, frac, useDay, fromIC) {
    var e = oblDeg * R, phi = latDeg * R, cosE = Math.cos(e), sinE = Math.sin(e);
    var lam = n360(ramc + (fromIC ? 180 : 0));
    for (var i = 0; i < 100; i++) {
      var dec = Math.asin(sinE * Math.sin(lam * R));
      var ad = Math.asin(clamp(Math.tan(phi) * Math.tan(dec), -1, 1)) * DEG;
      var sa = useDay ? (90 + ad) : (90 - ad);
      var targetRA = fromIC ? (ramc + 180 - frac * sa) : (ramc + frac * sa);
      var t = targetRA * R;
      var nl = n360(Math.atan2(Math.sin(t), Math.cos(t) * cosE) * DEG);
      if (Math.abs(((nl - lam + 540) % 360) - 180) < 1e-9) { lam = nl; break; }
      lam = nl;
    }
    return lam;
  }

  // Devuelve { asc, mc, cusps:[12] } para el sistema indicado.
  // cusps[0] = Casa 1, cusps[9] = Casa 10 (MC), etc.
  function houses(system, date, lonEast, latDeg) {
    var obl = obliquity(date);
    var ramc = ramcDeg(date, lonEast);
    var a = angles(ramc, latDeg, obl);
    var asc = a.asc, mc = a.mc;
    var cusps = new Array(12);

    if (system === 'whole') {
      var base = Math.floor(asc / 30) * 30;
      for (var i = 0; i < 12; i++) cusps[i] = n360(base + i * 30);
    } else if (system === 'equal') {
      for (var j = 0; j < 12; j++) cusps[j] = n360(asc + j * 30);
    } else if (system === 'porphyry') {
      var q1 = n360(asc - mc);           // MC(10) -> ASC(1)
      var q2 = n360((mc + 180) - asc);   // ASC(1) -> IC(4)
      cusps[0] = asc;
      cusps[1] = n360(asc + q2 / 3);
      cusps[2] = n360(asc + 2 * q2 / 3);
      cusps[3] = n360(mc + 180);
      cusps[9] = mc;
      cusps[10] = n360(mc + q1 / 3);
      cusps[11] = n360(mc + 2 * q1 / 3);
      cusps[4] = n360(cusps[10] + 180);
      cusps[5] = n360(cusps[11] + 180);
      cusps[6] = n360(asc + 180);
      cusps[7] = n360(cusps[1] + 180);
      cusps[8] = n360(cusps[2] + 180);
    } else { // placidus (por defecto)
      cusps[0] = asc;
      cusps[9] = mc;
      cusps[3] = n360(mc + 180);
      cusps[6] = n360(asc + 180);
      cusps[10] = placidusCusp(ramc, latDeg, obl, 1 / 3, true, false);  // C11
      cusps[11] = placidusCusp(ramc, latDeg, obl, 2 / 3, true, false);  // C12
      cusps[1] = placidusCusp(ramc, latDeg, obl, 2 / 3, false, true);   // C2
      cusps[2] = placidusCusp(ramc, latDeg, obl, 1 / 3, false, true);   // C3
      cusps[4] = n360(cusps[10] + 180); // C5
      cusps[5] = n360(cusps[11] + 180); // C6
      cusps[7] = n360(cusps[1] + 180);  // C8
      cusps[8] = n360(cusps[2] + 180);  // C9
    }
    return { asc: asc, mc: mc, cusps: cusps };
  }

  // Número de casa (1-12) para una longitud dada, según las cúspides.
  function houseOf(lon, cusps) {
    if (!cusps || cusps.length < 12) return null;
    lon = n360(lon);
    for (var i = 0; i < 12; i++) {
      var c1 = cusps[i], c2 = cusps[(i + 1) % 12];
      var span = n360(c2 - c1);
      var off = n360(lon - c1);
      if (off < span) return i + 1;
    }
    return 12;
  }

  // ----------------------- Formato de coordenadas ------------------------
  function signIndex(lon) { return Math.floor(n360(lon) / 30); }

  function formatDMS(lon) {
    lon = n360(lon);
    var within = lon % 30;
    var d = Math.floor(within);
    var mF = (within - d) * 60;
    var m = Math.floor(mF);
    var s = Math.round((mF - m) * 60);
    if (s === 60) { s = 0; m++; }
    if (m === 60) { m = 0; d++; }
    return { d: d, m: m, s: s,
      text: d + '°' + String(m).padStart(2, '0') + "'" + String(s).padStart(2, '0') + '"' };
  }

  // --------------------------- Aspectos ---------------------------------
  var ASPECT_TYPES = [
    // Mayores
    { name: 'Conjunción', angle: 0,   orb: 6,   cls: 'conj', color: 0xffe600, minor: false },
    { name: 'Oposición',  angle: 180, orb: 6,   cls: 'opp',  color: 0xff3344, minor: false },
    { name: 'Cuadratura', angle: 90,  orb: 5,   cls: 'sq',   color: 0xff6600, minor: false },
    { name: 'Trígono',    angle: 120, orb: 5,   cls: 'tri',  color: 0x00ffcc, minor: false },
    { name: 'Sextil',     angle: 60,  orb: 4,   cls: 'sex',  color: 0x00d4ff, minor: false },
    // Menores (orbes pequeños, líneas más tenues)
    { name: 'Quincuncio',     angle: 150, orb: 2.0, cls: 'min', color: 0xb388ff, minor: true },
    { name: 'Sesquicuadratura', angle: 135, orb: 1.5, cls: 'min', color: 0xb388ff, minor: true },
    { name: 'Semicuadratura', angle: 45,  orb: 1.5, cls: 'min', color: 0xb388ff, minor: true },
    { name: 'Quintil',        angle: 72,  orb: 1.2, cls: 'min', color: 0xb388ff, minor: true },
    { name: 'Semisextil',     angle: 30,  orb: 1.2, cls: 'min', color: 0xb388ff, minor: true }
  ];

  // Compara dos conjuntos de longitudes {planeta: grados} y devuelve aspectos.
  // Si sameSet es true (aspectos internos) evita duplicados y auto-pares.
  function findAspects(setA, setB, sameSet, includeMinor) {
    var out = [];
    var keysA = Object.keys(setA), keysB = Object.keys(setB);
    keysA.forEach(function (a) {
      keysB.forEach(function (b) {
        if (sameSet && a === b) return;
        if (sameSet && keysA.indexOf(b) < keysB.indexOf(a)) return; // una sola vez
        var diff = Math.abs(setA[a] - setB[b]);
        if (diff > 180) diff = 360 - diff;
        for (var k = 0; k < ASPECT_TYPES.length; k++) {
          var t = ASPECT_TYPES[k];
          if (t.minor && !includeMinor) continue;
          var orbUsed = Math.abs(diff - t.angle);
          if (orbUsed <= t.orb) {
            out.push({ a: a, b: b, type: t, orb: orbUsed });
            break;
          }
        }
      });
    });
    // Aspectos más exactos primero.
    out.sort(function (x, y) { return x.orb - y.orb; });
    return out;
  }

  window.Astro = {
    BODIES: BODIES,
    n360: n360,
    geoLon: geoLon,
    speed: speed,
    isRetro: isRetro,
    obliquity: obliquity,
    houses: houses,
    houseOf: houseOf,
    signIndex: signIndex,
    formatDMS: formatDMS,
    findAspects: findAspects,
    ASPECT_TYPES: ASPECT_TYPES
  };
})();
