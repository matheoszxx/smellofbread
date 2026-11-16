// =========================================================
// Cenas 3D: vitrine do topo (hero) e bandeja interativa.
// Todos os salgados são modelados no código, sem arquivos externos.
// =========================================================
import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const reduzido = matchMedia("(prefers-reduced-motion: reduce)").matches;
const toque = matchMedia("(pointer: coarse)").matches;
const PI = Math.PI;

function temWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (_) { return false; }
}

// ---------------------------------------------------------
// Texturas procedurais (relevo de empanado, massa e açúcar)
// ---------------------------------------------------------
function texturaCanvas(tam, desenhar) {
  const c = document.createElement("canvas");
  c.width = c.height = tam;
  desenhar(c.getContext("2d"), tam);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const pontos = (g, s, n, rMin, rMax, claro, escuro) => {
  for (let i = 0; i < n; i++) {
    const v = Math.random() < 0.5 ? escuro + Math.random() * 40 : claro + Math.random() * 40;
    g.fillStyle = `rgb(${v},${v},${v})`;
    g.beginPath();
    g.arc(Math.random() * s, Math.random() * s, rMin + Math.random() * (rMax - rMin), 0, PI * 2);
    g.fill();
  }
};

function criarTexturas() {
  const empanado = texturaCanvas(256, (g, s) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, s, s);
    pontos(g, s, 3200, 0.6, 2.8, 180, 40);
  });
  empanado.repeat.set(3, 3);

  const massa = texturaCanvas(256, (g, s) => {
    g.fillStyle = "#808080"; g.fillRect(0, 0, s, s);
    g.filter = "blur(3px)";
    pontos(g, s, 500, 3, 10, 150, 100);
    g.filter = "none";
    pontos(g, s, 600, 0.4, 1, 140, 110);
  });
  massa.repeat.set(2, 2);

  const acucar = texturaCanvas(256, (g, s) => {
    g.fillStyle = "#707070"; g.fillRect(0, 0, s, s);
    pontos(g, s, 5000, 0.4, 1.3, 200, 60);
  });
  acucar.repeat.set(4, 4);

  // Tábua: anéis de madeira de um tronco cortado
  const madeira = texturaCanvas(1024, (g, s) => {
    const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grad.addColorStop(0, "#7a4b2a");
    grad.addColorStop(0.75, "#5e3720");
    grad.addColorStop(1, "#3c2213");
    g.fillStyle = grad; g.fillRect(0, 0, s, s);
    for (let r = s / 2; r > 4; r -= 4 + Math.random() * 9) {
      const a = 0.12 + Math.random() * 0.28;
      g.strokeStyle = Math.random() < 0.7 ? `rgba(35,18,8,${a})` : `rgba(160,110,70,${a * 0.6})`;
      g.lineWidth = 0.8 + Math.random() * 2.4;
      g.beginPath();
      const fase = Math.random() * 10;
      for (let ang = 0; ang <= PI * 2 + 0.05; ang += 0.04) {
        const w = r + Math.sin(ang * 3 + fase) * r * 0.018 + Math.sin(ang * 9 + r) * 1.4;
        const x = s / 2 + Math.cos(ang) * w;
        const y = s / 2 + Math.sin(ang) * w;
        if (ang === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    // Rachaduras finas do centro para fora
    for (let i = 0; i < 5; i++) {
      const ang = Math.random() * PI * 2;
      g.strokeStyle = "rgba(25,12,5,0.35)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.moveTo(s / 2 + Math.cos(ang) * s * 0.08, s / 2 + Math.sin(ang) * s * 0.08);
      g.lineTo(s / 2 + Math.cos(ang + 0.03) * s * (0.2 + Math.random() * 0.2), s / 2 + Math.sin(ang + 0.03) * s * (0.2 + Math.random() * 0.2));
      g.stroke();
    }
  });
  madeira.wrapS = madeira.wrapT = THREE.ClampToEdgeWrapping;
  madeira.colorSpace = THREE.SRGBColorSpace;
  madeira.anisotropy = 8;

  const casca = texturaCanvas(512, (g, s) => {
    g.fillStyle = "#2e1a0e"; g.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i++) {
      g.strokeStyle = `rgba(${70 + Math.random() * 40},${40 + Math.random() * 20},${20},${0.3 + Math.random() * 0.4})`;
      g.lineWidth = 1 + Math.random() * 3;
      const y = Math.random() * s;
      g.beginPath(); g.moveTo(0, y); g.lineTo(s, y + (Math.random() - 0.5) * 8); g.stroke();
    }
  });
  casca.colorSpace = THREE.SRGBColorSpace;
  casca.repeat.set(6, 1);

  const brilho = texturaCanvas(64, (g, s) => {
    const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    r.addColorStop(0, "rgba(255,255,255,1)");
    r.addColorStop(0.35, "rgba(255,255,255,0.5)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r; g.fillRect(0, 0, s, s);
  });

  return { empanado, massa, acucar, madeira, casca, brilho };
}

// ---------------------------------------------------------
// Materiais
// ---------------------------------------------------------
function criarMateriais(tex) {
  return {
    frito: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0, bumpMap: tex.empanado, bumpScale: 4 }),
    assado: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, clearcoat: 0.7, clearcoatRoughness: 0.32, bumpMap: tex.massa, bumpScale: 0.9 }),
    pao: new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.45, bumpMap: tex.massa, bumpScale: 0.7 }),
    acucar: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, bumpMap: tex.acucar, bumpScale: 1.6 }),
  };
}

