/* ============================================================================
   data.js — Diccionarios astrológicos e interpretaciones didácticas (español).
   Motor de significados para planetas, signos, casas y aspectos, con lecturas
   diferenciadas para la CARTA NATAL y para los TRÁNSITOS en movimiento.
   Expone el objeto global `Data`. Texto original (no reproduce fuentes externas).
   ========================================================================== */
(function () {
  'use strict';

  // -------------------------------- SIGNOS --------------------------------
  // style  = adverbio/modo con que un planeta se expresa AL ESTAR en el signo.
  // light  = potencial luminoso · shadow = sombra a integrar.
  var SIGNS = [
    { name: 'Aries',       glyph: '♈', color: '#ff5a5a', element: 'Fuego',  quality: 'Cardinal', ruler: 'Marte',
      keyword: 'Iniciativa, impulso y acción',
      style: 'de forma directa, valiente e impaciente',
      light: 'coraje, liderazgo y arranque', shadow: 'impulsividad, prisa y agresividad' },
    { name: 'Tauro',       glyph: '♉', color: '#7ad67a', element: 'Tierra', quality: 'Fijo',     ruler: 'Venus',
      keyword: 'Estabilidad, disfrute y recursos',
      style: 'con calma, constancia y sentido práctico',
      light: 'perseverancia, sensualidad y firmeza', shadow: 'terquedad, apego y lentitud' },
    { name: 'Géminis',     glyph: '♊', color: '#ffe066', element: 'Aire',   quality: 'Mutable',  ruler: 'Mercurio',
      keyword: 'Curiosidad, comunicación y versatilidad',
      style: 'con curiosidad, ingenio y palabra ágil',
      light: 'versatilidad, aprendizaje y sociabilidad', shadow: 'dispersión, nerviosismo y superficialidad' },
    { name: 'Cáncer',      glyph: '♋', color: '#66e0e0', element: 'Agua',   quality: 'Cardinal', ruler: 'Luna',
      keyword: 'Emoción, hogar y protección',
      style: 'desde la emoción, la memoria y el instinto protector',
      light: 'ternura, cuidado y arraigo', shadow: 'susceptibilidad, apego y evasión' },
    { name: 'Leo',         glyph: '♌', color: '#ffb13d', element: 'Fuego',  quality: 'Fijo',     ruler: 'Sol',
      keyword: 'Expresión, creatividad y liderazgo',
      style: 'con orgullo, calidez y ganas de destacar',
      light: 'generosidad, brillo y confianza', shadow: 'ego, dramatismo y necesidad de aplauso' },
    { name: 'Virgo',       glyph: '♍', color: '#b6e26a', element: 'Tierra', quality: 'Mutable',  ruler: 'Mercurio',
      keyword: 'Análisis, servicio y precisión',
      style: 'con análisis, discreción y afán de mejora',
      light: 'eficiencia, utilidad y detalle', shadow: 'autocrítica, exceso de control y preocupación' },
    { name: 'Libra',       glyph: '♎', color: '#ff9edb', element: 'Aire',   quality: 'Cardinal', ruler: 'Venus',
      keyword: 'Equilibrio, vínculos y armonía',
      style: 'buscando equilibrio, belleza y acuerdo',
      light: 'diplomacia, elegancia y justicia', shadow: 'indecisión, dependencia y complacencia' },
    { name: 'Escorpio',    glyph: '♏', color: '#e04a6a', element: 'Agua',   quality: 'Fijo',     ruler: 'Plutón',
      keyword: 'Intensidad, transformación y profundidad',
      style: 'con intensidad, hondura y control',
      light: 'poder, lealtad y regeneración', shadow: 'celos, obsesión y manipulación' },
    { name: 'Sagitario',   glyph: '♐', color: '#c07bff', element: 'Fuego',  quality: 'Mutable',  ruler: 'Júpiter',
      keyword: 'Expansión, sentido y aventura',
      style: 'con entusiasmo, fe y visión amplia',
      light: 'optimismo, honestidad y horizonte', shadow: 'exceso, dogmatismo e inconstancia' },
    { name: 'Capricornio', glyph: '♑', color: '#9aa0ff', element: 'Tierra', quality: 'Cardinal', ruler: 'Saturno',
      keyword: 'Estructura, ambición y responsabilidad',
      style: 'con disciplina, ambición y paciencia',
      light: 'responsabilidad, estrategia y logro', shadow: 'rigidez, frialdad y pesimismo' },
    { name: 'Acuario',     glyph: '♒', color: '#4fd6ff', element: 'Aire',   quality: 'Fijo',     ruler: 'Urano',
      keyword: 'Innovación, comunidad y libertad',
      style: 'de modo original, independiente y mental',
      light: 'originalidad, humanidad y visión de futuro', shadow: 'distancia, rebeldía y desapego' },
    { name: 'Piscis',      glyph: '♓', color: '#7fb0ff', element: 'Agua',   quality: 'Mutable',  ruler: 'Neptuno',
      keyword: 'Sensibilidad, imaginación y trascendencia',
      style: 'con sensibilidad, imaginación y entrega',
      light: 'compasión, inspiración y unión', shadow: 'evasión, victimismo y confusión' }
  ];

  // --------------------------------- CASAS --------------------------------
  // area = ámbito de vida (natal) · transit = qué moviliza un paso planetario.
  var HOUSES = {
    1:  { name: 'Casa 1 · Identidad',       area: 'Identidad, vitalidad, cuerpo y la forma en que te presentas al mundo.', transit: 'tu imagen, energía personal y nuevos comienzos' },
    2:  { name: 'Casa 2 · Recursos',        area: 'Dinero propio, valores, talentos y autoestima.',                        transit: 'tus finanzas, recursos y sentido de valía' },
    3:  { name: 'Casa 3 · Comunicación',    area: 'Mente concreta, aprendizaje, hermanos y entorno cercano.',              transit: 'tu comunicación, estudios y entorno cercano' },
    4:  { name: 'Casa 4 · Hogar',           area: 'Raíces, familia, vida privada y base emocional.',                       transit: 'tu hogar, familia y mundo emocional' },
    5:  { name: 'Casa 5 · Creatividad',     area: 'Placer, romance, hijos, juego y expresión personal.',                   transit: 'tu creatividad, romance y capacidad de disfrutar' },
    6:  { name: 'Casa 6 · Trabajo y salud', area: 'Rutina diaria, hábitos, servicio y cuidado del cuerpo.',                transit: 'tu trabajo diario, hábitos y salud' },
    7:  { name: 'Casa 7 · Relaciones',      area: 'Pareja, socios y acuerdos uno a uno.',                                  transit: 'tus relaciones de pareja y asociaciones' },
    8:  { name: 'Casa 8 · Transformación',  area: 'Recursos compartidos, intimidad, crisis y regeneración.',               transit: 'tus recursos compartidos, intimidad y procesos de cambio' },
    9:  { name: 'Casa 9 · Expansión',       area: 'Filosofía, estudios superiores, viajes y creencias.',                   transit: 'tus viajes, estudios y creencias' },
    10: { name: 'Casa 10 · Vocación',       area: 'Carrera, estatus público, logros y dirección de vida.',                 transit: 'tu carrera, imagen pública y metas' },
    11: { name: 'Casa 11 · Comunidad',      area: 'Amistades, grupos, proyectos y visión de futuro.',                      transit: 'tus amistades, grupos y proyectos a futuro' },
    12: { name: 'Casa 12 · Interioridad',   area: 'Inconsciente, retiro, espiritualidad y cierre de ciclos.',              transit: 'tu interioridad, descanso y cierres de ciclo' }
  };

  // ------------------------------- PLANETAS -------------------------------
  // funcion = qué representa · verb = acción en 2ª persona (se combina con el
  // estilo del signo) · natal / transit = matices por versión.
  var PLANETS = {
    Sol:      { glyph: '☉', funcion: 'tu identidad, propósito y vitalidad',
                verb: 'afirmas quién eres y hacia dónde vas',
                natal: 'revela el núcleo de tu carácter y lo que te hace sentir vivo/a',
                transit: 'ilumina y da protagonismo al área que atraviesa' },
    Luna:     { glyph: '☽', funcion: 'tus emociones, hábitos y necesidad de cuidado',
                verb: 'sientes, reaccionas y buscas seguridad',
                natal: 'muestra tu mundo íntimo y lo que necesitas para sentirte a salvo',
                transit: 'cambia rápido el clima emocional del día y del área que toca' },
    Mercurio: { glyph: '☿', funcion: 'tu mente, comunicación y aprendizaje',
                verb: 'piensas, hablas y conectas ideas',
                natal: 'describe cómo razonas, estudias y te expresas',
                transit: 'acelera conversaciones, ideas, trámites y desplazamientos' },
    Venus:    { glyph: '♀', funcion: 'tu forma de amar, disfrutar y valorar',
                verb: 'atraes, disfrutas y armonizas',
                natal: 'habla de tus gustos, vínculos afectivos y sentido de la belleza',
                transit: 'suaviza y endulza el área que toca: afectos, dinero y placer' },
    Marte:    { glyph: '♂', funcion: 'tu impulso, deseo y capacidad de acción',
                verb: 'actúas, deseas y defiendes tu terreno',
                natal: 'indica cómo peleas, deseas y persigues lo que quieres',
                transit: 'enciende energía, iniciativa y también tensión o prisa' },
    'Júpiter':{ glyph: '♃', funcion: 'tu expansión, confianza y búsqueda de sentido',
                verb: 'creces, confías y buscas más',
                natal: 'señala dónde tienes suerte, fe y ganas de crecer',
                transit: 'abre oportunidades y amplía el área que visita (a veces en exceso)' },
    Saturno:  { glyph: '♄', funcion: 'tu estructura, límites y madurez',
                verb: 'te comprometes, ordenas y asumes responsabilidad',
                natal: 'marca tus retos, miedos y el lugar donde construyes solidez',
                transit: 'pone a prueba, exige realismo y consolida lo que toca' },
    Urano:    { glyph: '♅', funcion: 'tu necesidad de libertad, cambio e innovación',
                verb: 'rompes moldes y te reinventas',
                natal: 'muestra dónde eres original y necesitas independencia',
                transit: 'trae cambios súbitos, sorpresas y despertares' },
    Neptuno:  { glyph: '♆', funcion: 'tu sensibilidad, imaginación y espiritualidad',
                verb: 'sueñas, intuyes y te disuelves en algo mayor',
                natal: 'revela tu inspiración e ideales, y también tus nieblas',
                transit: 'idealiza, sensibiliza o difumina el área que envuelve' },
    'Plutón': { glyph: '♇', funcion: 'tu poder de transformación y regeneración',
                verb: 'transformas, profundizas y regeneras',
                natal: 'apunta a heridas profundas y a tu capacidad de renacer',
                transit: 'remueve de raíz y transforma lentamente lo que atraviesa' }
  };

  // ------------------------------- ASPECTOS -------------------------------
  var ASPECTS = {
    'Conjunción': { angle: 0,   nature: 'fusión',   keyword: 'unión e intensificación', verbPair: 'se une a',
      natal: 'Las dos energías se funden y actúan como una: muy potente, pero poco objetiva.',
      transit: 'fusiona ambos temas e intensifica el asunto que comparten.' },
    'Oposición':  { angle: 180, nature: 'tenso',    keyword: 'polaridad y equilibrio',  verbPair: 'se enfrenta a',
      natal: 'Estira dos fuerzas opuestas; pide equilibrio, a menudo a través de los demás.',
      transit: 'saca a la luz la tensión entre ambos y busca un punto medio.' },
    'Cuadratura': { angle: 90,  nature: 'tenso',    keyword: 'fricción y crecimiento',  verbPair: 'presiona a',
      natal: 'Fricción interna que, bien trabajada, es un gran motor de logros.',
      transit: 'presiona y exige ajustes: incomoda, pero empuja a actuar.' },
    'Trígono':    { angle: 120, nature: 'armónico', keyword: 'talento y fluidez',       verbPair: 'fluye con',
      natal: 'Don natural: las energías circulan con facilidad, casi sin esfuerzo.',
      transit: 'abre una ventana favorable, fácil de aprovechar.' },
    'Sextil':     { angle: 60,  nature: 'armónico', keyword: 'oportunidad',             verbPair: 'coopera con',
      natal: 'Potencial de talento que se activa con un poco de iniciativa.',
      transit: 'ofrece una oportunidad que rinde fruto si tomas la iniciativa.' }
  };

  function sign(name) { return SIGNS.find(function (s) { return s.name === name; }); }

  // ---------------------- Interpretaciones combinadas ---------------------

  // Planeta NATAL en signo y casa.
  function interpretNatal(planet, signName, houseNum) {
    var p = PLANETS[planet], s = sign(signName);
    if (!p || !s) return '';
    var t = p.glyph + ' ' + planet + ' — ' + p.funcion + '. ' +
      'Aquí ' + p.verb + ' ' + s.style + ' (' + s.keyword.toLowerCase() + '). ' +
      'En su versión natal, ' + p.natal + '.';
    if (houseNum && HOUSES[houseNum]) {
      t += ' Al caer en la ' + HOUSES[houseNum].name + ', vuelca esa energía en: ' + HOUSES[houseNum].area;
    }
    return t;
  }

  // Planeta en TRÁNSITO por un signo, activando una casa natal.
  function interpretTransit(planet, signName, houseNum) {
    var p = PLANETS[planet], s = sign(signName);
    if (!p || !s) return '';
    var t = p.glyph + ' ' + planet + ' en tránsito recorre ' + signName +
      ' ' + s.style + ': ' + p.transit + '.';
    if (houseNum && HOUSES[houseNum]) {
      t += ' Ahora cruza tu ' + HOUSES[houseNum].name +
        ', activando ' + HOUSES[houseNum].transit + '.';
    }
    return t;
  }

  // Aspecto entre dos planetas. isTransit=true -> A es tránsito, B es natal.
  function interpretAspect(aspectName, planetA, planetB, isTransit) {
    var asp = ASPECTS[aspectName];
    var a = PLANETS[planetA], b = PLANETS[planetB];
    if (!asp || !a || !b) return '';
    if (isTransit) {
      return a.glyph + ' ' + planetA + ' en tránsito ' + asp.verbPair + ' ' +
        b.glyph + ' ' + planetB + ' natal: pone en diálogo ' + a.funcion +
        ' con ' + b.funcion + '. ' + capitalize(asp.transit);
    }
    return a.glyph + ' ' + planetA + ' ' + asp.verbPair + ' ' + b.glyph + ' ' + planetB +
      ': conecta ' + a.funcion + ' con ' + b.funcion + '. ' + asp.natal;
  }

  // Significado autónomo de un signo (para tarjetas / referencia).
  function signMeaning(name) {
    var s = sign(name);
    if (!s) return '';
    return s.glyph + ' ' + s.name + ' — ' + s.element + ' ' + s.quality.toLowerCase() +
      ', regido por ' + s.ruler + '. ' + s.keyword + '. Luz: ' + s.light +
      '. Sombra: ' + s.shadow + '.';
  }

  function capitalize(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  window.Data = {
    SIGNS: SIGNS,
    HOUSES: HOUSES,
    PLANETS: PLANETS,
    ASPECTS: ASPECTS,
    interpretNatal: interpretNatal,
    interpretTransit: interpretTransit,
    interpretAspect: interpretAspect,
    signMeaning: signMeaning,
    planetGlyph: function (name) { return (PLANETS[name] || {}).glyph || '?'; }
  };
})();
