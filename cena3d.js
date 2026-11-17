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
// t0/t1: faixa da altura onde a cor passa de "base" para "topo" (0 = fundo, 1 = topo)
function pintar(geo, base, topo = base, variacao = 0.05, t0 = 0, t1 = 1) {
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const ca = cor(base), cb = cor(topo), c = new THREE.Color();
  const pos = geo.attributes.position;
  const arr = new Float32Array(pos.count * 3);
  const alt = b.max.y - b.min.y || 1;
  for (let i = 0; i < pos.count; i++) {
    const t = Math.min(1, Math.max(0, ((pos.getY(i) - b.min.y) / alt - t0) / (t1 - t0)));
    c.copy(ca).lerp(cb, t * t * (3 - 2 * t));
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

// Massa recheada e estufada a partir de um contorno (ex.: meia-lua).
// contorno(s) -> [x, z] para s em [0,1); aperto(s) -> 0..1 diz onde a borda é fechada com garfo.
function massaRecheada(contorno, aperto, { altura = 0.14, base = 0.55, expo = 2.5, ondas = 0, amp = 0.012, bolhas = 0 } = {}) {
  const T = 120, RN = 16;
  const amostras = [];
  for (let j = 0; j < T; j++) amostras.push(contorno(j / T));
  const cx = amostras.reduce((s, p) => s + p[0], 0) / T;
  const cz = amostras.reduce((s, p) => s + p[1], 0) / T;

  const pos = [], uv = [], idx = [];
  [1, -1].forEach((face, f) => {
    for (let i = 0; i <= RN; i++) {
      const r = i / RN;
      for (let j = 0; j <= T; j++) {
        const s = (j % T) / T;
        const [bx, bz] = amostras[j % T];
        const x = cx + (bx - cx) * r, z = cz + (bz - cz) * r;
        const c = aperto(s);
        const rc = 1 - 0.22 * c;                                       // a borda apertada vira uma aba fina
        let h = altura * Math.sqrt(Math.max(0, 1 - Math.pow(Math.min(r / rc, 1), expo)));
        h = Math.max(h, 0.014 * c * (1 - Math.pow(r, 10)));
        if (bolhas) h *= 1 + bolhas * Math.max(0, Math.sin(x * 41) * Math.sin(z * 37) - 0.35);
        if (face < 0) h *= base;
        const ondinha = ondas && r > 0.76 ? Math.sin(s * ondas * PI * 2) * amp * c * ((r - 0.76) / 0.24) : 0;
        pos.push(x, face * h + ondinha, z);
        uv.push(r, s);
      }
    }
    const off = f * (RN + 1) * (T + 1);
    for (let i = 0; i < RN; i++) {
      for (let j = 0; j < T; j++) {
        const a = off + i * (T + 1) + j, b = a + 1, d = a + (T + 1), e = d + 1;
        if (face > 0) idx.push(a, b, d, b, e, d); else idx.push(a, d, b, b, d, e);
      }
    }
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Meia-lua: arco (borda apertada) + lado reto (dobra lisa)
const contornoMeiaLua = (s) => {
  if (s < 0.75) { const a = (s / 0.75) * PI; return [0.5 * Math.cos(a), 0.5 * Math.sin(a)]; }
  const t = (s - 0.75) / 0.25;
  return [-0.5 + t, 0];
};
const apertoMeiaLua = (s) => (s < 0.75 ? Math.min(1, Math.sin((s / 0.75) * PI) * 6) : 0);

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

  // Croquete: formato de torpedo, empanado
  F.croquete = { mat: "frito", geo: pintar(normalizar(torno([
    [0, 0], [0.11, 0.025], [0.185, 0.1], [0.2, 0.3], [0.185, 0.5], [0.11, 0.575], [0, 0.6],
  ]).rotateZ(PI / 2), 0.5), "#64320f", "#ad6a2a") };

  F.rolo = { mat: "frito", geo: pintar(normalizar(capsula(0.15, 0.55), 0.5), "#6a3611", "#b5722e") };

  // Banana real: pastel retangular fofo, pontas apertadas com garfo, coberto de canela e açúcar
  {
    const g = new THREE.SphereGeometry(1, 64, 32);
    const p = g.attributes.position;
    const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i < p.count; i++) {
      let x = sp(p.getX(i), 0.28), y = sp(p.getY(i), 0.75), z = sp(p.getZ(i), 0.42);
      const ponta = Math.max(0, (Math.abs(x) - 0.78) / 0.22);           // 0 no meio, 1 na ponta
      y *= 1 - 0.65 * ponta;                                             // ponta achatada
      y += Math.sign(y) * Math.sin(z * 48) * 0.15 * ponta;               // marcas do garfo
      y *= 1 + 0.07 * Math.sin(x * 9.3) * Math.sin(z * 7.1);             // irregularidade da massa
      p.setXYZ(i, x * 0.5, y * 0.11, z * 0.2);
    }
    g.computeVertexNormals();
    F.bananaReal = { mat: "acucar", geo: pintar(normalizar(g, 0.56), "#6e3f1e", "#a8703f", 0.08) };
  }

  // Camarão empanado: corpo curvado que afina até a cauda vermelha
  {
    const caminho = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.0, 0.0, 0.0),
      new THREE.Vector3(0.24, 0.0, -0.13),
      new THREE.Vector3(0.47, 0.0, 0.0),
      new THREE.Vector3(0.53, 0.02, 0.26),
      new THREE.Vector3(0.41, 0.05, 0.5),
      new THREE.Vector3(0.17, 0.1, 0.62),
    ]);
    const SEG = 72, RAD = 16;
    const raioEm = (t) => {
      const cabeca = 0.75 + 0.25 * Math.min(1, t / 0.08);
      return 0.175 * cabeca * (1 - 0.58 * Math.pow(t, 1.3));
    };
    const corpo = new THREE.TubeGeometry(caminho, SEG, 1, RAD, false);
    const p = corpo.attributes.position;
    const c = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i <= SEG; i++) {
      const t = i / SEG;
      caminho.getPointAt(t, c);
      // Empanado irregular: o raio varia um pouco em volta e ao longo do corpo
      for (let j = 0; j <= RAD; j++) {
        const k = i * (RAD + 1) + j;
        v.fromBufferAttribute(p, k).sub(c);
        const irregular = 1 + 0.07 * Math.sin(j * 2.3 + i * 0.9) * Math.cos(i * 0.45);
        v.multiplyScalar(raioEm(t) * irregular).add(c);
        p.setXYZ(k, v.x, v.y, v.z);
      }
    }
    corpo.computeVertexNormals();
    pintar(corpo, "#8a4612", "#cf8433", 0.08);

    const cabeca = new THREE.SphereGeometry(raioEm(0), 20, 14);
    caminho.getPointAt(0, c);
    cabeca.translate(c.x, c.y, c.z);
    pintar(cabeca, "#8a4612", "#c47a2e", 0.08);

    // Cauda: duas abas em leque, na cor do camarão
    const fim = caminho.getPointAt(1);
    const dir = caminho.getTangentAt(1).normalize();
    const giro = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const aba = (lado) => {
      const g = new THREE.ConeGeometry(0.11, 0.26, 12).scale(1, 1, 0.32).translate(0, 0.12, 0);
      g.rotateZ(lado * 0.45);
      g.applyQuaternion(giro);
      g.translate(fim.x - dir.x * 0.03, fim.y - dir.y * 0.03, fim.z - dir.z * 0.03);
      return pintar(g, "#b8361a", "#e46a35", 0.05);
    };
    F.camarao = { mat: "frito", geo: normalizar(mergeGeometries([corpo, cabeca, aba(1), aba(-1)]), 0.5) };
  }

  const meiaLua = () => {
    const s = new THREE.Shape();
    s.moveTo(0.5, 0);
    s.absarc(0, 0, 0.5, 0, PI, false);
    s.closePath();
    return extrudar(s, 0.08, 0.08);
  };
  F.meialua = { mat: "frito", geo: pintar(normalizar(meiaLua(), 0.52), "#7e461a", "#c58a42") };

  // Pastel frito: meia-lua estufada, borda marcada com garfo e bolhinhas de fritura
  F.pastel = { mat: "assado", geo: pintar(normalizar(
    massaRecheada(contornoMeiaLua, apertoMeiaLua, { altura: 0.1, expo: 2.2, ondas: 30, amp: 0.012, bolhas: 0.35 }), 0.54),
  "#b9783a", "#e6b36c", 0.07) };

  // Risole: meia-lua mais gordinha, sem garfo, toda empanada
  F.risole = { mat: "frito", geo: pintar(normalizar(
    massaRecheada(contornoMeiaLua, () => 0, { altura: 0.17, base: 0.7, expo: 2 }), 0.5),
  "#6e3a14", "#b9793a") };

  // Pastel de forno: meia-lua dourada e brilhante com borda apertada
  F.pastelForno = { mat: "assado", geo: pintar(normalizar(
    massaRecheada(contornoMeiaLua, apertoMeiaLua, { altura: 0.14, expo: 2.4, ondas: 22, amp: 0.014 }), 0.52),
  "#a8682a", "#e2a24c") };

  // Saltenha: oval em pé com a costura trançada (repulgue) no topo
  {
    const corpo = new THREE.SphereGeometry(0.5, 40, 24);
    const p = corpo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i);
      if (y < 0) y *= 0.45;                                // base achatada
      p.setXYZ(i, p.getX(i) * 1.0, y * 0.78, p.getZ(i) * 0.58);
    }
    corpo.computeVertexNormals();
    pintar(corpo, "#9c4f1f", "#d98c42", 0.05);
    const partes = [corpo];
    const N = 15;
    for (let k = 0; k < N; k++) {
      const t = (k / (N - 1)) * 2 - 1;                     // -1..1 ao longo do comprimento
      const x = t * 0.43;
      const y = 0.39 * Math.sqrt(Math.max(0, 1 - t * t * 0.92)) + 0.02;
      const dobra = new THREE.SphereGeometry(0.06, 10, 8).scale(0.8, 0.75, 1.15);
      dobra.rotateX(k % 2 ? 0.55 : -0.55);
      dobra.rotateZ(-t * 0.9);
      dobra.translate(x, y, 0);
      partes.push(pintar(dobra, "#b8662c", "#e7a456", 0.04));
    }
    F.saltenha = { mat: "assado", geo: normalizar(mergeGeometries(partes), 0.52) };
  }

  F.travesseiro = { mat: "frito", geo: pintar(normalizar(
    extrudar(formaArredondada([[-0.36, -0.25], [0.36, -0.25], [0.36, 0.25], [-0.36, 0.25]], 0.13), 0.1, 0.09), 0.48), "#77421a", "#c08540") };

  F.esfirra = { mat: "assado", geo: pintar(normalizar(
    extrudar(formaArredondada([[0, 0.5], [-0.45, -0.28], [0.45, -0.28]], 0.14), 0.12, 0.08), 0.5), "#a8692a", "#e0a548") };

  F.enroladinho = { mat: "assado", geo: pintar(normalizar(capsula(0.16, 0.52), 0.5), "#a86a2c", "#e2a64e") };

  // Enroladinho: massa enrolada em espiral, recheio aparecendo nas pontas,
  // topo dourado e brilhante, laterais claras e gergelim
  const enroladinhoCom = (corRecheio, corRecheio2, gergelim) => {
    const L = 0.32;
    const massa = torno([
      [0.1, -L], [0.17, -L + 0.012], [0.205, -L + 0.05], [0.222, -L + 0.12],
      [0.228, 0], [0.222, L - 0.12], [0.205, L - 0.05], [0.17, L - 0.012], [0.1, L],
    ], 48);
    const p = massa.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const r = Math.hypot(x, z);
      if (r < 0.15) continue;
      const th = Math.atan2(z, x);
      const fator = 1 + 0.05 * Math.sin(th + y * 15) + 0.02 * Math.sin(th * 3 - y * 9);  // dobra da espiral
      p.setXYZ(i, x * fator, y, z * fator);
    }
    massa.computeVertexNormals();
    massa.rotateZ(PI / 2);
    pintar(massa, "#efd4a0", "#cf8030", 0.05);

    const recheio = new THREE.CylinderGeometry(0.118, 0.118, L * 2 + 0.05, 28, 1).rotateZ(PI / 2);
    pintar(recheio, corRecheio, corRecheio2, 0.04);

    const partes = [massa, recheio];
    if (gergelim) {
      for (let s = 0; s < 14; s++) {
        const ang = (Math.random() - 0.5) * 1.6;            // em volta do topo
        const ao = (Math.random() - 0.5) * 0.46;            // ao longo do comprimento
        const sem = new THREE.SphereGeometry(0.016, 6, 4).scale(1.7, 0.55, 1);
        sem.rotateY(Math.random() * PI);
        sem.translate(ao, Math.cos(ang) * 0.232, Math.sin(ang) * 0.232);
        partes.push(pintar(sem, "#f1e3c2", "#f8eed8", 0.02));
      }
    }
    return normalizar(mergeGeometries(partes), 0.5);
  };
  F.enroladinhoSalsicha = { mat: "assado", geo: enroladinhoCom("#9a2c18", "#c2452a", true) };
  F.enroladinhoQP = { mat: "assado", geo: enroladinhoCom("#e0a08c", "#f1c27a", false) };

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

  // Sonho: bolinha com açúcar e o recheio saindo pelo corte da lateral
  const sonhoCom = (cor1, cor2) => {
    const massa = new THREE.SphereGeometry(0.5, 36, 22).scale(1, 0.78, 1);
    pintar(massa, "#a87a45", "#eadbbd", 0.04);
    const recheio = new THREE.TorusGeometry(0.47, 0.075, 10, 48, PI * 1.05).rotateX(PI / 2).rotateY(PI * 0.97);
    recheio.scale(1, 0.85, 1);
    pintar(recheio, cor1, cor2, 0.05);
    return normalizar(mergeGeometries([massa, recheio]), 0.42);
  };
  F.sonhoGoiabada = { mat: "acucar", geo: sonhoCom("#7c1a17", "#a8302a") };
  F.sonhoDoceLeite = { mat: "acucar", geo: sonhoCom("#a8692e", "#c98a48") };
  F.sonhoChocolate = { mat: "acucar", geo: sonhoCom("#2e160b", "#4a2614") };

  // ---------- Pãezinhos ----------
  // Corpo do pãozinho: base reta, laterais claras e altas, topo abaulado
  const PERFIL_PAO = [
    [0, 0], [0.4, 0], [0.47, 0.035], [0.5, 0.13], [0.505, 0.27], [0.47, 0.41],
    [0.38, 0.52], [0.22, 0.585], [0, 0.6],
  ];
  // Altura do topo no raio r, interpolando o próprio contorno (para apoiar coberturas)
  const TOPO_PAO = PERFIL_PAO.filter(([x, y]) => y >= 0.27).sort((a, b) => a[0] - b[0]);
  const alturaPao = (r) => {
    for (let i = 0; i < TOPO_PAO.length - 1; i++) {
      const [r0, y0] = TOPO_PAO[i], [r1, y1] = TOPO_PAO[i + 1];
      if (r <= r1) return y0 + (y1 - y0) * ((r - r0) / (r1 - r0)) + 0.012;
    }
    return 0.27;
  };
  const corpoPao = (lateral, topo, inicioTopo = 0.42) => {
    const g = torno(PERFIL_PAO, 48);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const th = Math.atan2(z, x);
      const f = 1 + 0.025 * Math.sin(th * 3 + 1) + 0.015 * Math.sin(th * 7);   // forma de pão feito à mão
      p.setXYZ(i, x * f, y * (1 + 0.03 * Math.sin(th * 2)), z * f);
    }
    g.computeVertexNormals();
    return pintar(g, lateral, topo, 0.05, inicioTopo, 0.75);
  };

  // Queijo ralado espalhado por cima (lascas finas)
  const ralado = (qtd, cores, raioMax, alcance = 0) => {
    const partes = [];
    for (let k = 0; k < qtd; k++) {
      const r = Math.sqrt(Math.random()) * raioMax;
      const a = Math.random() * PI * 2;
      const y = alturaPao(r) + 0.004 + Math.random() * 0.014;
      const lasca = new THREE.BoxGeometry(0.075 + Math.random() * 0.06, 0.012, 0.018);
      lasca.rotateZ((Math.random() - 0.5) * 0.6 - (r / 0.5) * 0.5 * Math.cos(a));
      lasca.rotateY(Math.random() * PI);
      lasca.translate(Math.cos(a) * r, y + alcance * Math.random(), Math.sin(a) * r);
      const sorte = Math.random();
      const corL = sorte < 0.04 ? cores[cores.length - 1] : sorte < 0.35 ? cores[Math.min(1, cores.length - 1)] : cores[0];
      partes.push(pintar(lasca, corL, corL, 0.06));
    }
    return partes;
  };

  // Gergelim no topo
  const gergelimPao = (qtd, raioMax) => {
    const partes = [];
    for (let k = 0; k < qtd; k++) {
      const r = Math.sqrt(Math.random()) * raioMax;
      const a = Math.random() * PI * 2;
      const s = new THREE.SphereGeometry(0.018, 6, 4).scale(1.7, 0.5, 1);
      s.rotateY(Math.random() * PI);
      s.translate(Math.cos(a) * r, alturaPao(r) + 0.003, Math.sin(a) * r);
      partes.push(pintar(s, "#f2e6c8", "#f8efd9", 0.03));
    }
    return partes;
  };

  // Pãozinho (tradicional, peito de peru, atum, frango, sem recheio): topo dourado e brilhante
  F.pao = { mat: "pao", geo: normalizar(corpoPao("#f1dca6", "#d6922f"), 0.4) };

  // Pãozinho de parmesão: igual, com parmesão ralado por cima
  F.paoParmesao = { mat: "pao", geo: normalizar(mergeGeometries([
    corpoPao("#f1dca6", "#d9962f"), ...ralado(120, ["#f8f3e2"], 0.38),
  ]), 0.4) };

  // Pãozinho de queijo cuia: massa clara coberta de queijo cuia ralado (amarelo com pontinhos vermelhos)
  F.paoCuia = { mat: "pao", geo: normalizar(mergeGeometries([
    corpoPao("#f4e8cc", "#efdcb0", 0.5),
    ...ralado(320, ["#eaa812", "#dc8f0a", "#c33a26"], 0.47, 0.03),
  ]), 0.42) };

  // Mini pão de hambúrguer: bola baixa e dourada com gergelim
  F.paoHamburguer = { mat: "pao", geo: normalizar(mergeGeometries([
    corpoPao("#efd9a6", "#d79c4a", 0.35), ...gergelimPao(22, 0.34),
  ]), 0.4) };

  // Mini pão de hot dog: pão alongado, topo marrom-dourado e laterais bem claras
  {
    const g = new THREE.SphereGeometry(1, 48, 28);
    const p = g.attributes.position;
    const sp = (v, e) => Math.sign(v) * Math.pow(Math.abs(v), e);
    for (let i = 0; i < p.count; i++) {
      let x = sp(p.getX(i), 0.3), y = sp(p.getY(i), 0.55), z = sp(p.getZ(i), 0.45);
      if (y < 0) y *= 0.55;                                      // base mais reta
      p.setXYZ(i, x * 0.5, y * 0.24, z * 0.27);
    }
    g.computeVertexNormals();
    F.paoHotdog = { mat: "pao", geo: normalizar(pintar(g, "#f3e5c8", "#bf7e3c", 0.04, 0.5, 0.8), 0.5) };
  }

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
// BANDEJA: tábua de madeira 3D.
// Vazia: vitrine com a coxinha e salgados flutuando.
// Com pedido: recebe uma peça para cada porção escolhida.
// ---------------------------------------------------------
function cenaBandeja(canvas, container, formas, mats, tex) {
  const renderer = criarRenderizador(canvas, true);
  const cena = new THREE.Scene();
  cena.environment = ambiente(renderer);
  cena.environmentIntensity = 0.5;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const chave = new THREE.DirectionalLight("#ffdcae", 2.2);
  chave.position.set(3, 7, 4);
  chave.castShadow = true;
  chave.shadow.mapSize.set(toque ? 1024 : 2048, toque ? 1024 : 2048);
  Object.assign(chave.shadow.camera, { left: -3.4, right: 3.4, top: 3.4, bottom: -3.4, near: 1, far: 20 });
  chave.shadow.bias = -0.0004;
  chave.shadow.normalBias = 0.02;
  chave.shadow.radius = 4;
  const contra = new THREE.DirectionalLight("#ff9446", 2.6);
  contra.position.set(-4, 3, -5);
  const contra2 = new THREE.DirectionalLight("#ffb46a", 1.4);
  contra2.position.set(4, 1, -4);
  cena.add(chave, contra, contra2, new THREE.HemisphereLight("#ffe9cc", "#1d0e05", 0.45));

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

  const sombra = new THREE.Mesh(
    new THREE.CircleGeometry(R * 1.25, 64),
    new THREE.MeshBasicMaterial({ map: tex.brilho, color: "#000000", transparent: true, opacity: 0.55, depthWrite: false })
  );
  sombra.rotation.x = -PI / 2;
  sombra.position.y = -0.27;
  cena.add(sombra);

  // ---------- Vitrine (bandeja vazia) ----------
  const vitrine = new THREE.Group();
  mesa.add(vitrine);

  const ESC_PRINCIPAL = 4.4;
  const altPrincipal = formas.coxinha.altura * ESC_PRINCIPAL;
  const pivo = new THREE.Group();
  const principal = new THREE.Mesh(formas.coxinha.geo, mats.frito);
  principal.scale.setScalar(ESC_PRINCIPAL);
  principal.position.y = -altPrincipal / 2;
  principal.castShadow = true;
  pivo.add(principal);
  pivo.rotation.z = -0.14;
  vitrine.add(pivo);

  const satelites = [
    ["bola", 1.85, 1.75, 0.0, 1.9],
    ["empada", 2.1, 0.75, 1.1, 2.0],
    ["esfirra", 1.9, 1.25, 2.2, 1.8],
    ["pao", 2.15, 2.05, 3.2, 1.9],
    ["camarao", 1.8, 0.65, 4.1, 2.0],
    ["sonho", 2.1, 1.55, 5.1, 1.8],
    ["barquete", 1.95, 2.3, 5.85, 1.7],
  ].map(([nome, raio, y, fase, escala]) => {
    const f = formas[nome];
    const m = new THREE.Mesh(f.geo, mats[f.mat]);
    m.scale.setScalar(escala);
    m.position.y = -f.altura * escala * 0.5;
    m.castShadow = true;
    const g = new THREE.Group();
    g.add(m);
    g.rotation.set(Math.random() * 0.8, Math.random() * PI * 2, Math.random() * 0.6);
    vitrine.add(g);
    return { g, raio, y, fase, giro: (Math.random() - 0.5) * 0.8 + 0.4 };
  });

  // Partículas douradas
  const NP = toque ? 90 : 160;
  const posP = new Float32Array(NP * 3);
  const velP = new Float32Array(NP);
  for (let i = 0; i < NP; i++) {
    const a = Math.random() * PI * 2, r = Math.random() * 3.2;
    posP[i * 3] = Math.cos(a) * r;
    posP[i * 3 + 1] = Math.random() * 3.4;
    posP[i * 3 + 2] = Math.sin(a) * r;
    velP[i] = 0.1 + Math.random() * 0.25;
  }
  const geoP = new THREE.BufferGeometry();
  geoP.setAttribute("position", new THREE.BufferAttribute(posP, 3));
  const matP = new THREE.PointsMaterial({
    size: 0.05, map: tex.brilho, color: "#f4cf8a", transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  vitrine.add(new THREE.Points(geoP, matP));

  // ---------- Peças do pedido ----------
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

  const pecas = new Map();
  let itensInfo = {};
  let destaque = null;
  let alvoPresenca = 1;
  let presenca = 1;

  const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };

  function atualizar({ itens }, instantaneo = false) {
    itensInfo = Object.fromEntries(itens.map((i) => [i.id, i]));
    alvoPresenca = itens.length ? 0 : 1;
    if (instantaneo) presenca = alvoPresenca;

    const desejadas = [];
    itens.forEach((it) => { for (let k = 0; k < it.pecas; k++) desejadas.push({ chave: `${it.id}#${k}`, item: it }); });

    const N = desejadas.length;
    const passo = Math.min(0.42, (R - 0.55) / Math.sqrt(N + 0.6));
    const ouro = 2.39996323;
    const vivas = new Set();
    // Se a vitrine ainda está na tela, espera ela sair antes das peças caírem
    const atrasoBase = presenca > 0.5 && !instantaneo ? 0.35 : 0;
    let novas = 0;

    desejadas.forEach(({ chave, item }, i) => {
      vivas.add(chave);
      const r = passo * Math.sqrt(i + 0.6);
      const a = i * ouro;
      const h = hash(chave);
      const alvo = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
      let p = pecas.get(chave);
      if (!p || p.saindo) {
        const semAnimacao = reduzido || instantaneo;
        p = {
          chave, id: item.id, forma: item.forma,
          pos: alvo.clone().add(new THREE.Vector3(0, semAnimacao ? 0 : 2.6 + h * 1.2, 0)),
          vy: 0, escala: semAnimacao ? 1 : 0.001, alvoEscala: 1,
          atraso: semAnimacao ? 0 : atrasoBase + Math.min(novas, 30) * 0.035,
          giro: h * PI * 2, inclinacao: (h - 0.5) * 0.25, rodando: (h - 0.5) * 6,
          caindo: !semAnimacao, saindo: false, alvo,
        };
        novas++;
        pecas.set(chave, p);
      }
      p.alvo.copy(alvo);
    });

    pecas.forEach((p) => {
      if (!vivas.has(p.chave) && !p.saindo) { p.saindo = true; p.alvoEscala = 0; }
    });
  }

  // ---------- Ponteiro: girar e identificar peças ----------
  const dica = container.querySelector("#dica-peca");
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();
  let arrastando = false, moveu = 0, ultimoX = 0, velGiro = 0;

  function apontar(e) {
    const r = canvas.getBoundingClientRect();
    ponteiro.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const hits = raio.intersectObjects(Object.values(malhas).filter((m) => m.count > 0), false);
    const hit = hits.find((h) => h.instanceId !== undefined);
    if (!hit) { dica.hidden = true; return null; }
    const p = pecas.get(hit.object.userData.indice[hit.instanceId]);
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
      destaque = apontar(e);
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

  const incl = { x: 0, alvo: 0 };
  if (!toque) {
    container.addEventListener("pointermove", (e) => {
      const r = container.getBoundingClientRect();
      incl.alvo = ((e.clientY - r.top) / r.height - 0.5) * 0.12;
    });
  }

  document.addEventListener("encomenda:mudou", (e) => atualizar(e.detail));
  document.addEventListener("encomenda:destaque", (e) => { destaque = e.detail.id; });

  // ---------- Câmera: enquadra a área visível do palco ----------
  // No celular o palco encolhe ao rolar (parte de cima sai da tela);
  // a câmera desloca e afasta para manter tudo dentro da parte visível.
  let W = 1, H = 1;
  function redimensionar() {
    W = container.clientWidth;
    H = container.clientHeight;
    if (!W || !H) return;
    renderer.setSize(W, H, false);
  }
  new ResizeObserver(redimensionar).observe(container);
  redimensionar();

  const olhar = new THREE.Vector3();
  function enquadrar(vitrineEase) {
    const rect = container.getBoundingClientRect();
    const escondido = Math.min(Math.max(0, -rect.top), H * 0.75);
    const v = Math.max(H - escondido, 60);
    const aspecto = W / v;

    camera.aspect = W / H;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const tanV = Math.tan(vFov / 2) * (v / H);
    const tanH = tanV * aspecto;

    // Com a vitrine, enquadra a tábua + os salgados flutuando
    const raioV = R * (0.92 + vitrineEase * 0.32);
    const raioH = R * (1.1 + vitrineEase * 0.04);
    const dist = Math.max(raioV / tanV, raioH / tanH);
    const elev = 0.9 - vitrineEase * 0.32;

    olhar.set(0, 0.05 + vitrineEase * 1.15, 0.25 - vitrineEase * 0.15);
    camera.position.set(0, olhar.y + Math.sin(elev) * dist, olhar.z + Math.cos(elev) * dist);
    camera.lookAt(olhar);
    camera.setViewOffset(W, H, 0, -escondido / 2, W, H);
    camera.updateProjectionMatrix();
  }

  // ---------- Animação ----------
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), eul = new THREE.Euler(), esc = new THREE.Vector3();
  const corNormal = new THREE.Color(1, 1, 1), corApagada = new THREE.Color(0.38, 0.33, 0.3);
  const relogio = new THREE.Clock();
  let t = 0, primeiro = true;

  function quadro() {
    const dt = Math.min(relogio.getDelta(), 0.05);
    const vel = reduzido ? 0.15 : 1;
    t += dt * vel;

    if (!arrastando) {
      velGiro = amortecer(velGiro, 0, 3, dt);
      mesa.rotation.y += velGiro + (reduzido ? 0 : 0.08) * dt;
    }
    incl.x = amortecer(incl.x, incl.alvo, 4, dt);
    mesa.rotation.x = incl.x;

    // Vitrine entra e sai
    presenca = amortecer(presenca, alvoPresenca, alvoPresenca ? 3 : 6, dt);
    const ease = presenca * presenca * (3 - 2 * presenca);
    vitrine.visible = presenca > 0.01;
    if (vitrine.visible) {
      vitrine.scale.setScalar(Math.max(ease, 0.001));
      vitrine.position.y = (1 - ease) * 1.4;
      matP.opacity = 0.7 * ease;
      pivo.rotation.y = t * 0.5;
      pivo.position.y = 0.45 + altPrincipal / 2 + Math.sin(t * 1.1) * 0.08;
      satelites.forEach((s) => {
        const a = s.fase + t * 0.2;
        s.g.position.set(Math.cos(a) * s.raio, s.y + Math.sin(t * 0.9 + s.fase) * 0.12, Math.sin(a) * s.raio);
        s.g.rotation.y += dt * s.giro * vel;
        s.g.rotation.x += dt * s.giro * 0.4 * vel;
      });
      const p = geoP.attributes.position;
      for (let i = 0; i < NP; i++) {
        let y = p.getY(i) + velP[i] * dt * vel;
        if (y > 3.6) y = 0;
        p.setY(i, y);
      }
      p.needsUpdate = true;
    }
    enquadrar(ease);

    // Peças
    Object.values(malhas).forEach((m) => { m.count = 0; m.userData.indice.length = 0; });
    for (const p of pecas.values()) {
      if (p.atraso > 0) { p.atraso -= dt; continue; }
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
      m.setColorAt(m.count, destaque && p.id !== destaque ? corApagada : corNormal);
      m.userData.indice[m.count] = p.chave;
      m.count++;
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

  // Estado inicial (pedido salvo no aparelho): sem animação de queda
  if (window.__encomenda) atualizar(window.__encomenda.estadoBandeja(), true);
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
  cenaBandeja(document.getElementById("cena-bandeja"), document.getElementById("bandeja"), formas, mats, tex);
}