// ---------------------------------------------------------
// Geometrias dos salgados
// ---------------------------------------------------------
const cor = (hex) => new THREE.Color(hex);

// Pinta os vértices com um degradê vertical (base mais escura → topo)
function pintar(geo, base, topo = base, variacao = 0.05) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const ca = cor(base), cb = cor(topo), c = new THREE.Color();
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const alt = b.max.y - b.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - b.min.y) / alt;
    c.copy(ca).lerp(cb, t);
    const j = 1 + (Math.sin(pos.getX(i) * 37 + pos.getZ(i) * 53) * 0.5) * variacao;
    arr[i * 3] = c.r * j; arr[i * 3 + 1] = c.g * j; arr[i * 3 + 2] = c.b * j;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
  return geo;
}

function normalizar(geo, tamanho) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
  const d = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
  geo.scale(tamanho / d, tamanho / d, tamanho / d);
  geo.computeBoundingBox();
  return geo;
}

function torno(perfil, seg = 40) {
  const curva = new THREE.SplineCurve(perfil.map(([x, y]) => new THREE.Vector2(x, y)));
  const pts = curva.getPoints(64).map((p) => new THREE.Vector2(Math.max(0.0001, p.x), p.y));
  return new THREE.LatheGeometry(pts, seg);
}

function formaArredondada(pontosXY, raio) {
  const pts = pontosXY.map(([x, y]) => new THREE.Vector2(x, y));
  const s = new THREE.Shape();
  pts.forEach((p, i) => {
    const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
    const p1 = p.clone().add(a.clone().sub(p).normalize().multiplyScalar(raio));
    const p2 = p.clone().add(b.clone().sub(p).normalize().multiplyScalar(raio));
    if (i === 0) s.moveTo(p1.x, p1.y); else s.lineTo(p1.x, p1.y);
    s.quadraticCurveTo(p.x, p.y, p2.x, p2.y);
  });
  s.closePath();
  return s;
}

function extrudar(shape, profundidade = 0.12, bisel = 0.07) {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth: profundidade, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel * 0.85,
    bevelSegments: 6, curveSegments: 32, steps: 1,
  });
  g.rotateX(-PI / 2);
  g.computeVertexNormals();
  return g;
}

