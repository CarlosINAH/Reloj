/* ============================================================================
   scene.js — Modelo HELIOCÉNTRICO del sistema solar (Three.js).
   Sol al centro, planetas orbitando con texturas de la NASA, la Luna orbitando
   la Tierra, rueda del zodiaco de referencia y líneas de aspecto (del clima
   geocéntrico) que conectan los cuerpos implicados. Global: `Scene`.
   ========================================================================== */
(function () {
  'use strict';
  var THREE = window.THREE;
  var R = Math.PI / 180;
  var VS = String.fromCharCode(0xFE0E);
  var GLYPH_FONT = '"Noto Sans Symbols2","Segoe UI Symbol","Apple Symbols",serif';

  var scene, camera, renderer, controls, container, loader;
  var sunMesh, moonMesh, zodiacGroup, orbitsGroup, aspectGroup, geoGroup, starField, sunLight;
  var planetObjs = {}, geoMarkers = {}, aspectLines = [], pickables = [];
  var raycaster, pointer = new THREE.Vector2(), hoverName = null, focusName = null;
  var moonGeoLon = 0, moonCur = 0;
  var cbs = { onHover: function () {}, onSelect: function () {} };

  // Planetas (heliocéntrico): radio de órbita de visualización + tamaño visible.
  var SPECS = [
    { name: 'Mercurio', tex: 'mercury.jpg', fb: 0xb5a642, radius: 20, size: 1.4, spin: 0.004 },
    { name: 'Venus',    tex: 'venus.jpg',   fb: 0xe8cda0, radius: 27, size: 2.2, spin: 0.002 },
    { name: 'Tierra',   tex: 'earth.png',   fb: 0x1b64c4, radius: 36, size: 2.4, spin: 0.01, earth: true },
    { name: 'Marte',    tex: 'mars.jpg',    fb: 0xff5533, radius: 45, size: 1.7, spin: 0.01 },
    { name: 'Júpiter',  tex: 'jupiter.jpg', fb: 0xdca271, radius: 62, size: 4.6, spin: 0.02 },
    { name: 'Saturno',  tex: 'saturn.jpg',  fb: 0xe6d38a, radius: 78, size: 3.9, spin: 0.018, ring: 'saturn_ring.jpg' },
    { name: 'Urano',    tex: 'uranus.jpg',  fb: 0x8ff0f0, radius: 94, size: 2.9, spin: 0.012 },
    { name: 'Neptuno',  tex: 'neptune.jpg', fb: 0x5a7bff, radius: 107, size: 2.8, spin: 0.012 },
    { name: 'Plutón',   tex: 'pluto.jpg',   fb: 0xbfa3a3, radius: 118, size: 1.2, spin: 0.006 }
  ];
  var SUN = { size: 8, tex: 'sun.jpg', fb: 0xffcc55 };
  var MOON = { radius: 5.5, size: 0.9, tex: 'moon.jpg', fb: 0xd8d8d8 };
  var Z_INNER = 130, Z_OUTER = 146;
  var GEO_R = Z_INNER - 8; // radio de los marcadores geocéntricos (en la rueda)

  function applyTex(mat, file, fallback) {
    mat.color.set(fallback);
    loader.load('assets/' + file, function (t) {
      if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      if (THREE.SRGBColorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4; mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
    }, undefined, function () {});
  }

  function labelSprite(glyph, name, color) {
    var W = 256, H = 132, c = document.createElement('canvas'); c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.textAlign = 'center'; ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 6;
    ctx.font = '70px ' + GLYPH_FONT; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
    ctx.fillText(glyph + VS, W / 2, 48);
    ctx.font = '600 30px "Segoe UI",system-ui,sans-serif'; ctx.fillStyle = '#eaeefb';
    ctx.fillText(name, W / 2, 104);
    var tx = new THREE.CanvasTexture(c); tx.anisotropy = 4;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false }));
    sp.renderOrder = 6; return sp;
  }

  // Sprite de solo glifo (para los marcadores del zodiaco).
  function glyphSprite(glyph, color) {
    var c = document.createElement('canvas'); c.width = 128; c.height = 128;
    var ctx = c.getContext('2d');
    ctx.font = '92px ' + GLYPH_FONT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.95)'; ctx.shadowBlur = 6; ctx.fillStyle = color;
    ctx.fillText(glyph + VS, 64, 66);
    var tx = new THREE.CanvasTexture(c); tx.anisotropy = 4;
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tx, transparent: true, depthTest: false }));
    sp.renderOrder = 7; return sp;
  }

  function onPlane(lonDeg, radius, y) {
    var a = lonDeg * R;
    return new THREE.Vector3(radius * Math.cos(a), y || 0, radius * Math.sin(a));
  }

  function init(el, callbacks) {
    container = el; cbs = Object.assign(cbs, callbacks || {});
    loader = new THREE.TextureLoader();
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02030a, 0.0010);

    camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 4000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding;
    if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.minDistance = 40; controls.maxDistance = 900;

    scene.add(new THREE.AmbientLight(0xffffff, 0.22)); // tenue: el Sol ilumina

    buildStars(); buildSun(); buildZodiac(); buildGeoMarkers();
    orbitsGroup = new THREE.Group(); scene.add(orbitsGroup);
    aspectGroup = new THREE.Group(); scene.add(aspectGroup);
    buildPlanets();

    raycaster = new THREE.Raycaster();
    renderer.domElement.addEventListener('pointermove', onMove);
    renderer.domElement.addEventListener('pointerdown', onDown);
    addEventListener('resize', onResize);

    setCameraMode('chart');
    animate();
  }

  function buildStars() {
    var n = 1800, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var r = 600 + Math.random() * 1100, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(ph) * Math.cos(th); p[i * 3 + 1] = r * Math.cos(ph); p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    starField = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 1.5, transparent: true, opacity: 0.7 }));
    scene.add(starField);
  }

  function buildSun() {
    sunLight = new THREE.PointLight(0xfff4e0, 2.6, 0, 0.2);
    scene.add(sunLight);
    var mat = new THREE.MeshBasicMaterial();
    applyTex(mat, SUN.tex, SUN.fb);
    sunMesh = new THREE.Mesh(new THREE.SphereGeometry(SUN.size, 48, 48), mat);
    sunMesh.userData = { planet: 'Sol' };
    sunMesh.add(new THREE.Mesh(new THREE.SphereGeometry(SUN.size * 1.35, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0.2, side: THREE.BackSide })));
    scene.add(sunMesh); pickables.push(sunMesh);
    var lbl = labelSprite('☉', 'Sol', '#ffd86b'); lbl.scale.set(13, 6.7, 1); lbl.position.set(0, SUN.size + 4, 0);
    sunMesh.add(lbl);
  }

  function buildZodiac() {
    zodiacGroup = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.RingGeometry(Z_INNER, Z_OUTER, 128),
      new THREE.MeshBasicMaterial({ color: 0x121432, side: THREE.DoubleSide, transparent: true, opacity: 0.45 }));
    ring.rotation.x = Math.PI / 2; zodiacGroup.add(ring);
    Data.SIGNS.forEach(function (s, i) {
      zodiacGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([onPlane(i * 30, Z_INNER, 0), onPlane(i * 30, Z_OUTER, 0)]),
        new THREE.LineBasicMaterial({ color: 0x3f4473 })));
      var sp = labelSprite(s.glyph, s.name, s.color);
      sp.position.copy(onPlane(i * 30 + 15, (Z_INNER + Z_OUTER) / 2, 2)); sp.scale.set(14, 7.1, 1);
      zodiacGroup.add(sp);
    });
    scene.add(zodiacGroup);
  }

  // Marcadores geocéntricos: dónde está cada astro visto DESDE LA TIERRA (su
  // signo). Van sobre la rueda; las líneas de aspecto se trazan entre ellos, así
  // que muestran el ángulo astrológico real.
  function buildGeoMarkers() {
    geoGroup = new THREE.Group(); scene.add(geoGroup);
    Astro.BODIES.forEach(function (name) {
      var disc = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xdfe6ff }));
      disc.userData = { planet: name };
      geoGroup.add(disc); pickables.push(disc);
      var g = glyphSprite(Data.glyph(name), '#ffffff'); g.scale.set(4.6, 4.6, 1);
      geoGroup.add(g);
      geoMarkers[name] = { disc: disc, label: g, curLon: 0, targetLon: 0 };
    });
  }

  function makeRing(file, inner, outer) {
    var geo = new THREE.RingGeometry(inner, outer, 96);
    var pos = geo.attributes.position, uv = geo.attributes.uv, v3 = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) { v3.fromBufferAttribute(pos, i); uv.setXY(i, (v3.length() - inner) / (outer - inner), 0.5); }
    var mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    applyTex(mat, file, 0xcbb78a);
    var mesh = new THREE.Mesh(geo, mat); mesh.rotation.x = Math.PI / 2 - 0.45; return mesh;
  }

  function buildPlanets() {
    SPECS.forEach(function (p) {
      var orbit = new THREE.Mesh(new THREE.RingGeometry(p.radius - 0.05, p.radius + 0.05, 160),
        new THREE.MeshBasicMaterial({ color: 0x2a315a, side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
      orbit.rotation.x = Math.PI / 2; orbitsGroup.add(orbit);

      var mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
      applyTex(mat, p.tex, p.fb);
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 48, 48), mat);
      mesh.userData = { planet: p.name };
      if (p.ring) mesh.add(makeRing(p.ring, p.size * 1.4, p.size * 2.3));
      scene.add(mesh); pickables.push(mesh);

      var glyph = p.earth ? '⊕' : Data.glyph(p.name);
      var label = labelSprite(glyph, p.name, '#ffffff');
      label.scale.set(12, 6.2, 1); label.position.set(0, p.size + 3, 0);
      mesh.add(label);

      // La Tierra lleva su órbita lunar.
      if (p.earth) {
        var mm = new THREE.MeshStandardMaterial({ roughness: 1 });
        applyTex(mm, MOON.tex, MOON.fb);
        moonMesh = new THREE.Mesh(new THREE.SphereGeometry(MOON.size, 32, 32), mm);
        moonMesh.userData = { planet: 'Luna' };
        scene.add(moonMesh); pickables.push(moonMesh);
        var ml = labelSprite('☽', 'Luna', '#d8e0ff'); ml.scale.set(8, 4.1, 1); ml.position.set(0, MOON.size + 1.6, 0);
        moonMesh.add(ml);
      }
      planetObjs[p.name] = { mesh: mesh, spec: p, curAngle: 0, targetLon: 0 };
    });
  }

  // ---------------- API ----------------
  // helio: {planetaES: lon heliocéntrica} para el modelo; geo: {astro: lon
  // geocéntrica} para los marcadores de la rueda; moonLon: lon geocéntrica Luna.
  function setPositions(helio, moonLon) {
    Object.keys(planetObjs).forEach(function (n) { if (helio[n] != null) planetObjs[n].targetLon = helio[n]; });
    if (moonLon != null) moonGeoLon = moonLon;
    if (sunLight) sunLight.position.set(0, 0, 0);
  }
  function setGeo(geoLons) {
    Object.keys(geoMarkers).forEach(function (n) { if (geoLons[n] != null) geoMarkers[n].targetLon = geoLons[n]; });
  }

  function endpoint(name) {
    return function () { return geoMarkers[name] ? geoMarkers[name].disc.position : null; };
  }

  function setAspectLines(specs) {
    aspectGroup.clear(); aspectLines = [];
    specs.forEach(function (s) {
      var geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      var base = s.minor ? 0.5 : 0.85;
      var line = new THREE.Line(geom, new THREE.LineBasicMaterial({
        color: s.color, transparent: true, opacity: base, blending: THREE.AdditiveBlending, depthWrite: false
      }));
      line.userData = { id: s.id, base: base, a: s.a, b: s.b, hi: false };
      aspectGroup.add(line);
      aspectLines.push({ line: line, phase: Math.random() * 6.28, getA: endpoint(s.a), getB: endpoint(s.b) });
    });
    applyFocus();
  }

  function highlightAspect(id, on) {
    aspectLines.forEach(function (al) { if (al.line.userData.id === id) al.line.userData.hi = on; });
  }

  function setFocus(name) { focusName = name; applyFocus(); }
  function applyFocus() {
    aspectLines.forEach(function (al) {
      var u = al.line.userData;
      u.dim = focusName && u.a !== focusName && u.b !== focusName;
    });
    var all = Object.keys(planetObjs).map(function (n) { return planetObjs[n].mesh; });
    if (sunMesh) all.push(sunMesh); if (moonMesh) all.push(moonMesh);
    all.forEach(function (m) {
      var nm = m.userData.planet;
      var rel = !focusName || nm === focusName || relatedToFocus(nm);
      m.material.transparent = !rel; m.material.opacity = rel ? 1 : 0.22;
    });
    // Marcadores de la rueda.
    Object.keys(geoMarkers).forEach(function (nm) {
      var mk = geoMarkers[nm];
      var rel = !focusName || nm === focusName || relatedToFocus(nm);
      mk.disc.material.transparent = !rel; mk.disc.material.opacity = rel ? 1 : 0.2;
      mk.label.material.opacity = rel ? 1 : 0.2;
    });
  }
  function relatedToFocus(n) {
    return aspectLines.some(function (al) { var u = al.line.userData; return (u.a === focusName && u.b === n) || (u.b === focusName && u.a === n); });
  }

  function setCameraMode(mode) {
    controls.target.set(0, 0, 0);
    if (mode === '3d') camera.position.set(0, 160, 260); else camera.position.set(0, 320, 0.01);
    controls.update();
  }

  // ---------------- Raycast ----------------
  function setPointer(ev) { var r = renderer.domElement.getBoundingClientRect(); pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1; pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1; }
  function pick() { raycaster.setFromCamera(pointer, camera); var h = raycaster.intersectObjects(pickables, false); return h.length ? h[0].object : null; }
  function onMove(ev) { setPointer(ev); var o = pick(); var name = o ? o.userData.planet : null; if (name !== hoverName) { hoverName = name; renderer.domElement.style.cursor = name ? 'pointer' : 'default'; } cbs.onHover(name, ev.clientX, ev.clientY); }
  function onDown(ev) { setPointer(ev); var o = pick(); cbs.onSelect(o ? o.userData.planet : null, ev.clientX, ev.clientY); }
  function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }

  function shortest(t, c) { var d = (t - c) % 6.28318; if (d > Math.PI) d -= 6.28318; if (d < -Math.PI) d += 6.28318; return d; }

  function animate() {
    requestAnimationFrame(animate);
    var earth = planetObjs['Tierra'];
    Object.keys(planetObjs).forEach(function (n) {
      var o = planetObjs[n];
      o.curAngle += shortest(o.targetLon * R, o.curAngle) * 0.14;
      o.mesh.position.x = o.spec.radius * Math.cos(o.curAngle);
      o.mesh.position.z = o.spec.radius * Math.sin(o.curAngle);
      o.mesh.rotation.y += o.spec.spin;
    });
    // La Luna orbita a la Tierra (dirección = longitud geocéntrica de la Luna).
    if (moonMesh && earth) {
      moonCur += shortest(moonGeoLon * R, moonCur) * 0.14;
      moonMesh.position.set(
        earth.mesh.position.x + MOON.radius * Math.cos(moonCur), 0,
        earth.mesh.position.z + MOON.radius * Math.sin(moonCur));
      moonMesh.rotation.y += 0.004;
    }
    if (sunMesh) sunMesh.rotation.y += 0.0012;
    if (starField) starField.rotation.y += 0.00004;

    // Marcadores geocéntricos sobre la rueda.
    Object.keys(geoMarkers).forEach(function (n) {
      var m = geoMarkers[n];
      m.curLon += shortest(m.targetLon * R, m.curLon) * 0.14;
      var cx = Math.cos(m.curLon), cz = Math.sin(m.curLon);
      m.disc.position.set(GEO_R * cx, 0, GEO_R * cz);
      m.label.position.set((GEO_R + 3.6) * cx, 1.2, (GEO_R + 3.6) * cz);
    });

    var tp = performance.now() * 0.0022;
    aspectLines.forEach(function (al) {
      var p1 = al.getA(), p2 = al.getB(); if (!p1 || !p2) return;
      var arr = al.line.geometry.attributes.position.array;
      arr[0] = p1.x; arr[1] = p1.y; arr[2] = p1.z; arr[3] = p2.x; arr[4] = p2.y; arr[5] = p2.z;
      al.line.geometry.attributes.position.needsUpdate = true;
      var u = al.line.userData;
      if (u.dim) al.line.material.opacity = 0.05;
      else if (u.hi) al.line.material.opacity = 1;
      else al.line.material.opacity = u.base * (0.72 + 0.28 * (0.5 + 0.5 * Math.sin(tp + al.phase)));
    });

    controls.update();
    renderer.render(scene, camera);
  }

  window.Scene = {
    init: init, setPositions: setPositions, setGeo: setGeo, setAspectLines: setAspectLines,
    highlightAspect: highlightAspect, setFocus: setFocus, setCameraMode: setCameraMode
  };
})();
