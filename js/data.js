/* ============================================================================
   data.js — Diccionarios astrológicos (signos, casas, planetas, aspectos)
   e interpretaciones didácticas en español.
   Expone el objeto global `Data`.
   ========================================================================== */
(function () {
  'use strict';

  // Orden zodiacal tropical. `color` se usa para los glifos en la escena 3D.
  const SIGNS = [
    { name: 'Aries',       glyph: '♈', color: '#ff5a5a', element: 'Fuego', quality: 'Cardinal', ruler: 'Marte',    keyword: 'Iniciativa, impulso y acción' },
    { name: 'Tauro',       glyph: '♉', color: '#7ad67a', element: 'Tierra', quality: 'Fijo',     ruler: 'Venus',    keyword: 'Estabilidad, disfrute y recursos' },
    { name: 'Géminis',     glyph: '♊', color: '#ffe066', element: 'Aire',   quality: 'Mutable',  ruler: 'Mercurio', keyword: 'Curiosidad, comunicación y versatilidad' },
    { name: 'Cáncer',      glyph: '♋', color: '#66e0e0', element: 'Agua',   quality: 'Cardinal', ruler: 'Luna',     keyword: 'Emoción, hogar y protección' },
    { name: 'Leo',         glyph: '♌', color: '#ffb13d', element: 'Fuego',  quality: 'Fijo',     ruler: 'Sol',      keyword: 'Expresión, creatividad y liderazgo' },
    { name: 'Virgo',       glyph: '♍', color: '#b6e26a', element: 'Tierra', quality: 'Mutable',  ruler: 'Mercurio', keyword: 'Análisis, servicio y precisión' },
    { name: 'Libra',       glyph: '♎', color: '#ff9edb', element: 'Aire',   quality: 'Cardinal', ruler: 'Venus',    keyword: 'Equilibrio, vínculos y armonía' },
    { name: 'Escorpio',    glyph: '♏', color: '#e04a6a', element: 'Agua',   quality: 'Fijo',     ruler: 'Plutón',   keyword: 'Intensidad, transformación y profundidad' },
    { name: 'Sagitario',   glyph: '♐', color: '#c07bff', element: 'Fuego',  quality: 'Mutable',  ruler: 'Júpiter',  keyword: 'Expansión, sentido y aventura' },
    { name: 'Capricornio', glyph: '♑', color: '#9aa0ff', element: 'Tierra', quality: 'Cardinal', ruler: 'Saturno',  keyword: 'Estructura, ambición y responsabilidad' },
    { name: 'Acuario',     glyph: '♒', color: '#4fd6ff', element: 'Aire',   quality: 'Fijo',     ruler: 'Urano',    keyword: 'Innovación, comunidad y libertad' },
    { name: 'Piscis',      glyph: '♓', color: '#7fb0ff', element: 'Agua',   quality: 'Mutable',  ruler: 'Neptuno',  keyword: 'Sensibilidad, imaginación y trascendencia' }
  ];

  const HOUSES = {
    1:  { name: 'Casa 1 · Identidad',        area: 'Identidad, vitalidad, cuerpo y la forma en que te presentas al mundo.' },
    2:  { name: 'Casa 2 · Recursos',         area: 'Dinero propio, valores, talentos y autoestima.' },
    3:  { name: 'Casa 3 · Comunicación',     area: 'Mente concreta, aprendizaje, hermanos y entorno cercano.' },
    4:  { name: 'Casa 4 · Hogar',            area: 'Raíces, familia, vida privada y base emocional.' },
    5:  { name: 'Casa 5 · Creatividad',      area: 'Placer, romance, hijos, juego y expresión personal.' },
    6:  { name: 'Casa 6 · Trabajo y salud',  area: 'Rutina diaria, hábitos, servicio y cuidado del cuerpo.' },
    7:  { name: 'Casa 7 · Relaciones',       area: 'Pareja, socios y acuerdos uno a uno.' },
    8:  { name: 'Casa 8 · Transformación',   area: 'Recursos compartidos, intimidad, crisis y regeneración.' },
    9:  { name: 'Casa 9 · Expansión',        area: 'Filosofía, estudios superiores, viajes y creencias.' },
    10: { name: 'Casa 10 · Vocación',        area: 'Carrera, estatus público, logros y dirección de vida.' },
    11: { name: 'Casa 11 · Comunidad',       area: 'Amistades, grupos, proyectos y visión de futuro.' },
    12: { name: 'Casa 12 · Interioridad',    area: 'Inconsciente, retiro, espiritualidad y cierre de ciclos.' }
  };

  // Símbolos y descriptores planetarios.
  const PLANETS = {
    Sol:      { glyph: '☉', theme: 'tu identidad esencial y voluntad de brillar' },
    Luna:     { glyph: '☽', theme: 'tus emociones, necesidades y mundo íntimo' },
    Mercurio: { glyph: '☿', theme: 'tu forma de pensar, comunicar y aprender' },
    Venus:    { glyph: '♀', theme: 'cómo amas, disfrutas y valoras' },
    Marte:    { glyph: '♂', theme: 'tu impulso, deseo y capacidad de acción' },
    Júpiter:  { glyph: '♃', theme: 'dónde creces, confías y buscas sentido' },
    Saturno:  { glyph: '♄', theme: 'tu estructura, límites y madurez' },
    Urano:    { glyph: '♅', theme: 'dónde innovas, te liberas y rompes moldes' },
    Neptuno:  { glyph: '♆', theme: 'tu sensibilidad, sueños e inspiración' },
    Plutón:   { glyph: '♇', theme: 'dónde transformas y regeneras con intensidad' }
  };

  const ASPECTS = {
    Conjunción: { desc: 'Fusión de energías: los astros actúan como uno solo, intensificándose.' },
    Oposición:  { desc: 'Tensión de polaridad: pide equilibrar dos fuerzas opuestas.' },
    Cuadratura: { desc: 'Fricción dinámica: reto que empuja al crecimiento y la acción.' },
    Trígono:    { desc: 'Flujo armónico: talento natural y facilidad entre ambas energías.' },
    Sextil:     { desc: 'Oportunidad: colaboración que rinde fruto si se activa.' }
  };

  // Tono breve de cada planeta expresado a través del elemento del signo,
  // suficiente para una lectura didáctica sin ser un tratado.
  const ELEMENT_TONE = {
    Fuego:  'con entusiasmo, calidez y necesidad de expresión directa',
    Tierra: 'de manera práctica, paciente y orientada a resultados concretos',
    Aire:   'desde la mente, el intercambio de ideas y el vínculo social',
    Agua:   'con hondura emocional, intuición y sensibilidad'
  };

  // Construye un texto de interpretación para un planeta en un signo y casa.
  function interpret(planet, signName, houseNum) {
    const p = PLANETS[planet];
    const sign = SIGNS.find(function (s) { return s.name === signName; });
    if (!p || !sign) return '';
    let txt = p.glyph + ' ' + planet + ' representa ' + p.theme + '. ';
    txt += 'En ' + sign.name + ' se expresa ' + (ELEMENT_TONE[sign.element] || '') +
           ' (' + sign.keyword.toLowerCase() + ').';
    if (houseNum && HOUSES[houseNum]) {
      txt += ' Al caer en la ' + HOUSES[houseNum].name + ', enfoca su energía en: ' +
             HOUSES[houseNum].area;
    }
    return txt;
  }

  window.Data = {
    SIGNS: SIGNS,
    HOUSES: HOUSES,
    PLANETS: PLANETS,
    ASPECTS: ASPECTS,
    interpret: interpret,
    planetGlyph: function (name) { return (PLANETS[name] || {}).glyph || '?'; }
  };
})();