function criarFormas() {
  const F = {};
  const capsula = (r, c) => new THREE.CapsuleGeometry(r, c, 8, 20).rotateZ(PI / 2);

  F.coxinha = { mat: "frito", geo: pintar(normalizar(torno([
    [0, 0], [0.3, 0.02], [0.46, 0.12], [0.52, 0.28], [0.49, 0.46], [0.4, 0.64],
    [0.27, 0.84], [0.15, 1.0], [0.07, 1.12], [0, 1.18],
  ]), 0.52), "#5e2e0e", "#a86426") };

  F.bola = { mat: "frito", geo: pintar(normalizar(new THREE.SphereGeometry(0.5, 32, 20), 0.36), "#6a3712", "#b87430") };

  F.oval = { mat: "frito", geo: pintar(normalizar(new THREE.SphereGeometry(0.5, 32, 20).scale(1.35, 0.75, 0.95), 0.44), "#66340f", "#b06c2b") };

  F.quibe = { mat: "frito", geo: pintar(normalizar(torno([
    [0, 0], [0.18, 0.12], [0.3, 0.35], [0.33, 0.6], [0.3, 0.85], [0.18, 1.08], [0, 1.2],
  ]).rotateZ(PI / 2), 0.5), "#3f1f0c", "#6e3816") };

  F.croquete = { mat: "frito", geo: pintar(normalizar(capsula(0.2, 0.5), 0.48), "#64320f", "#ad6a2a") };

  F.rolo = { mat: "frito", geo: pintar(normalizar(capsula(0.15, 0.55), 0.5), "#6a3611", "#b5722e") };

  F.camarao = { mat: "frito", geo: pintar(normalizar(
    new THREE.TorusGeometry(0.22, 0.11, 16, 32, PI * 1.3).rotateX(-PI / 2), 0.44), "#6c3610", "#bb7a32") };

  const meiaLua = () => {
    const s = new THREE.Shape();
    s.moveTo(0.5, 0);
    s.absarc(0, 0, 0.5, 0, PI, false);
    s.closePath();
    return extrudar(s, 0.08, 0.08);
  };
  F.meialua = { mat: "frito", geo: pintar(normalizar(meiaLua(), 0.52), "#7e461a", "#c58a42") };
  F.pastelForno = { mat: "assado", geo: pintar(normalizar(meiaLua(), 0.52), "#b0702b", "#e0a24c") };

  F.travesseiro = { mat: "frito", geo: pintar(normalizar(
    extrudar(formaArredondada([[-0.36, -0.25], [0.36, -0.25], [0.36, 0.25], [-0.36, 0.25]], 0.13), 0.1, 0.09), 0.48), "#77421a", "#c08540") };

  F.esfirra = { mat: "assado", geo: pintar(normalizar(
    extrudar(formaArredondada([[0, 0.5], [-0.45, -0.28], [0.45, -0.28]], 0.14), 0.12, 0.08), 0.5), "#a8692a", "#e0a548") };

  F.enroladinho = { mat: "assado", geo: pintar(normalizar(capsula(0.16, 0.52), 0.5), "#a86a2c", "#e2a64e") };

  // Empada: corpo + tampa abaulada + borda
  {
    const corpo = new THREE.CylinderGeometry(0.42, 0.34, 0.3, 36, 1).translate(0, 0.15, 0);
    pintar(corpo, "#a7692a", "#d79a48");
    const tampa = new THREE.SphereGeometry(0.42, 36, 12, 0, PI * 2, 0, PI / 2).scale(1, 0.42, 1).translate(0, 0.3, 0);
    pintar(tampa, "#c8862f", "#e8b45c");
    const borda = new THREE.TorusGeometry(0.41, 0.05, 10, 48).rotateX(PI / 2).translate(0, 0.3, 0);
    pintar(borda, "#c07c2c", "#d8973f");
    F.empada = { mat: "assado", geo: normalizar(mergeGeometries([corpo, tampa, borda]), 0.42) };
  }

  // Barquete: casquinha + recheio cremoso
  {
    const casca = new THREE.SphereGeometry(0.5, 36, 14, 0, PI * 2, PI / 2, PI / 2).scale(1.55, 0.55, 0.72);
    pintar(casca, "#a2642a", "#dba04e");
    const recheio = new THREE.SphereGeometry(0.47, 36, 8, 0, PI * 2, 0, PI / 2).scale(1.5, 0.18, 0.68);
    pintar(recheio, "#c99a52", "#e4c07a", 0.1);
    F.barquete = { mat: "assado", geo: normalizar(mergeGeometries([casca, recheio]), 0.52) };
  }

  F.sonho = { mat: "acucar", geo: pintar(normalizar(new THREE.SphereGeometry(0.5, 32, 20).scale(1, 0.78, 1), 0.42), "#a87a45", "#eadbbd", 0.04) };

  F.pao = { mat: "pao", geo: pintar(normalizar(new THREE.SphereGeometry(0.5, 32, 20).scale(1, 0.74, 1), 0.38), "#b5793a", "#e2ad60") };

  F.paoHotdog = { mat: "pao", geo: pintar(normalizar(capsula(0.17, 0.5), 0.5), "#b8803f", "#e3b062") };

  // Mini hambúrguer: pão, carne, queijo e pão
  {
    const baixo = new THREE.CylinderGeometry(0.44, 0.4, 0.16, 36).translate(0, 0.08, 0);
    pintar(baixo, "#c99048", "#d9a45a");
    const carne = new THREE.CylinderGeometry(0.47, 0.47, 0.1, 36).translate(0, 0.21, 0);
    pintar(carne, "#3d2112", "#53301b");
    const queijo = new THREE.CylinderGeometry(0.48, 0.48, 0.03, 4).rotateY(PI / 4).translate(0, 0.275, 0);
    pintar(queijo, "#f1b631", "#f6c84a");
    const cima = new THREE.SphereGeometry(0.45, 36, 14, 0, PI * 2, 0, PI / 2).scale(1, 0.6, 1).translate(0, 0.29, 0);
    pintar(cima, "#c27f35", "#df9f4c");
    F.burger = { mat: "pao", geo: normalizar(mergeGeometries([baixo, carne, queijo, cima]), 0.44) };
  }

  Object.values(F).forEach((f) => { f.altura = f.geo.boundingBox.max.y; });
  return F;
}

