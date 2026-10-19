/* ============================================================================
   data.js — Signos, planetas y frases clave del clima astral.
   Texto original en español. Global: `Data`.
   ========================================================================== */
(function () {
  'use strict';

  var SIGNS = [
    { name: 'Aries', glyph: '♈', color: '#ff5a5a', element: 'Fuego' },
    { name: 'Tauro', glyph: '♉', color: '#7ad67a', element: 'Tierra' },
    { name: 'Géminis', glyph: '♊', color: '#ffe066', element: 'Aire' },
    { name: 'Cáncer', glyph: '♋', color: '#66e0e0', element: 'Agua' },
    { name: 'Leo', glyph: '♌', color: '#ffb13d', element: 'Fuego' },
    { name: 'Virgo', glyph: '♍', color: '#b6e26a', element: 'Tierra' },
    { name: 'Libra', glyph: '♎', color: '#ff9edb', element: 'Aire' },
    { name: 'Escorpio', glyph: '♏', color: '#e04a6a', element: 'Agua' },
    { name: 'Sagitario', glyph: '♐', color: '#c07bff', element: 'Fuego' },
    { name: 'Capricornio', glyph: '♑', color: '#9aa0ff', element: 'Tierra' },
    { name: 'Acuario', glyph: '♒', color: '#4fd6ff', element: 'Aire' },
    { name: 'Piscis', glyph: '♓', color: '#7fb0ff', element: 'Agua' }
  ];

  // kw = palabra clave breve del planeta (para el clima).
  var PLANETS = {
    Sol:      { glyph: '☉', kw: 'identidad y vitalidad' },
    Luna:     { glyph: '☽', kw: 'emociones y ánimo' },
    Mercurio: { glyph: '☿', kw: 'mente y comunicación' },
    Venus:    { glyph: '♀', kw: 'amor y placer' },
    Marte:    { glyph: '♂', kw: 'acción y deseo' },
    'Júpiter':{ glyph: '♃', kw: 'expansión y suerte' },
    Saturno:  { glyph: '♄', kw: 'estructura y límites' },
    Urano:    { glyph: '♅', kw: 'cambio y sorpresa' },
    Neptuno:  { glyph: '♆', kw: 'sueños e intuición' },
    'Plutón': { glyph: '♇', kw: 'poder y transformación' }
  };

  // tone: 'armónico' | 'tenso' | 'fusión' — define color/mood.
  var ASPECTS = {
    'Conjunción': { tone: 'fusión',   verb: 'se funde con', tag: 'intensidad, fusión de energías' },
    'Oposición':  { tone: 'tenso',    verb: 'se tensa con', tag: 'polaridad, hay que equilibrar' },
    'Cuadratura': { tone: 'tenso',    verb: 'choca con',    tag: 'fricción que empuja a actuar' },
    'Trígono':    { tone: 'armónico', verb: 'fluye con',    tag: 'facilidad, talento natural' },
    'Sextil':     { tone: 'armónico', verb: 'coopera con',  tag: 'oportunidad si tomas la iniciativa' },
    'Quincuncio':       { tone: 'tenso',    verb: 'se desajusta con', tag: 'reajuste incómodo' },
    'Sesquicuadratura': { tone: 'tenso',    verb: 'roza con',         tag: 'tensión intermitente' },
    'Semicuadratura':   { tone: 'tenso',    verb: 'irrita a',         tag: 'roce menor' },
    'Semisextil':       { tone: 'armónico', verb: 'roza suave con',   tag: 'matiz sutil' }
  };

  function sign(lon) { return SIGNS[Math.floor(((lon % 360) + 360) % 360 / 30)]; }

  // Frase clave de un aspecto entre dos planetas (clima).
  function phrase(aspectName, pA, pB) {
    var a = PLANETS[pA], b = PLANETS[pB], asp = ASPECTS[aspectName];
    if (!a || !b || !asp) return '';
    return a.kw.charAt(0).toUpperCase() + a.kw.slice(1) + ' ' + asp.verb + ' ' + b.kw + ' — ' + asp.tag + '.';
  }

  window.Data = {
    SIGNS: SIGNS, PLANETS: PLANETS, ASPECTS: ASPECTS,
    signOf: sign, phrase: phrase,
    glyph: function (n) { return (PLANETS[n] || {}).glyph || '?'; }
  };
})();
