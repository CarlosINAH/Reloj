/* ============================================================================
   scene.js — Escena 3D geocéntrica (Three.js): rueda zodiacal fija, Tierra al
   centro, planetas en tránsito, marcadores natales, cúspides de casas, líneas
   de aspecto dinámicas e interacción por raycasting.
   Expone el objeto global `Scene`.
   ========================================================================== */
(function () {
  'use strict';

  var R = Math.PI / 180;
  var THREE = window.THREE;

  var scene, camera, renderer, controls, container;
  var earthMesh, zodiacGroup, housesGroup, natalGroup, aspectGroup, starField;
  var planetObjs = {};   // nombre -> { mesh, label, spec, curAngle, targetLon, retro }
  var natalMarkers = {}; // nombre -> mesh
  var aspectLines = [];  // { line, getA, getB, baseColor }
  var pickables = [];    // meshes con userData.planet / kind
  var raycaster, pointer = new THREE.Vector2();
  var hoverName = null;
  var hubEl = null; // tarjeta HTML del signo solar, anclada al centro de la carta
  var callbacks = { onHover: function () {}, onSelect: function () {} };

  // Radios de órbita (geocéntrico, puramente visual pero ordenado por distancia).
  var PLANET_SPECS = [
    { name: 'Luna',     color: 0xd8d8d8, size: 1.1, radius: 10 },
    { name: 'Mercurio', color: 0xb5a642, size: 0.9, radius: 15 },
    { name: 'Venus',    color: 0xffd9a0, size: 1.4, radius: 20 },
    { name: 'Sol',      color: 0xffcc33, size: 3.0, radius: 26, isSun: true },
    { name: 'Marte',    color: 0xff5533, size: 1.2, radius: 32 },
    { name: 'Júpiter',  color: 0xdca271, size: 2.6, radius: 38 },
    { name: 'Saturno',  color: 0xe6d38a, size: 2.3, radius: 44 },
    { name: 'Urano',    color: 0x8ff0f0, size: 1.8, radius: 50 },
    { name: 'Neptuno',  color: 0x5a7bff, size: 1.8, radius: 56 },
    { name: 'Plutón',   color: 0xbfa3a3, size: 0.9, radius: 60 }
  ];
  var Z_INNER = 63, Z_OUTER = 75, NATAL_RADIUS = 66;

  function specFor(name) {
    for (var i = 0; i < PLANET_SPECS.length; i++)
      if (PLANET_SPECS[i].name === name) return PLANET_SPECS[i];
    return null;
  }

  // --------- Sprites de texto (glifos y etiquetas) ----------
  var VS = String.fromCharCode(0xFE0E); // fuerza presentación de TEXTO (no emoji)
  // Fuente de símbolos astrológicos monocromos (no emoji).
  var GLYPH_FONT = '"Noto Sans Symbols2", "Segoe UI Symbol", "Apple Symbols", "DejaVu Sans", serif';

  function textSprite(text, color, px) {
    px = px || 66;
    var c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    var ctx = c.getContext('2d');
    ctx.font = px + 'px ' + GLYPH_FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = color;
    ctx.fillText(text + VS, 64, 68);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.renderOrder = 5;
    return sp;
  }

  // Etiqueta elegante: glifo grande + nombre debajo (una sola textura).
  function labelSprite(glyph, name, color) {
    var W = 256, H = 150;
    var c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.95)';
    ctx.shadowBlur = 6;
    // Glifo
    ctx.font = '86px ' + GLYPH_FONT;
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(glyph + VS, W / 2, 62);
    // Nombre
    ctx.font = '600 34px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#e8ecf7';
    ctx.fillText(name, W / 2, 126);
    var tex = new THREE.CanvasTexture(c);
    tex.anisotropy = 4;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
    sp.renderOrder = 6;
    sp.userData.ratio = W / H;
    return sp;
  }

  function pointOnPlane(lonDeg, radius, y) {
    var a = lonDeg * R;
    return new THREE.Vector3(radius * Math.cos(a), y || 0, radius * Math.sin(a));
  }

  // ----------------------------- init -----------------------------
  function init(el, cbs) {
    container = el;
    callbacks = Object.assign(callbacks, cbs || {});

    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02030a, 0.0016);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
    camera.position.set(0, 135, 148);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 40;
    controls.maxDistance = 400;

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));

    buildStarfield();
    buildEarth();
    buildZodiac();

    housesGroup = new THREE.Group(); scene.add(housesGroup);
    natalGroup = new THREE.Group(); scene.add(natalGroup);
    aspectGroup = new THREE.Group(); scene.add(aspectGroup);

    buildPlanets();

    raycaster = new THREE.Raycaster();
    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('resize', onResize);

    setCameraMode('chart'); // por defecto: vista tipo carta natal
    animate();
  }

  function buildStarfield() {
    var g = new THREE.BufferGeometry();
    var n = 1400, pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var r = 400 + Math.random() * 600;
      var th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph);
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    starField = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 1.3, sizeAttenuation: true, transparent: true, opacity: 0.7 }));
    scene.add(starField);
  }

  function buildEarth() {
    earthMesh = new THREE.Mesh(
      new THREE.SphereGeometry(3.4, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0x1b64c4, roughness: 0.55, emissive: 0x0a2246, emissiveIntensity: 0.5 })
    );
    scene.add(earthMesh);
  }

  function buildZodiac() {
    zodiacGroup = new THREE.Group();
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(Z_INNER, Z_OUTER, 96),
      new THREE.MeshBasicMaterial({ color: 0x141634, side: THREE.DoubleSide, transparent: true, opacity: 0.55 })
    );
    ring.rotation.x = Math.PI / 2;
    zodiacGroup.add(ring);

    Data.SIGNS.forEach(function (sign, i) {
      var start = i * 30, mid = i * 30 + 15;
      var a = start * R;
      var line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          pointOnPlane(start, Z_INNER, 0), pointOnPlane(start, Z_OUTER, 0)
        ]),
        new THREE.LineBasicMaterial({ color: 0x4a4f80 })
      );
      zodiacGroup.add(line);
      var sp = labelSprite(sign.glyph, sign.name, sign.color);
      sp.position.copy(pointOnPlane(mid, (Z_INNER + Z_OUTER) / 2, 2.5));
      sp.scale.set(10, 5.9, 1);
      zodiacGroup.add(sp);
    });
    scene.add(zodiacGroup);
  }

  function buildPlanets() {
    PLANET_SPECS.forEach(function (p) {
      // Órbita tenue.
      var orbit = new THREE.Mesh(
        new THREE.RingGeometry(p.radius - 0.08, p.radius + 0.08, 96),
        new THREE.MeshBasicMaterial({ color: 0x222a4d, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
      );
      orbit.rotation.x = Math.PI / 2;
      scene.add(orbit);

      var mat = p.isSun
        ? new THREE.MeshBasicMaterial({ color: p.color })
        : new THREE.MeshStandardMaterial({ color: p.color, roughness: 0.35, metalness: 0.1 });
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 28, 28), mat);
      mesh.userData = { planet: p.name, kind: 'transit' };
      if (p.isSun) mesh.add(new THREE.PointLight(0xffe0a0, 2.2, 500));
      scene.add(mesh);
      pickables.push(mesh);

      var label = labelSprite(Data.planetGlyph(p.name), p.name, '#ffffff');
      label.scale.set(9, 5.3, 1);
      label.position.set(0, p.size + 4.2, 0);
      mesh.add(label);

      planetObjs[p.name] = {
        mesh: mesh, label: label, spec: p,
        curAngle: 0, targetLon: 0, retro: false
      };
    });
  }

  // ----------------- API pública de datos -----------------

  // Coloca los planetas de tránsito en sus longitudes. positions: {nombre: grados}
  function setTransitLongitudes(positions, retroMap) {
    Object.keys(planetObjs).forEach(function (name) {
      if (positions[name] != null) planetObjs[name].targetLon = positions[name];
      var retro = retroMap && retroMap[name];
      planetObjs[name].retro = !!retro;
      setLabelColor(planetObjs[name], retro ? '#ff6b7a' : '#ffffff');
    });
  }

  function setLabelColor(obj, color) {
    if (obj._labelColor === color) return;
    obj._labelColor = color;
    var sp = labelSprite(Data.planetGlyph(obj.spec.name), obj.spec.name, color);
    obj.label.material.map = sp.material.map;
    obj.label.material.needsUpdate = true;
  }

  // Marcadores natales (rueda interior). positions: {nombre: grados} o null para ocultar.
  function setNatalMarkers(positions) {
    // limpiar
    natalGroup.clear();
    Object.keys(natalMarkers).forEach(function (k) {
      var idx = pickables.indexOf(natalMarkers[k]);
      if (idx >= 0) pickables.splice(idx, 1);
    });
    natalMarkers = {};
    if (!positions) return;

    Object.keys(positions).forEach(function (name) {
      var lon = positions[name];
      var g = new THREE.Group();
      var dotMat = new THREE.MeshBasicMaterial({ color: 0x00d4ff });
      var dot = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16), dotMat);
      dot.userData = { planet: name, kind: 'natal' };
      dot.position.copy(pointOnPlane(lon, NATAL_RADIUS, 0));
      g.add(dot);
      var label = textSprite(Data.planetGlyph(name), '#00d4ff', 56);
      label.scale.set(3.4, 3.4, 1);
      label.position.copy(pointOnPlane(lon, NATAL_RADIUS + 3.5, 1.5));
      g.add(label);
      natalGroup.add(g);
      natalMarkers[name] = dot;
      pickables.push(dot);
    });
  }

  function setNatalMarkersVisible(v) { natalGroup.visible = v; }

  // Dibuja cúspides de casas. houseData: { cusps:[12], asc, mc } o null.
  function setHouses(houseData) {
    housesGroup.clear();
    if (!houseData) return;
    var cusps = houseData.cusps;
    for (var i = 0; i < 12; i++) {
      var isAngle = (i === 0 || i === 3 || i === 6 || i === 9);
      var col = i === 0 ? 0x00d4ff : (i === 9 ? 0xff007f : (isAngle ? 0x6688cc : 0x2f3560));
      var line = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([
          new THREE.Vector3(0, 0, 0), pointOnPlane(cusps[i], Z_INNER, 0)
        ]),
        new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: isAngle ? 0.95 : 0.4 })
      );
      housesGroup.add(line);
      // Etiqueta de casa en el sector medio.
      var span = Astro.n360(cusps[(i + 1) % 12] - cusps[i]);
      var midLon = Astro.n360(cusps[i] + span / 2);
      var lbl = textSprite('' + (i + 1), '#8fa4d8', 46);
      lbl.scale.set(3.6, 3.6, 1);
      lbl.position.copy(pointOnPlane(midLon, 34, 1));
      housesGroup.add(lbl);
    }
    // Marcadores ASC / MC
    addAngleMarker(houseData.asc, 'AS', '#00d4ff');
    addAngleMarker(houseData.mc, 'MC', '#ff007f');
  }

  function addAngleMarker(lon, txt, color) {
    var lbl = textSprite(txt, color, 42);
    lbl.scale.set(4.2, 4.2, 1);
    lbl.position.copy(pointOnPlane(lon, Z_INNER - 4, 3));
    housesGroup.add(lbl);
  }

  // Reemplaza las líneas de aspecto. specs: [{a, b, kindA, kindB, color, minor, glow}]
  function setAspectLines(specs) {
    aspectGroup.clear();
    aspectLines = [];
    specs.forEach(function (s) {
      var geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      // En la sección de tránsito (glow) las líneas se iluminan y laten.
      var base = s.glow ? (s.minor ? 0.55 : 0.9) : (s.minor ? 0.2 : 0.45);
      var line = new THREE.Line(geom, new THREE.LineBasicMaterial({
        color: s.color, transparent: true, opacity: base,
        blending: s.glow ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: false
      }));
      line.userData.id = s.id;
      line.userData.base = base;
      line.userData.glow = !!s.glow;
      line.userData.hi = false;
      aspectGroup.add(line);
      aspectLines.push({
        line: line, phase: Math.random() * Math.PI * 2,
        getA: endpointGetter(s.a, s.kindA),
        getB: endpointGetter(s.b, s.kindB)
      });
    });
  }

  function endpointGetter(name, kind) {
    if (kind === 'natal') {
      return function () { return natalMarkers[name] ? natalMarkers[name].getWorldPosition(new THREE.Vector3()) : null; };
    }
    return function () { return planetObjs[name] ? planetObjs[name].mesh.position : null; };
  }

  function highlightAspect(id, on) {
    aspectLines.forEach(function (al) {
      if (al.line.userData.id === id) {
        al.line.userData.hi = on;
        al.line.material.opacity = on ? 1.0 : al.line.userData.base;
      }
    });
  }

  // ----------------------- Raycasting -----------------------
  function updatePointer(ev) {
    var rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function visibleChain(o) {
    while (o) { if (o.visible === false) return false; o = o.parent; }
    return true;
  }

  function pick() {
    raycaster.setFromCamera(pointer, camera);
    var hits = raycaster.intersectObjects(pickables, false);
    for (var i = 0; i < hits.length; i++) {
      if (visibleChain(hits[i].object)) return hits[i].object; // ignora marcadores ocultos
    }
    return null;
  }

  function onPointerMove(ev) {
    updatePointer(ev);
    var obj = pick();
    var name = obj ? obj.userData.planet : null;
    if (name !== hoverName) {
      hoverName = name;
      renderer.domElement.style.cursor = name ? 'pointer' : 'default';
    }
    callbacks.onHover(name, obj ? obj.userData.kind : null, ev.clientX, ev.clientY);
  }

  function onPointerDown(ev) {
    updatePointer(ev);
    var obj = pick();
    if (obj) callbacks.onSelect(obj.userData.planet, obj.userData.kind, ev.clientX, ev.clientY);
  }

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ----------------------- Bucle de render -----------------------
  function shortestDelta(target, cur) {
    var d = (target - cur) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
  }

  function animate() {
    requestAnimationFrame(animate);
    Object.keys(planetObjs).forEach(function (name) {
      var o = planetObjs[name];
      var targetRad = o.targetLon * R;
      o.curAngle += shortestDelta(targetRad, o.curAngle) * 0.14;
      o.mesh.position.x = o.spec.radius * Math.cos(o.curAngle);
      o.mesh.position.z = o.spec.radius * Math.sin(o.curAngle);
    });
    earthMesh.rotation.y += 0.0025;
    if (starField) starField.rotation.y += 0.00006;

    // Actualiza extremos de las líneas de aspecto y el latido de las iluminadas.
    var tp = performance.now() * 0.0022;
    aspectLines.forEach(function (al) {
      var p1 = al.getA(), p2 = al.getB();
      if (!p1 || !p2) return;
      var arr = al.line.geometry.attributes.position.array;
      arr[0] = p1.x; arr[1] = p1.y; arr[2] = p1.z;
      arr[3] = p2.x; arr[4] = p2.y; arr[5] = p2.z;
      al.line.geometry.attributes.position.needsUpdate = true;
      if (al.line.userData.glow && !al.line.userData.hi) {
        var b = al.line.userData.base;
        al.line.material.opacity = b * (0.72 + 0.28 * (0.5 + 0.5 * Math.sin(tp + al.phase)));
      }
    });

    controls.update();
    renderer.render(scene, camera);

    // Ancla la tarjeta del signo solar al centro (origen) de la carta.
    if (hubEl && hubEl.style.display !== 'none') {
      var v = new THREE.Vector3(0, 0, 0).project(camera);
      hubEl.style.left = ((v.x * 0.5 + 0.5) * window.innerWidth) + 'px';
      hubEl.style.top = ((-v.y * 0.5 + 0.5) * window.innerHeight) + 'px';
    }
  }

  function attachHub(el) { hubEl = el; }

  // Enfoca suavemente un planeta (para clic desde la lista).
  function focusPlanet(name) {
    var o = planetObjs[name];
    if (o) controls.target.lerp(o.mesh.position.clone().multiplyScalar(0.4), 0.5);
  }

  // Ángulo de cámara: 'chart' = cenital (parece una carta natal), '3d' = perspectiva.
  function setCameraMode(mode) {
    controls.target.set(0, 0, 0);
    if (mode === '3d') {
      camera.position.set(0, 118, 150);
    } else {
      camera.position.set(0, 210, 0.01); // casi cenital, mirando hacia abajo
    }
    controls.update();
  }

  window.Scene = {
    init: init,
    setTransitLongitudes: setTransitLongitudes,
    setNatalMarkers: setNatalMarkers,
    setNatalMarkersVisible: setNatalMarkersVisible,
    setHouses: setHouses,
    setAspectLines: setAspectLines,
    highlightAspect: highlightAspect,
    focusPlanet: focusPlanet,
    setCameraMode: setCameraMode,
    attachHub: attachHub
  };
})();