// ---------------------------------------------------------
// Base comum dos renderizadores
// ---------------------------------------------------------
function criarRenderizador(canvas, sombras = false) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  r.setPixelRatio(Math.min(window.devicePixelRatio, toque ? 1.75 : 2));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 0.92;
  if (sombras) {
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
  }
  return r;
}

function ambiente(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  return env;
}

// Renderiza só quando o canvas está visível na tela
function quandoVisivel(el, aoMudar) {
  const io = new IntersectionObserver(([en]) => aoMudar(en.isIntersecting), { rootMargin: "100px" });
  io.observe(el);
}

const amortecer = (atual, alvo, velocidade, dt) => atual + (alvo - atual) * (1 - Math.exp(-velocidade * dt));

// ---------------------------------------------------------
// HERO: coxinha em destaque com salgados orbitando
// ---------------------------------------------------------
function cenaHero(canvas, formas, mats, tex) {
  const renderer = criarRenderizador(canvas);
  const cena = new THREE.Scene();
  cena.environment = ambiente(renderer);
  cena.environmentIntensity = 0.45;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.3, 9);

  const chave = new THREE.DirectionalLight("#ffd29c", 2.8);
  chave.position.set(3, 4, 5);
  const contra = new THREE.DirectionalLight("#ff8a3a", 5);
  contra.position.set(-4, 2.5, -4);
  const contra2 = new THREE.DirectionalLight("#ffb46a", 2.5);
  contra2.position.set(4, -1, -3);
  cena.add(chave, contra, contra2, new THREE.HemisphereLight("#ffe6c4", "#2a1406", 0.35));

  const raiz = new THREE.Group();
  cena.add(raiz);
  const grupo = new THREE.Group();
  raiz.add(grupo);

  // Peça principal
  const pivo = new THREE.Group();
  const principal = new THREE.Mesh(formas.coxinha.geo, mats.frito);
  principal.scale.setScalar(5);
  principal.position.y = -formas.coxinha.altura * 5 * 0.5;
  pivo.add(principal);
  pivo.rotation.z = -0.18;
  grupo.add(pivo);

  // Satélites
  const satelites = [
    ["bola", 2.25, 1.15, 0.0, 3.6],
    ["empada", 2.7, -0.9, 1.1, 3.6],
    ["esfirra", 2.4, 0.15, 2.2, 3.2],
    ["pao", 2.9, 1.55, 3.2, 3.4],
    ["camarao", 2.3, -1.55, 4.1, 3.6],
    ["sonho", 2.8, -0.1, 5.1, 3.2],
    ["barquete", 2.5, 0.95, 5.85, 3.0],
  ].map(([nome, raio, y, fase, escala]) => {
    const f = formas[nome];
    const m = new THREE.Mesh(f.geo, mats[f.mat]);
    m.scale.setScalar(escala * 0.42);
    m.geometry.computeBoundingBox();
    const g = new THREE.Group();
    m.position.y = -f.altura * escala * 0.42 * 0.5;
    g.add(m);
    g.rotation.set(Math.random() * 0.8, Math.random() * PI * 2, Math.random() * 0.6);
    grupo.add(g);
    return { g, raio, y, fase, giro: (Math.random() - 0.5) * 0.8 + 0.4 };
  });

  // Partículas douradas (farinha e calor no ar)
  const N = toque ? 160 : 320;
  const pos = new Float32Array(N * 3);
  const vel = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 12;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 8;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    vel[i] = 0.08 + Math.random() * 0.25;
  }
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const particulas = new THREE.Points(geoP, new THREE.PointsMaterial({
    size: 0.06, map: tex.brilho, color: "#f4cf8a", transparent: true, opacity: 0.75,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  }));
  cena.add(particulas);

  // Ponteiro e rolagem
  const alvo = { x: 0, y: 0 };
  const atual = { x: 0, y: 0 };
  if (!toque) {
    window.addEventListener("pointermove", (e) => {
      alvo.x = (e.clientX / innerWidth - 0.5) * 2;
      alvo.y = (e.clientY / innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  let largo = false;
  function redimensionar() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    largo = w / h > 1.05 && w >= 900;
    camera.position.z = largo ? 9 : 10.5;
    camera.updateProjectionMatrix();
    raiz.position.set(largo ? 2.35 : 0, largo ? -0.1 : 1.2, 0);
    raiz.scale.setScalar(largo ? 0.78 : 0.6);
  }
  new ResizeObserver(redimensionar).observe(canvas);
  redimensionar();

  const relogio = new THREE.Clock();
  let t = 0, primeiro = true;
  function quadro() {
    const dt = Math.min(relogio.getDelta(), 0.05);
    const vel0 = reduzido ? 0.15 : 1;
    t += dt * vel0;

    atual.x = amortecer(atual.x, alvo.x, 3, dt);
    atual.y = amortecer(atual.y, alvo.y, 3, dt);
    const rolagem = Math.min(window.scrollY / innerHeight, 1.2);

    pivo.rotation.y = t * 0.45;
    pivo.position.y = Math.sin(t * 1.1) * 0.08;
    grupo.rotation.y = atual.x * 0.35 + rolagem * 0.9;
    grupo.rotation.x = atual.y * 0.18 + rolagem * 0.25;

    satelites.forEach((s) => {
      const a = s.fase + t * 0.16;
      s.g.position.set(Math.cos(a) * s.raio, s.y + Math.sin(t * 0.9 + s.fase) * 0.14, Math.sin(a) * s.raio * 0.75);
      s.g.rotation.y += dt * s.giro * vel0;
      s.g.rotation.x += dt * s.giro * 0.4 * vel0;
    });

    const p = geoP.attributes.position;
    for (let i = 0; i < N; i++) {
      let y = p.getY(i) + vel[i] * dt * vel0;
      if (y > 4) y = -4;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.5 + i) * 0.0015);
    }
    p.needsUpdate = true;

    camera.position.y = 0.3 - rolagem * 1.2;
    camera.lookAt(0, -rolagem * 0.6, 0);

    renderer.render(cena, camera);
    if (primeiro) { canvas.classList.add("pronta"); primeiro = false; }
  }

  quandoVisivel(canvas, (vis) => {
    if (vis) relogio.getDelta();
    renderer.setAnimationLoop(vis ? quadro : null);
  });
}

