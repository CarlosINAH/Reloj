/* ============================================================================
   scene.js — Escena 3D del Clima Astral (Three.js).
   Tierra al centro, planetas con texturas de la NASA, rueda zodiacal, líneas de
   aspecto iluminadas e interacción (hover + clic para enfocar). Global: `Scene`.
   ========================================================================== */
(function () {
  'use strict';
  var THREE = window.THREE;
  var R = Math.PI / 180;
  var VS = String.fromCharCode(0xFE0E);
  var GLYPH_FONT = '"Noto Sans Symbols2","Segoe UI Symbol","Apple Symbols",serif';

  var scene, camera, renderer, controls, container, loader;
  var earthMesh, zodiacGroup, orbitsGroup, aspectGroup, starField, sunLight;
  var planetObjs = {}, aspectLines = [], pickables = [];
  var raycaster, pointer = new THREE.Vector2(), hoverName = null, focusName = null;
  var cbs = { onHover: function () {}, onSelect: function () {} };

  // Especificaciones geocéntricas (radio orbital visual, tamaño, textura, giro).
  var SPECS = [
    { name: 'Luna',     tex: 'moon.jpg',    fb: 0xd8d8d8, radius: 17, size: 1.9, spin: 0.004 },
    { name: 'Mercurio', tex: 'mercury.jpg', fb: 0xb5a642, radius: 25, size: 1.7, spin: 0.003 },
    { name: 'Venus',    tex: 'venus.jpg',   fb: 0xe8cda0, radius: 33, size: 2.5, spin: 0.002 },
    { name: 'Sol',      tex: 'sun.jpg',     fb: 0xffcc55, radius: 43, size: 6.6, spin: 0.001, isSun: true },
    { name: 'Marte',    tex: 'mars.jpg',    fb: 0xff5533, radius: 54, size: 2.0, spin: 0.004 },
    { name: 'Júpiter',  tex: 'jupiter.jpg', fb: 0xdca271, radius: 66, size: 5.0, spin: 0.006 },
    { name: 'Saturno',  tex: 'saturn.jpg',  fb: 0xe6d38a, radius: 80, size: 4.3, spin: 0.005, ring: 'saturn_ring.jpg' },
    { name: 'Urano',    tex: 'uranus.jpg',  fb: 0x8ff0f0, radius: 92, size: 3.2, spin: 0.003 },
    { name: 'Neptuno',  tex: 'neptune.jpg', fb: 0x5a7bff, radius: 102, size: 3.2, spin: 0.003 },
    { name: 'Plutón',   tex: 'pluto.jpg',   fb: 0xbfa3a3, radius: 110, size: 1.6, spin: 0.002 }
  ];
  var Z_INNER = 118, Z_OUTER = 132;

  // Carga la textura en mat.map; si falla (p. ej. en file://, WebGL bloquea las
  // imágenes locales), se queda el color de respaldo y los planetas igual se ven.
  function applyTex(mat, file, fallback) {
    mat.color.set(fallback);
    loader.load('assets/' + file, function (t) {
      if (THREE.sRGBEncoding !== undefined) t.encoding = THREE.sRGBEncoding;
      if (THREE.SRGBColorSpace !== undefined) t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 4; mat.map = t; mat.color.set(0xffffff); mat.needsUpdate = true;
    }, undefined, function () { /* respaldo: conserva mat.color */ });
  }

  function labelSprite(glyph, name, color) {
    var W = 256, H = 132, c = document.createElement('canvas');
    c.width = W; c.height = H;
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

  function pointOnPlane(lonDeg, radius, y) {
    var a = lonDeg * R;
    return new THREE.Vector3(radius * Math.cos(a), y || 0, radius * Math.sin(a));
  }

  function init(el, callbacks) {
    container = el; cbs = Object.assign(cbs, callbacks || {});
    loader = new THREE.TextureLoader();
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02030a, 0.0012);

    camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 3000);
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(innerWidth, innerHeight);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    if (THREE.sRGBEncoding !== undefined) renderer.outputEncoding = THREE.sRGBEncoding; // r128
    if (renderer.outputColorSpace !== undefined && THREE.SRGBColorSpace !== undefined) renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);

    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.minDistance = 60; controls.maxDistance = 700;

    scene.add(new THREE.AmbientLight(0xffffff, 0.5));

    buildStars(); buildEarth(); buildZodiac();
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
    var n = 1600, g = new THREE.BufferGeometry(), p = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var r = 500 + Math.random() * 900, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1);
      p[i * 3] = r * Math.sin(ph) * Math.cos(th); p[i * 3 + 1] = r * Math.cos(ph); p[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    starField = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fb4ff, size: 1.4, transparent: true, opacity: 0.7 }));
    scene.add(starField);
  }

  function buildEarth() {
    var mat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
    applyTex(mat, 'earth.png', 0x1b64c4);
    earthMesh = new THREE.Mesh(new THREE.SphereGeometry(5, 48, 48), mat);
    scene.add(earthMesh);
    // Leve atmósfera.
    var atmo = new THREE.Mesh(new THREE.SphereGeometry(5.3, 48, 48),
      new THREE.MeshBasicMaterial({ color: 0x3a7bd5, transparent: true, opacity: 0.12, side: THREE.BackSide }));
    scene.add(atmo);
  }

  function buildZodiac() {
    zodiacGroup = new THREE.Group();
    var ring = new THREE.Mesh(new THREE.RingGeometry(Z_INNER, Z_OUTER, 128),
      new THREE.MeshBasicMaterial({ color: 0x141634, side: THREE.DoubleSide, transparent: true, opacity: 0.5 }));
    ring.rotation.x = Math.PI / 2; zodiacGroup.add(ring);
    Data.SIGNS.forEach(function (s, i) {
      var start = i * 30, mid = i * 30 + 15;
      zodiacGroup.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([pointOnPlane(start, Z_INNER, 0), pointOnPlane(start, Z_OUTER, 0)]),
        new THREE.LineBasicMaterial({ color: 0x4a4f80 })));
      var sp = labelSprite(s.glyph, s.name, s.color);
      sp.position.copy(pointOnPlane(mid, (Z_INNER + Z_OUTER) / 2, 2)); sp.scale.set(14, 7.2, 1);
      zodiacGroup.add(sp);
    });
    scene.add(zodiacGroup);
  }

  function makeRing(file, inner, outer) {
    var geo = new THREE.RingGeometry(inner, outer, 96);
    var pos = geo.attributes.position, uv = geo.attributes.uv, v3 = new THREE.Vector3();
    for (var i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      uv.setXY(i, (v3.length() - inner) / (outer - inner), 0.5);
    }
    var mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    applyTex(mat, file, 0xcbb78a);
    var mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2 - 0.45;
    return mesh;
  }

  function buildPlanets() {
    sunLight = new THREE.PointLight(0xfff2d8, 2.4, 0, 0.6);
    scene.add(sunLight);
    SPECS.forEach(function (p) {
      var orbit = new THREE.Mesh(new THREE.RingGeometry(p.radius - 0.06, p.radius + 0.06, 128),
        new THREE.MeshBasicMaterial({ color: 0x252c4f, side: THREE.DoubleSide, transparent: true, opacity: 0.6 }));
      orbit.rotation.x = Math.PI / 2; orbitsGroup.add(orbit);

      var mat = p.isSun ? new THREE.MeshBasicMaterial() : new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
      applyTex(mat, p.tex, p.fb);
      var mesh = new THREE.Mesh(new THREE.SphereGeometry(p.size, 48, 48), mat);
      mesh.userData = { planet: p.name };
      if (p.isSun) {
        mesh.add(new THREE.PointLight(0xffe8b0, 1.1, 0));
        mesh.add(new THREE.Mesh(new THREE.SphereGeometry(p.size * 1.35, 32, 32),
          new THREE.MeshBasicMaterial({ color: 0xffcc55, transparent: true, opacity: 0.18, side: THREE.BackSide })));
      }
      if (p.ring) mesh.add(makeRing(p.ring, p.size * 1.35, p.size * 2.2));
      scene.add(mesh); pickables.push(mesh);

      var label = labelSprite(Data.glyph(p.name), p.name, '#ffffff');
      label.scale.set(12, 6.2, 1); label.position.set(0, p.size + 3.4, 0);
      mesh.add(label);

      planetObjs[p.name] = { mesh: mesh, spec: p, curAngle: 0, targetLon: 0 };
    });
  }

  // ---------------- API ----------------
  function setLongitudes(positions) {
    Object.keys(planetObjs).forEach(function (n) {
      if (positions[n] != null) planetObjs[n].targetLon = positions[n];
    });
    if (sunLight && planetObjs['Sol']) sunLight.position.copy(planetObjs['Sol'].mesh.position);
  }

  function endpoint(name) {
    return function () { return planetObjs[name] ? planetObjs[name].mesh.position : null; };
  }

  // specs: [{id, a, b, color, minor}]
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
    aspectLines.forEach(function (al) {
      if (al.line.userData.id === id) { al.line.userData.hi = on; }
    });
  }

  function setFocus(name) { focusName = name; applyFocus(); }
  function applyFocus() {
    aspectLines.forEach(function (al) {
      var rel = !focusName || al.line.userData.a === focusName || al.line.userData.b === focusName;
      al.line.userData.dim = focusName && !rel;
    });
    // Atenúa levemente los planetas no relacionados al enfocar.
    Object.keys(planetObjs).forEach(function (n) {
      var m = planetObjs[n].mesh;
      var rel = !focusName || n === focusName || relatedToFocus(n);
      m.material.opacity = rel ? 1 : 0.25;
      m.material.transparent = !rel;
    });
  }
  function relatedToFocus(n) {
    return aspectLines.some(function (al) {
      var u = al.line.userData;
      return (u.a === focusName && u.b === n) || (u.b === focusName && u.a === n);
    });
  }

  function setCameraMode(mode) {
    controls.target.set(0, 0, 0);
    if (mode === '3d') camera.position.set(0, 150, 230); else camera.position.set(0, 300, 0.01);
    controls.update();
  }

  // ---------------- Raycast ----------------
  function setPointer(ev) {
    var r = renderer.domElement.getBoundingClientRect();
    pointer.x = ((ev.clientX - r.left) / r.width) * 2 - 1;
    pointer.y = -((ev.clientY - r.top) / r.height) * 2 + 1;
  }
  function pick() {
    raycaster.setFromCamera(pointer, camera);
    var h = raycaster.intersectObjects(pickables, false);
    return h.length ? h[0].object : null;
  }
  function onMove(ev) {
    setPointer(ev); var o = pick(); var name = o ? o.userData.planet : null;
    if (name !== hoverName) { hoverName = name; renderer.domElement.style.cursor = name ? 'pointer' : 'default'; }
    cbs.onHover(name, ev.clientX, ev.clientY);
  }
  function onDown(ev) {
    setPointer(ev); var o = pick();
    cbs.onSelect(o ? o.userData.planet : null, ev.clientX, ev.clientY);
  }
  function onResize() { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); }

  function shortest(t, c) { var d = (t - c) % 6.28318; if (d > Math.PI) d -= 6.28318; if (d < -Math.PI) d += 6.28318; return d; }

  function animate() {
    requestAnimationFrame(animate);
    Object.keys(planetObjs).forEach(function (n) {
      var o = planetObjs[n];
      o.curAngle += shortest(o.targetLon * R, o.curAngle) * 0.14;
      o.mesh.position.x = o.spec.radius * Math.cos(o.curAngle);
      o.mesh.position.z = o.spec.radius * Math.sin(o.curAngle);
      o.mesh.rotation.y += o.spec.spin;
    });
    if (sunLight && planetObjs['Sol']) sunLight.position.copy(planetObjs['Sol'].mesh.position);
    earthMesh.rotation.y += 0.0015;
    if (starField) starField.rotation.y += 0.00005;

    var tp = performance.now() * 0.0022;
    aspectLines.forEach(function (al) {
      var p1 = al.getA(), p2 = al.getB(); if (!p1 || !p2) return;
      var arr = al.line.geometry.attributes.position.array;
      arr[0] = p1.x; arr[1] = p1.y; arr[2] = p1.z; arr[3] = p2.x; arr[4] = p2.y; arr[5] = p2.z;
      al.line.geometry.attributes.position.needsUpdate = true;
      var u = al.line.userData, b = u.base;
      if (u.dim) al.line.material.opacity = 0.05;
      else if (u.hi) al.line.material.opacity = 1;
      else al.line.material.opacity = b * (0.72 + 0.28 * (0.5 + 0.5 * Math.sin(tp + al.phase)));
    });

    controls.update();
    renderer.render(scene, camera);
  }

  window.Scene = {
    init: init, setLongitudes: setLongitudes, setAspectLines: setAspectLines,
    highlightAspect: highlightAspect, setFocus: setFocus, setCameraMode: setCameraMode
  };
})();
