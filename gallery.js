// ===== Three.js Curved Gallery Carousel =====
(() => {
  const CFG = {
    heightV: 0.62,
    gapRatio: 0.10,
    speed: 0.14,
    reverse: false,
    curve: 12.0,
    curveFreq: 2.0,
    imageRadius: 0,
    stagerV: 0,
    autoplay: true,
    hoverPause: true,
    dragEnabled: true,
    dragVertical: false,
    inertia: 0.94,
    dprMax: 1,
    anisotropy: 8,
    cardAspect: 1.5
  };

  const SOURCES = [
    'images/Wakaan 2024.jpg',
    'images/Rexaffects VJ shot 2018.jpg',
    'images/Rex and Rob Saatvic Terp Float 2024.jpg',
    'images/rexaffects rekinnection 23.jpg',
    'images/Backwoods Flintwick Boone from FOH pic0.jpg',
    'images/IMG_20240805_192326_888.jpg'
  ];

  const wrap = document.getElementById('gallery-carousel');
  if (!wrap) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, CFG.dprMax));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  wrap.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 100);
  camera.position.z = 2;

  const rail = new THREE.Group();
  scene.add(rail);

  let geom;
  function makeGeom() {
    const seg = Math.min(256, Math.max(32, Math.round(24 + CFG.curve * 1.2 + CFG.curveFreq * 12)));
    return new THREE.PlaneGeometry(1, 1, seg, seg);
  }
  function refreshGeom() {
    const newGeom = makeGeom();
    cards.forEach(m => m.geometry = newGeom);
    if (geom) geom.dispose();
    geom = newGeom;
  }
  geom = makeGeom();

  const vShader = `
    uniform float curve;
    uniform float curveFreq;
    uniform float viewHalfW;
    varying vec2 vUv;
    varying float vK;
    void main(){
      vUv = uv;
      vec3 p = position;
      vec4 world = modelMatrix * vec4(p,1.0);
      float dx  = abs(world.x);
      float dxn = clamp(dx / max(viewHalfW, 1e-6), 0.0, 1.0);
      float k   = 1.0 + (curve * 0.01) * pow(dxn, curveFreq);
      vK = k;
      p.y *= k;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
    }
  `;

  const fShader = `
    #if __VERSION__ < 300
    #extension GL_OES_standard_derivatives : enable
    #endif
    #include <common>
    uniform sampler2D map;
    uniform float imageRadius;
    uniform float texAspect;
    uniform float planeAspect;
    varying vec2 vUv;
    varying float vK;
    void main(){
      vec2 box = vec2(0.5) - imageRadius;
      vec2 q = abs(vUv - 0.5) - box;
      if (length(max(q, 0.0)) > imageRadius) discard;
      vec2 uv0 = vUv;
      uv0.y = (uv0.y - 0.5) / max(vK, 1e-6) + 0.5;
      float effPlaneAspect = planeAspect / max(vK, 1e-6);
      float sX = texAspect / effPlaneAspect;
      float kcover = max(sX, 1.0) * 1.0008;
      vec2 uvR = (uv0 - 0.5) * kcover + 0.5;
      float fw = 2.0 * max(fwidth(uvR.x), fwidth(uvR.y));
      vec2 uvSample = clamp(uvR, fw, 1.0 - fw);
      float edge = min(min(uvR.x, uvR.y), min(1.0 - uvR.x, 1.0 - uvR.y));
      float alpha = smoothstep(0.0, fw, edge);
      vec4 col = texture2D(map, uvSample);
      col.a *= alpha;
      gl_FragColor = col;
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `;

  const manager = new THREE.LoadingManager(() => wrap.classList.add('loaded'));
  const loader = new THREE.TextureLoader(manager);
  const textureCache = new Map();
  let cards = [];
  let widths = [];
  let cardH = 1;
  let gapW = 0.1;
  let viewHalfW = 1;

  const isFiniteNum = v => Number.isFinite(v) && !Number.isNaN(v);

  function viewportWorldWidth() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const h = 2 * Math.tan(vFov / 2) * camera.position.z;
    return h * (wrap.clientWidth / Math.max(1, wrap.clientHeight));
  }
  function viewportWorldHeight() {
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    return 2 * Math.tan(vFov / 2) * camera.position.z;
  }
  function pxToWorldX() { return viewportWorldWidth() / Math.max(1, wrap.clientWidth); }
  function pxToWorldY() { return viewportWorldHeight() / Math.max(1, wrap.clientHeight); }

  function safeAspect(tex) {
    const w = tex?.image?.width || 1600;
    const h = tex?.image?.height || 1067;
    const a = w / h;
    return isFiniteNum(a) && a > 0 ? a : 1;
  }

  function createCard(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = Math.min(CFG.anisotropy, renderer.capabilities.getMaxAnisotropy());
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        map: { value: tex },
        curve: { value: CFG.curve },
        curveFreq: { value: CFG.curveFreq },
        viewHalfW: { value: viewHalfW },
        imageRadius: { value: CFG.imageRadius },
        texAspect: { value: safeAspect(tex) },
        planeAspect: { value: CFG.cardAspect }
      },
      vertexShader: vShader,
      fragmentShader: fShader,
      toneMapped: true,
      transparent: true,
      alphaTest: 0.001,
      depthWrite: true
    });
    const mesh = new THREE.Mesh(geom, mat);
    mesh.frustumCulled = true;
    return mesh;
  }

  function setViewHalfWAll(v) {
    viewHalfW = v;
    cards.forEach(m => m.material.uniforms.viewHalfW.value = v);
  }

  function clearRail() {
    cards.forEach(m => { rail.remove(m); if (m.material) m.material.dispose(); });
    cards.length = 0;
    widths.length = 0;
  }

  async function loadTexture(src) {
    if (textureCache.has(src)) return textureCache.get(src);
    const tex = await new Promise((res, rej) => loader.load(src, res, undefined, rej));
    textureCache.set(src, tex);
    return tex;
  }

  async function buildBase(count) {
    clearRail();
    const list = SOURCES.slice(0, Math.max(1, Math.min(count, SOURCES.length)));
    const textures = await Promise.all(list.map(loadTexture));
    textures.forEach(tex => { const m = createCard(tex); rail.add(m); cards.push(m); });
    layout();
  }

  function layout() {
    const w = Math.max(1, wrap.clientWidth);
    const h = Math.max(1, wrap.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();

    const worldH = viewportWorldHeight();
    let hv = +CFG.heightV;
    if (!isFiniteNum(hv) || hv <= 0) hv = 0.62;
    cardH = worldH * hv;

    setViewHalfWAll(viewportWorldWidth() * 0.5);
    widths = cards.map(c => {
      const tex = c.material.uniforms.map.value;
      const tAsp = safeAspect(tex);
      const cw = cardH * CFG.cardAspect;
      c.scale.set(cw, cardH, 1);
      c.material.uniforms.texAspect.value = tAsp;
      c.material.uniforms.planeAspect.value = CFG.cardAspect;
      return cw;
    });

    const baseW = widths[0] || 1;
    gapW = baseW * (+CFG.gapRatio || 0);

    const numOriginal = cards.length;

    let cursor = 0;
    for (let i = 0; i < numOriginal; i++) {
      const cw = widths[i] || baseW;
      cards[i].position.set(cursor + cw / 2, 0, 0);
      cursor += cw + gapW;
    }

    rail.position.set(-cursor / 2, 0, 0);

    // Clone cards for infinite scroll
    const need = viewportWorldWidth() * 2.5;
    while (cursor < need && numOriginal) {
      for (let j = 0; j < numOriginal && cursor < need; j++) {
        const src = cards[j];
        const clone = createCard(src.material.uniforms.map.value);
        clone.scale.copy(src.scale);
        clone.material.uniforms.texAspect.value = src.material.uniforms.texAspect.value;
        clone.material.uniforms.planeAspect.value = src.material.uniforms.planeAspect.value;
        rail.add(clone);
        cards.push(clone);
        widths.push(clone.scale.x);
        const cw = clone.scale.x || baseW;
        clone.position.set(cursor + cw / 2, 0, 0);
        cursor += cw + gapW;
      }
    }
    rail.position.x = -cursor / 2;
  }

  function updateInfinite() {
    if (!cards.length) return;
    const vw = viewportWorldWidth();
    const leftEdge = -vw / 2 - 1.0;
    const rightEdge = vw / 2 + 1.0;

    let minI = 0, maxI = 0;
    for (let i = 1; i < cards.length; i++) {
      if (cards[i].position.x < cards[minI].position.x) minI = i;
      if (cards[i].position.x > cards[maxI].position.x) maxI = i;
    }
    const leftCard = cards[minI];
    const rightCard = cards[maxI];

    const leftWorldX = leftCard.position.x + rail.position.x;
    const rightWorldX = rightCard.position.x + rail.position.x;

    if (leftWorldX + leftCard.scale.x / 2 < leftEdge) {
      leftCard.position.x = rightCard.position.x + rightCard.scale.x / 2 + gapW + leftCard.scale.x / 2;
    }
    if (rightWorldX - rightCard.scale.x / 2 > rightEdge) {
      rightCard.position.x = leftCard.position.x - (leftCard.scale.x / 2 + gapW + rightCard.scale.x / 2);
    }
  }

  // Drag interaction
  let dragging = false, lastX = 0, lastY = 0, lastT = 0, velocity = 0, inertiaVel = 0;

  function onDown(e) {
    if (!CFG.dragEnabled) return;
    dragging = true;
    wrap.classList.add('dragging');
    const p = ('touches' in e) ? e.touches[0] : e;
    lastX = p.clientX; lastY = p.clientY; lastT = performance.now();
    velocity = 0; inertiaVel = 0;
  }
  function onMove(e) {
    if (!dragging) return;
    const p = ('touches' in e) ? e.touches[0] : e;
    const t = performance.now();
    const dxPx = p.clientX - lastX;
    const dt = Math.max(1, t - lastT) / 1000;
    const dxWorld = dxPx * pxToWorldX();
    const delta = CFG.dragVertical ? (p.clientY - lastY) * pxToWorldY() : dxWorld;

    rail.position.x += delta;
    velocity = delta / dt;
    updateInfinite();
    lastX = p.clientX; lastY = p.clientY; lastT = t;
    e.preventDefault();
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    wrap.classList.remove('dragging');
    inertiaVel = velocity;
  }

  wrap.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup', onUp, { passive: true });
  wrap.addEventListener('touchstart', onDown, { passive: true });
  window.addEventListener('touchmove', onMove, { passive: false });
  window.addEventListener('touchend', onUp, { passive: true });

  let hovered = false;
  wrap.addEventListener('pointerenter', () => hovered = true);
  wrap.addEventListener('pointerleave', () => hovered = false);

  // Animation loop
  let prev = 0;
  function animate(t) {
    const dt = Math.max(0, (t - prev) / 1000);
    prev = t;

    const canAuto = CFG.autoplay && !(CFG.hoverPause && hovered) && !dragging;
    if (canAuto) {
      const dir = CFG.reverse ? -1 : 1;
      rail.position.x -= dir * (+CFG.speed || 0) * dt;
    }

    if (!dragging && Math.abs(inertiaVel) > 1e-4) {
      rail.position.x += inertiaVel * dt;
      const perSecond = Math.pow(+CFG.inertia || 0.94, 60);
      inertiaVel *= Math.pow(perSecond, dt);
      if (Math.abs(inertiaVel) < 1e-4) inertiaVel = 0;
    }

    updateInfinite();
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
  }

  // Resize handling
  let resizeRAF;
  const resizeObserver = new ResizeObserver(() => {
    cancelAnimationFrame(resizeRAF);
    resizeRAF = requestAnimationFrame(() => {
      refreshGeom();
      layout();
    });
  });
  resizeObserver.observe(wrap);

  // Init
  (async function main() {
    await buildBase(SOURCES.length);
    animate(performance.now());
  })().catch(console.error);
})();