// ---------------------------------------------------------
// BANDEJA: tábua de madeira que recebe as peças do pedido
// ---------------------------------------------------------
function cenaBandeja(canvas, container, formas, mats, tex) {
  const renderer = criarRenderizador(canvas, true);
  const cena = new THREE.Scene();
  cena.environment = ambiente(renderer);
  cena.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const alvoCamera = new THREE.Vector3(0, 0.1, 0);

  const chave = new THREE.DirectionalLight("#ffdcae", 2.2);
  chave.position.set(3, 7, 4);
  chave.castShadow = true;
  chave.shadow.mapSize.set(toque ? 1024 : 2048, toque ? 1024 : 2048);
  Object.assign(chave.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 20 });
  chave.shadow.bias = -0.0004;
  chave.shadow.normalBias = 0.02;
  chave.shadow.radius = 4;
  const contra = new THREE.DirectionalLight("#ff9446", 2.2);
  contra.position.set(-4, 3, -5);
  cena.add(chave, contra, new THREE.HemisphereLight("#ffe9cc", "#1d0e05", 0.45));

  const mesa = new THREE.Group();
  cena.add(mesa);

  // Tábua redonda
  const R = 2.6;
  const ESCALA_PECA = 1.6;
  const matTopo = new THREE.MeshStandardMaterial({ map: tex.madeira, color: "#9c8270", roughness: 0.62, metalness: 0, bumpMap: tex.madeira, bumpScale: 1.2 });
  const matLado = new THREE.MeshStandardMaterial({ map: tex.casca, roughness: 0.95, color: "#8a6a55" });
  const tabua = new THREE.Mesh(new THREE.CylinderGeometry(R, R * 0.97, 0.26, 128, 1), [matLado, matTopo, matLado]);
  tabua.position.y = -0.13;
  tabua.receiveShadow = true;
  mesa.add(tabua);

  // Sombra suave sob a tábua
  const sombra = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.25, 64),
    new THREE.MeshBasicMaterial({ map: tex.brilho, color: "#000000", transparent: true, opacity: 0.55, depthWrite: false })
  );
  sombra.rotation.x = -PI / 2;
  sombra.position.y = -0.27;
  cena.add(sombra);

  // Um InstancedMesh por forma
  const CAP = 180;
  const malhas = {};
  for (const [nome, f] of Object.entries(formas)) {
    const m = new THREE.InstancedMesh(f.geo, mats[f.mat], CAP);
    m.count = 0;
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.setColorAt(0, new THREE.Color(1, 1, 1));
    m.userData.indice = [];
    malhas[nome] = m;
    mesa.add(m);
  }

  // Estado das peças
  const pecas = new Map(); // chave -> peça
  let itensInfo = {};
  let destaque = null;

  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

  function atualizar({ itens }) {
    itensInfo = Object.fromEntries(itens.map((i) => [i.id, i]));
    const desejadas = [];
    itens.forEach((it) => { for (let k = 0; k < it.pecas; k++) desejadas.push({ chave: `${it.id}#${k}`, item: it }); });

    const N = desejadas.length;
    const passo = Math.min(0.42, (R - 0.55) / Math.sqrt(N + 0.6));
    const ouro = 2.39996323;
    const vivas = new Set();
    let novas = 0;

    desejadas.forEach(({ chave, item }, i) => {
      vivas.add(chave);
      const r = passo * Math.sqrt(i + 0.6);
      const a = i * ouro;
      const h = hash(chave);
      const alvo = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      let p = pecas.get(chave);
      if (!p || p.saindo) {
        const atraso = reduzido ? 0 : Math.min(novas, 30) * 0.035;
        novas++;
        p = {
          chave, id: item.id, forma: item.forma,
          pos: alvo.clone().add(new THREE.Vector3(0, reduzido ? 0 : 2.6 + h * 1.2, 0)),
          vy: 0, escala: reduzido ? 1 : 0.001, alvoEscala: 1, atraso,
          giro: h * PI * 2, inclinacao: (h - 0.5) * 0.25, rodando: (h - 0.5) * 6,
          caindo: !reduzido, saindo: false, alvo,
        };
        pecas.set(chave, p);
      }
      p.alvo.copy(alvo);
    });

    pecas.forEach((p) => {
      if (!vivas.has(p.chave) && !p.saindo) { p.saindo = true; p.alvoEscala = 0; }
    });
  }

  // Ponteiro: girar a tábua e mostrar o nome da peça
  const dica = container.querySelector("#dica-peca");
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let arrastando = false, moveu = 0, ultimoX = 0, velGiro = 0;
  let giroAuto = 0;

  function apontar(e) {
    const r = canvas.getBoundingClientRect();
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const hits = raio.intersectObjects(Object.values(malhas).filter((m) => m.count > 0), false);
    const hit = hits.find((h) => h.instanceId !== undefined);
    if (!hit) { dica.hidden = true; return null; }
    const chave = hit.object.userData.indice[hit.instanceId];
    const p = pecas.get(chave);
    const info = p && itensInfo[p.id];
    if (!info) { dica.hidden = true; return null; }
    dica.innerHTML = `${info.nome}<small>${info.q} unidades</small>`;
    dica.style.left = `${e.clientX - r.left}px`;
    dica.style.top = `${e.clientY - r.top}px`;
    dica.hidden = false;
    return p.id;
  }

  canvas.addEventListener("pointerdown", (e) => { arrastando = true; moveu = 0; ultimoX = e.clientX; });
  window.addEventListener("pointerup", (e) => {
    if (arrastando && moveu < 6 && e.target === canvas) {
      const id = apontar(e);
      destaque = id;
      if (toque) setTimeout(() => { dica.hidden = true; destaque = null; }, 1800);
    }
    arrastando = false;
  });
  canvas.addEventListener("pointermove", (e) => {
    if (arrastando) {
      const dx = e.clientX - ultimoX;
      ultimoX = e.clientX;
      moveu += Math.abs(dx);
      velGiro = dx * 0.006;
      mesa.rotation.y += velGiro;
      dica.hidden = true;
    } else if (!toque) {
      destaque = apontar(e);
    }
  });
  canvas.addEventListener("pointerleave", () => { if (!toque) { dica.hidden = true; destaque = null; } });
  if (!toque) canvas.style.cursor = "grab";

  document.addEventListener("encomenda:mudou", (e) => atualizar(e.detail));
  document.addEventListener("encomenda:destaque", (e) => { destaque = e.detail.id; });

  function redimensionar() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Enquadra a tábua inteira em qualquer proporção
    const elev = w / h > 1.6 ? 0.95 : 0.9;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    const dist = Math.max((R * 0.92) / Math.tan(vFov / 2), (R * 1.12) / Math.tan(hFov / 2));
    camera.position.set(0, Math.sin(elev) * dist, Math.cos(elev) * dist);
    alvoCamera.set(0, w / h > 1.6 ? -0.15 : 0.05, w / h > 1.6 ? 0.15 : 0.25);
    camera.lookAt(alvoCamera);
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(redimensionar).observe(container);
  redimensionar();

  // Inclinação suave seguindo o mouse
  const incl = { x: 0, alvo: 0 };
  if (!toque) {
    container.addEventListener("pointermove", (e) => {
      const r = container.getBoundingClientRect();
      incl.alvo = ((e.clientY - r.top) / r.height - 0.5) * 0.12;
    });
  }

  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), esc = new THREE.Vector3();
  const corNormal = new THREE.Color(1, 1, 1), corApagada = new THREE.Color(0.38, 0.33, 0.3), corTmp = new THREE.Color();
  const relogio = new THREE.Clock();
  let primeiro = true;

  function quadro() {
    const dt = Math.min(relogio.getDelta(), 0.05);

    // Giro automático lento + inércia do arraste
    if (!arrastando) {
      velGiro = amortecer(velGiro, 0, 3, dt);
      giroAuto = reduzido ? 0 : 0.08;
      mesa.rotation.y += velGiro + giroAuto * dt;
    }
    incl.x = amortecer(incl.x, incl.alvo, 4, dt);
    mesa.rotation.x = incl.x;

    Object.values(malhas).forEach((m) => { m.count = 0; m.userData.indice.length = 0; });

    for (const p of pecas.values()) {
      if (p.atraso > 0) { p.atraso -= dt; continue; }
      const f = formas[p.forma];
      const elevar = destaque && p.id === destaque ? 0.16 : 0;

      p.pos.x = amortecer(p.pos.x, p.alvo.x, 7, dt);
      p.pos.z = amortecer(p.pos.z, p.alvo.z, 7, dt);
      if (p.caindo) {
        p.vy -= 22 * dt;
        p.pos.y += p.vy * dt;
        if (p.pos.y <= 0) {
          p.pos.y = 0;
          p.vy = -p.vy * 0.32;
          if (p.vy < 0.6) { p.caindo = false; p.vy = 0; }
        }
        p.rodando = amortecer(p.rodando, 0, 2, dt);
        p.giro += p.rodando * dt;
      } else {
        p.pos.y = amortecer(p.pos.y, elevar, 10, dt);
      }
      p.escala = amortecer(p.escala, p.alvoEscala, p.saindo ? 10 : 14, dt);
      if (p.saindo && p.escala < 0.02) { pecas.delete(p.chave); continue; }

      const m = malhas[p.forma];
      if (m.count >= CAP) continue;
      eul.set(p.inclinacao, p.giro, p.inclinacao * 0.5);
      q.setFromEuler(eul);
      esc.setScalar(Math.max(p.escala, 0.001) * ESCALA_PECA);
      m4.compose(p.pos, q, esc);
      m.setMatrixAt(m.count, m4);
      corTmp.copy(destaque && p.id !== destaque ? corApagada : corNormal);
      m.setColorAt(m.count, corTmp);
      m.userData.indice[m.count] = p.chave;
      m.count++;
      void f;
    }

    Object.values(malhas).forEach((m) => {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    });

    renderer.render(cena, camera);
    if (primeiro) { canvas.classList.add("pronta"); primeiro = false; }
  }

  quandoVisivel(container, (vis) => {
    if (vis) relogio.getDelta();
    renderer.setAnimationLoop(vis ? quadro : null);
  });

  // Estado inicial (pedido salvo no aparelho)
  if (window.__encomenda) {
    const ini = window.__encomenda.estadoBandeja();
    atualizar(ini);
  }
}

// ---------------------------------------------------------
// Início
// ---------------------------------------------------------
if (!temWebGL()) {
  document.documentElement.classList.add("sem-3d");
} else {
  const tex = criarTexturas();
  const mats = criarMateriais(tex);
  const formas = criarFormas();
  cenaHero(document.getElementById("cena-hero"), formas, mats, tex);
  cenaBandeja(document.getElementById("cena-bandeja"), document.getElementById("bandeja"), formas, mats, tex);
}
