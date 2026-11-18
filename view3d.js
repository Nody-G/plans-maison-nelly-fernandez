import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

let activeRenderer = null;
let activeAnimId = null;
const gltfLoader = new GLTFLoader();
const modelCache = new Map();

function loadGLB(name) {
  if (!modelCache.has(name)) {
    modelCache.set(
      name,
      new Promise((resolve, reject) => {
        gltfLoader.load(
          `./models/${name}.glb`,
          (gltf) => resolve(gltf.scene),
          undefined,
          (err) => reject(err)
        );
      })
    );
  }
  return modelCache.get(name);
}

// Textures procédurales légères pour enrichir sols et murs
function createWoodTexture(baseHex = "#d6b087", lineHex = "#b5895a") {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext("2d");
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 256, 256);
  ctx.strokeStyle = lineHex;
  ctx.lineWidth = 2;
  for (let y = 0; y < 256; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(256, y);
    ctx.stroke();
    const offset = (y / 32) % 2 === 0 ? 64 : 160;
    ctx.beginPath();
    ctx.moveTo(offset, y);
    ctx.lineTo(offset, y + 32);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTileTexture(baseHex = "#e2e8f0", groutHex = "#cbd5e1") {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext("2d");
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = groutHex;
  ctx.lineWidth = 3;
  for (let i = 0; i <= 128; i += 64) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i);
    ctx.lineTo(128, i);
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 6);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

window.disposeThree3DView = function () {
  if (activeAnimId) {
    cancelAnimationFrame(activeAnimId);
    activeAnimId = null;
  }
  if (activeRenderer) {
    activeRenderer.dispose();
    activeRenderer = null;
  }
};

window.renderThree3DView = function (container, state, getFloorData, categoryColors) {
  window.disposeThree3DView();

  container.innerHTML = `
    <div class="view3d-wrapper">
      <div class="view3d-controls">
        <span style="color:#475569;">🖱️ Glisser gauche : Pivoter • Clic droit : Déplacer • Molette : Zoomer</span>
        <label>Écartement :
          <input type="range" id="explode-slider" min="0" max="280" value="${state.view3d.explode}">
        </label>
        <select id="filter-3d-floor" class="btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">
          <option value="both" ${state.view3d.floorFilter === "both" ? "selected" : ""}>RDC + Étage</option>
          <option value="rdc" ${state.view3d.floorFilter === "rdc" ? "selected" : ""}>RDC seul</option>
          <option value="etage" ${state.view3d.floorFilter === "etage" ? "selected" : ""}>Étage seul</option>
        </select>
        <select id="filter-3d-walls" class="btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">
          <option value="full" ${(state.view3d.wallMode || "full") === "full" ? "selected" : ""}>Murs : Pleins</option>
          <option value="cut" ${state.view3d.wallMode === "cut" ? "selected" : ""}>Murs : Coupés (Sims)</option>
          <option value="glass" ${state.view3d.wallMode === "glass" ? "selected" : ""}>Murs : Transparents</option>
        </select>
        <select id="sun-month" class="btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;" title="Mois de l'année (Pélissanne 43.63° N)">
          <option value="1" ${state.view3d.sunMonth === 1 ? "selected" : ""}>Janvier</option>
          <option value="2" ${state.view3d.sunMonth === 2 ? "selected" : ""}>Février</option>
          <option value="3" ${state.view3d.sunMonth === 3 ? "selected" : ""}>Mars</option>
          <option value="4" ${state.view3d.sunMonth === 4 ? "selected" : ""}>Avril</option>
          <option value="5" ${state.view3d.sunMonth === 5 ? "selected" : ""}>Mai</option>
          <option value="6" ${(state.view3d.sunMonth || 6) === 6 ? "selected" : ""}>Juin</option>
          <option value="7" ${state.view3d.sunMonth === 7 ? "selected" : ""}>Juillet</option>
          <option value="8" ${state.view3d.sunMonth === 8 ? "selected" : ""}>Août</option>
          <option value="9" ${state.view3d.sunMonth === 9 ? "selected" : ""}>Septembre</option>
          <option value="10" ${state.view3d.sunMonth === 10 ? "selected" : ""}>Octobre</option>
          <option value="11" ${state.view3d.sunMonth === 11 ? "selected" : ""}>Novembre</option>
          <option value="12" ${state.view3d.sunMonth === 12 ? "selected" : ""}>Décembre</option>
        </select>
        <label style="display:inline-flex; align-items:center; gap:4px;">
          ☀️ <input type="range" id="sun-slider" min="6" max="22" step="0.5" value="${state.view3d.sunHour || 14}" style="width:70px;">
          <span id="sun-label" style="min-width:34px;">${state.view3d.sunHour || 14}h</span>
        </label>
        <label style="display:inline-flex; align-items:center; gap:4px; cursor:pointer;">
          <input type="checkbox" id="roof-toggle" ${state.view3d.showRoof ? "checked" : ""}> 🏠 Toiture
        </label>
        <button class="btn" id="top-3d-btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">Vue dessus</button>
        <button class="btn" id="reset-3d-btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">Vue Iso</button>
        <button class="btn btn-primary" id="walk-3d-btn" title="Se balader à pied dans les pièces et monter à l'étage">🚶 Visite 1ʳᵉ pers.</button>
      </div>
      <div id="three-mount" style="position:relative; flex:1; width:100%; min-height:0; overflow:hidden; background:#cbd5e1;">
        <div id="walk-crosshair" style="display:none; position:absolute; top:50%; left:50%; width:8px; height:8px; transform:translate(-50%,-50%); border:2px solid rgba(255,255,255,0.85); border-radius:50%; box-shadow:0 0 4px rgba(0,0,0,0.6); pointer-events:none; z-index:9;"></div>
        <div id="walk-lock-hint" style="display:none; position:absolute; top:16px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.86); color:#f8fafc; padding:8px 16px; border-radius:99px; font-size:12.5px; font-weight:600; z-index:10; pointer-events:none; border:1px solid #38bdf8;">
          Cliquez sur la vue pour verrouiller la souris (FPS) • Échap pour libérer
        </div>
        <canvas id="walk-minimap" width="132" height="180" style="display:none; position:absolute; top:14px; right:14px; border-radius:8px; border:2px solid #334155; background:rgba(255,255,255,0.92); box-shadow:0 6px 20px rgba(0,0,0,0.25); z-index:10; pointer-events:none;"></canvas>
        <div id="walk-touch-pad" style="display:none; position:absolute; bottom:76px; left:18px; width:104px; height:104px; border-radius:50%; background:rgba(15,23,42,0.55); border:2px solid rgba(255,255,255,0.4); z-index:11; touch-action:none;">
          <div id="walk-touch-knob" style="position:absolute; top:34px; left:34px; width:34px; height:34px; border-radius:50%; background:#38bdf8; pointer-events:none;"></div>
        </div>
        <div id="walk-hud" style="display:none; position:absolute; bottom:16px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.9); color:#f8fafc; padding:10px 16px; border-radius:99px; font-size:12px; font-weight:600; align-items:center; gap:12px; z-index:10; backdrop-filter:blur(6px); border:1px solid #475569; white-space:nowrap; flex-wrap:wrap;">
          <span id="walk-floor-badge" style="background:#0284c7; padding:3px 10px; border-radius:99px; font-size:11.5px;">Rez-de-Chaussée</span>
          <span><strong>ZQSD / Flèches</strong> : Marcher • <strong>Souris</strong> : Regarder</span>
          <label style="display:inline-flex; align-items:center; gap:6px;">
            POV :
            <input type="range" id="walk-fov-slider" min="50" max="105" value="75" style="width:76px; accent-color:#38bdf8;">
            <span id="walk-fov-val">75°</span>
          </label>
          <button class="btn" id="walk-stairs-btn" style="background:#0ea5e9; border-color:#38bdf8; color:#0f172a; padding:4px 10px;">⬆️ Monter à l'étage</button>
          <button class="btn" id="walk-exit-btn" style="padding:4px 10px;">Quitter</button>
        </div>
      </div>
    </div>
  `;

  const mount = document.getElementById("three-mount");
  const w = mount.clientWidth || 920;
  const h = mount.clientHeight || 620;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdbe4ee);
  scene.fog = new THREE.Fog(0xdbe4ee, 1800, 4500);

  const camera = new THREE.PerspectiveCamera(42, w / h, 2, 8000);
  camera.position.set(-550, 950, 1050);

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);
  activeRenderer = renderer;

  const resizeObserver = new ResizeObserver(() => {
    const nw = mount.clientWidth;
    const nh = mount.clientHeight;
    if (nw > 0 && nh > 0 && activeRenderer) {
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
  });
  resizeObserver.observe(mount);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 120, 0);
  controls.maxPolarAngle = Math.PI * 0.49;

  // Éclairage réaliste : HemisphereLight + Soleil avec ombres douces + lumière de débouchage
  const hemiLight = new THREE.HemisphereLight(0xf8fafc, 0x94a3b8, 0.78);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xfffbeb, 1.15);
  dirLight.position.set(650, 1300, 750);
  dirLight.target.position.set(0, 100, 0);
  scene.add(dirLight.target);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.bias = -0.0002;
  dirLight.shadow.normalBias = 2.5;
  dirLight.shadow.camera.near = 100;
  dirLight.shadow.camera.far = 3400;
  dirLight.shadow.camera.left = -850;
  dirLight.shadow.camera.right = 850;
  dirLight.shadow.camera.top = 850;
  dirLight.shadow.camera.bottom = -850;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xbae6fd, 0.35);
  fillLight.position.set(-600, 450, -500);
  scene.add(fillLight);

  // Calcul astronomique réel pour Pélissanne (43.63° N, 5.15° E)
  function updateSunPosition() {
    const hour = state.view3d.sunHour || 14;
    const month = state.view3d.sunMonth || 6;
    const isDST = month >= 4 && month <= 10; // Heure d'été (UTC+2) vs hiver (UTC+1)
    const utcOffset = isDST ? 2 : 1;
    // Jour de l'année au 15 du mois
    const dayOfYear = (month - 1) * 30.4 + 15;
    const declRad = (23.44 * Math.PI / 180) * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const latRad = (43.63 * Math.PI) / 180;

    // Heure solaire locale à Pélissanne (5.15° E = +0.343h par rapport à UTC)
    const solarTime = hour - utcOffset + 5.15 / 15;
    const hourAngle = ((solarTime - 12) * 15 * Math.PI) / 180;

    const sinElev = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngle);
    const elevRad = Math.asin(Math.max(-1, Math.min(1, sinElev)));
    const elevDeg = (elevRad * 180) / Math.PI;

    // Azimut mesuré depuis le Sud (négatif = Est/matin, positif = Ouest/soir)
    const cosAz = (Math.sin(elevRad) * Math.sin(latRad) - Math.sin(declRad)) / (Math.cos(elevRad) * Math.cos(latRad) + 1e-6);
    let azFromSouth = Math.acos(Math.max(-1, Math.min(1, cosAz)));
    if (hourAngle < 0) azFromSouth = -azFromSouth;

    // Orientation du bâtiment : +Y (Sud plan) correspond au Sud corrigé par northAngle
    const northRad = ((state.northAngle || 15) * Math.PI) / 180;
    const sceneAz = -azFromSouth - northRad;

    const dist = 1600;
    const clampedElev = Math.max(0.08, elevRad);
    dirLight.position.set(
      Math.sin(sceneAz) * Math.cos(clampedElev) * dist,
      Math.sin(clampedElev) * dist,
      Math.cos(sceneAz) * Math.cos(clampedElev) * dist
    );
    dirLight.updateMatrixWorld();
    dirLight.target.updateMatrixWorld();

    if (elevDeg <= 2) {
      // Nuit / Crépuscule : couper les ombres rasantes qui glitchent et passer en ambiance nocturne douce
      dirLight.intensity = 0;
      dirLight.castShadow = false;
      hemiLight.intensity = 0.42;
      scene.background.setHex(0x1e293b);
      scene.fog.color.setHex(0x1e293b);
    } else {
      dirLight.castShadow = true;
      const factor = Math.min(1, (elevDeg - 2) / 25);
      dirLight.intensity = 0.45 + factor * 0.85;
      const warmth = 1 - factor;
      dirLight.color.setHSL(0.11 - warmth * 0.04, 0.15 + warmth * 0.55, 0.98 - warmth * 0.12);
      hemiLight.intensity = 0.55 + factor * 0.25;
      scene.background.setHex(0xdbe4ee);
      scene.fog.color.setHex(0xdbe4ee);
    }
  }
  window.updateSun3D = updateSunPosition;
  updateSunPosition();

  const grid = new THREE.GridHelper(2200, 22, 0x94a3b8, 0xcbd5e1);
  grid.position.y = -14;
  scene.add(grid);

  const woodTexDay = createWoodTexture("#e8cda8", "#cca576");
  const woodTexNight = createWoodTexture("#d9c2a3", "#b89c78");
  const tileTexWater = createTileTexture("#d8f3ee", "#b2e2da");
  const tileTexCirc = createTileTexture("#e8edf2", "#cbd5e1");

  const rdcGroup = new THREE.Group();
  const etageGroup = new THREE.Group();
  const roofGroup = new THREE.Group();
  scene.add(rdcGroup);
  scene.add(etageGroup);
  scene.add(roofGroup);

  // Toiture provençale 2 pentes (tuiles terre cuite)
  function buildRoof() {
    roofGroup.clear();
    const gableShape = new THREE.Shape();
    gableShape.moveTo(-475, 0);
    gableShape.lineTo(475, 0);
    gableShape.lineTo(0, 155);
    gableShape.closePath();

    const extrude = new THREE.ExtrudeGeometry(gableShape, { depth: 700, bevelEnabled: false });
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 });
    const gableMesh = new THREE.Mesh(extrude, wallMat);
    gableMesh.rotation.y = Math.PI / 2;
    gableMesh.position.set(-350, 0, 0);
    gableMesh.castShadow = true;
    gableMesh.receiveShadow = true;
    roofGroup.add(gableMesh);

    const slopeLen = Math.hypot(495, 165);
    const slopeAng = Math.atan2(165, 495);
    const tileMat = new THREE.MeshStandardMaterial({ color: 0xc26a4a, roughness: 0.8 });

    [-1, 1].forEach((side) => {
      const geo = new THREE.BoxGeometry(730, 14, slopeLen);
      const mesh = new THREE.Mesh(geo, tileMat);
      mesh.position.set(0, 82, side * 245);
      mesh.rotation.x = side * slopeAng;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      roofGroup.add(mesh);
    });
  }
  buildRoof();

  const wallColliders = { rdc: [], etage: [] };
  const interactiveDoors = []; // { pivot, planX, planY, floor, closedRot, openRot, currentRot }
  let activeColliderKey = "rdc";

  function addBox(parent, x, y, zH, bw, bd, bh, color, opacity = 1, isWall = false) {
    if (isWall && bh >= 100) {
      wallColliders[activeColliderKey].push({ x1: x, y1: y, x2: x + bw, y2: y + bd });
    }
    const wallMode = state.view3d.wallMode || "full";
    const finalOpacity = isWall && wallMode === "glass" ? 0.25 : opacity;
    const geo = new THREE.BoxGeometry(bw, bh, bd);
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: finalOpacity < 1 ? 0.2 : (isWall ? 0.88 : 0.72),
      metalness: finalOpacity < 1 ? 0.08 : 0.04,
      transparent: finalOpacity < 1,
      opacity: finalOpacity,
      depthWrite: finalOpacity === 1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x - 330 + bw / 2, zH + bh / 2, y - 450 + bd / 2);
    if (finalOpacity === 1) {
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }
    parent.add(mesh);

    if ((finalOpacity === 1 || isWall) && (bw >= 20 || bd >= 20)) {
      const edges = new THREE.EdgesGeometry(geo);
      const line = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: isWall && wallMode === "glass" ? 0.16 : 0.22 })
      );
      mesh.add(line);
    }
    return mesh;
  }

  function mx(x, bw = 0) {
    return state.mirrored ? 660 - x - bw : x;
  }

  function buildHWallWithOpenings(parent, yWall, thick, xStart, xEnd, wallH, wallColor, openings) {
    const sorted = [...openings].sort((a, b) => a.x - b.x);
    let cur = xStart;
    sorted.forEach((op) => {
      if (op.x > cur) {
        addBox(parent, cur, yWall, 0, op.x - cur, thick, wallH, wallColor, 1, true);
      }
      const sillH = Math.min(wallH, op.type === "window-high" ? 135 : op.type === "window" ? 90 : 0);
      const topH = Math.min(wallH, 210);
      if (sillH > 0) {
        addBox(parent, op.x, yWall, 0, op.w, thick, sillH, wallColor, 1, true);
      }
      if (wallH > topH) {
        addBox(parent, op.x, yWall, topH, op.w, thick, wallH - topH, wallColor, 1, true);
      }
      if (op.type === "entry-door") {
        addBox(parent, op.x, yWall + thick / 2 - 3, 0, op.w, 6, topH, 0x0284c7, 1, true);
      } else if (topH > sillH) {
        addBox(parent, op.x, yWall + thick / 2 - 2, sillH, op.w, 4, topH - sillH, 0x38bdf8, 0.35);
        addBox(parent, op.x, yWall + thick / 2 - 4, sillH, op.w, 8, 5, 0x0369a1);
        if (wallH >= 210) {
          addBox(parent, op.x, yWall + thick / 2 - 4, topH - 5, op.w, 8, 5, 0x0369a1);
        }
      }
      cur = Math.max(cur, op.x + op.w);
    });
    if (cur < xEnd) {
      addBox(parent, cur, yWall, 0, xEnd - cur, thick, wallH, wallColor, 1, true);
    }
  }

  function addHingedDoor(parent, hingeX, hingeY, width, orient, dir, doorH = 202, floorKey = "rdc") {
    const pivot = new THREE.Group();
    pivot.position.set(hingeX - 330, 0, hingeY - 450);

    const doorGeo = new THREE.BoxGeometry(width, doorH, 4);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.55 });
    const doorMesh = new THREE.Mesh(doorGeo, doorMat);
    doorMesh.castShadow = true;
    doorMesh.receiveShadow = true;

    const edges = new THREE.EdgesGeometry(doorGeo);
    doorMesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.45 })));

    let openAngle = 0;
    if (orient === "v") {
      const signZ = dir.endsWith("up") ? 1 : -1;
      doorMesh.rotation.y = Math.PI / 2;
      doorMesh.position.set(0, doorH / 2, signZ * (width / 2));
      const openLeft = dir.startsWith("left");
      openAngle = (openLeft ? -1 : 1) * (signZ > 0 ? 1.35 : -1.35);
    } else {
      const signX = dir.endsWith("left") ? 1 : -1;
      doorMesh.position.set(signX * (width / 2), doorH / 2, 0);
      const openDown = dir.startsWith("down");
      openAngle = (openDown ? -1 : 1) * (signX > 0 ? 1.35 : -1.35);
    }

    // En vue maquette 3D, les portes sont ouvertes à ~45° ; en mode visite elles s'ouvrent quand on approche !
    const defaultRot = openAngle * 0.52;
    pivot.rotation.y = defaultRot;
    pivot.add(doorMesh);
    parent.add(pivot);

    interactiveDoors.push({
      pivot,
      planX: hingeX,
      planY: hingeY,
      floor: floorKey,
      closedRot: 0,
      openRot: openAngle,
      defaultRot,
      currentRot: defaultRot
    });
  }

  function buildPartitionWithDoors(parent, part, doors, wallH, color, floorKey) {
    const [px, py, pw, ph] = part;
    const isVert = ph > pw;
    const doorH = Math.min(wallH, 202);

    if (isVert) {
      const matching = doors.filter((d) => d.orient === "v" && Math.abs(d.x - px) <= 8 && d.y >= py && d.y < py + ph).sort((a, b) => a.y - b.y);
      let cur = py;
      matching.forEach((d) => {
        if (d.y > cur) addBox(parent, px, cur, 0, pw, d.y - cur, wallH, color, 1, true);
        if (wallH > 204) addBox(parent, px, d.y, 204, pw, d.w, wallH - 204, color, 1, true);
        const isLeft = d.dir.startsWith("left");
        const isUp = d.dir.endsWith("up");
        const hingeX = isLeft ? px : px + pw;
        const hingeY = isUp ? d.y : d.y + d.w;
        addHingedDoor(parent, hingeX, hingeY, d.w, "v", d.dir, doorH, floorKey);
        cur = d.y + d.w;
      });
      if (cur < py + ph) addBox(parent, px, cur, 0, pw, py + ph - cur, wallH, color, 1, true);
    } else {
      const matching = doors.filter((d) => d.orient === "h" && Math.abs(d.y - py) <= 8 && d.x >= px && d.x < px + pw).sort((a, b) => a.x - b.x);
      let cur = px;
      matching.forEach((d) => {
        if (d.x > cur) addBox(parent, cur, py, 0, d.x - cur, ph, wallH, color, 1, true);
        if (wallH > 204) addBox(parent, d.x, py, 204, d.w, ph, wallH - 204, color, 1, true);
        const isDown = d.dir.startsWith("down");
        const isLeft = d.dir.endsWith("left");
        const hingeX = isLeft ? d.x : d.x + d.w;
        const hingeY = isDown ? py + ph : py;
        addHingedDoor(parent, hingeX, hingeY, d.w, "h", d.dir, doorH, floorKey);
        cur = d.x + d.w;
      });
      if (cur < px + pw) addBox(parent, cur, py, 0, px + pw - cur, ph, wallH, color, 1, true);
    }
  }

  function placeGLB(parent, name, x, y, zH, targetW, targetD, targetH, rotY = 0) {
    loadGLB(name)
      .then((template) => {
        const obj = template.clone(true);
        obj.rotation.y = rotY;
        obj.updateMatrixWorld(true);

        const box = new THREE.Box3().setFromObject(obj);
        const size = new THREE.Vector3();
        box.getSize(size);

        const sx = targetW && size.x > 0 ? targetW / size.x : 1;
        const sy = targetH && size.y > 0 ? targetH / size.y : 1;
        const sz = targetD && size.z > 0 ? targetD / size.z : 1;
        const uniform = targetH ? sy : Math.min(sx, sz);
        obj.scale.set(targetW ? sx : uniform, targetH ? sy : uniform, targetD ? sz : uniform);
        obj.updateMatrixWorld(true);

        const scaledBox = new THREE.Box3().setFromObject(obj);
        const center = new THREE.Vector3();
        scaledBox.getCenter(center);

        const destX = x - 330 + (targetW ? targetW / 2 : 0);
        const destZ = y - 450 + (targetD ? targetD / 2 : 0);
        obj.position.x += destX - center.x;
        obj.position.z += destZ - center.z;
        obj.position.y += zH - scaledBox.min.y;

        obj.traverse((child) => {
          if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        parent.add(obj);
      })
      .catch((err) => console.warn(`Modèle ${name} non chargé:`, err));
  }

  function addBed(parent, x, y, bw, bd, pillowTop = true) {
    const bx = mx(x, bw);
    const modelName = bw >= 135 && bd >= 135 ? "bedDouble" : "bedSingle";
    let rotY = 0;
    if (!pillowTop) {
      rotY = state.mirrored ? -Math.PI / 2 : Math.PI / 2;
    }
    placeGLB(parent, modelName, bx, y, 0, bw, bd, 75, rotY);
  }

  function addStair(parent, cx, cy, totalH) {
    const poleGeo = new THREE.CylinderGeometry(10, 10, totalH + 20, 16);
    const pole = new THREE.Mesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.3 }));
    pole.position.set(cx - 330, (totalH + 20) / 2, cy - 450);
    pole.castShadow = true;
    parent.add(pole);

    const steps = 14;
    const radius = 84;
    for (let i = 0; i < steps; i++) {
      const ang = (i * (Math.PI * 1.65)) / steps - Math.PI * 0.85;
      const stepH = (i / steps) * totalH;
      const stepGeo = new THREE.BoxGeometry(radius - 10, 6, 26);
      const step = new THREE.Mesh(stepGeo, new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.55 }));
      step.position.set(cx - 330 + Math.cos(ang) * (radius / 2), stepH + 3, cy - 450 + Math.sin(ang) * (radius / 2));
      step.rotation.y = -ang;
      step.castShadow = true;
      step.receiveShadow = true;
      parent.add(step);
    }
  }

  function buildLevel(parent, floorKey, isUpper) {
    const fData = getFloorData(floorKey);
    const wallH = state.view3d.wallMode === "cut" ? 82 : 240;
    const wallColor = isUpper ? 0xeef6ff : 0xf4f6f8;
    const partColor = isUpper ? 0xdbeafe : 0xe8edf2;

    if (isUpper && fData.stair) {
      const scx = fData.stair.cx - 330;
      const scz = -(fData.stair.cy - 450);
      const sr = fData.stair.radius || 85;

      const slabShape = new THREE.Shape();
      slabShape.moveTo(-330, 450);
      slabShape.lineTo(330, 450);
      slabShape.lineTo(330, -450);
      slabShape.lineTo(-330, -450);
      slabShape.closePath();

      const hole = new THREE.Path();
      hole.absarc(scx, scz, sr, 0, Math.PI * 2, true);
      slabShape.holes.push(hole);

      const extrudeGeo = new THREE.ExtrudeGeometry(slabShape, { depth: 12, bevelEnabled: false, curveSegments: 32 });
      const slabMesh = new THREE.Mesh(extrudeGeo, new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.78 }));
      slabMesh.rotation.x = -Math.PI / 2;
      slabMesh.position.y = -12;
      slabMesh.receiveShadow = true;
      slabMesh.castShadow = true;
      parent.add(slabMesh);

      const ringGeo = new THREE.TorusGeometry(sr, 3.5, 10, 36, Math.PI * 1.45);
      const ringMesh = new THREE.Mesh(ringGeo, new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.4, metalness: 0.3 }));
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.rotation.z = state.mirrored ? -Math.PI * 0.65 : Math.PI * 0.2;
      ringMesh.position.set(fData.stair.cx - 330, 75, fData.stair.cy - 450);
      parent.add(ringMesh);
    } else {
      addBox(parent, 0, 0, -12, 660, 900, 12, 0xcbd5e1);
    }

    // Sols texturés par catégorie de pièce
    fData.rooms.forEach((r) => {
      let tex = tileTexCirc;
      if (r.category === "day") tex = woodTexDay;
      else if (r.category === "night") tex = woodTexNight;
      else if (r.category === "water") tex = tileTexWater;

      const floorMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.02 });
      if (r.rect) {
        const [rx, ry, rw, rh] = r.rect;
        const geo = new THREE.PlaneGeometry(rw, rh);
        const mesh = new THREE.Mesh(geo, floorMat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(rx - 330 + rw / 2, 1.5, ry - 450 + rh / 2);
        mesh.receiveShadow = true;
        parent.add(mesh);
      } else {
        const pts = r.cleanPoly || r.poly;
        if (pts) {
          const shape = new THREE.Shape();
          pts.forEach(([px, py], idx) => {
            if (idx === 0) shape.moveTo(px - 330, -(py - 450));
            else shape.lineTo(px - 330, -(py - 450));
          });
          shape.closePath();

          if (isUpper && r.id === "et-degagement" && fData.stair) {
            const hole = new THREE.Path();
            hole.absarc(fData.stair.cx - 330, -(fData.stair.cy - 450), fData.stair.radius || 85, 0, Math.PI * 2, true);
            shape.holes.push(hole);
          }

          const geo = new THREE.ShapeGeometry(shape, 32);
          const mesh = new THREE.Mesh(geo, floorMat);
          mesh.rotation.x = -Math.PI / 2;
          mesh.position.y = 1.6;
          mesh.receiveShadow = true;
          parent.add(mesh);
        }
      }
    });

    // Plafonniers intérieurs (PointLight doux pour sculpter les ombres dans les pièces)
    fData.electrical.filter((e) => e.type === "light").forEach((lItem) => {
      const pLight = new THREE.PointLight(0xfff7ed, 0.55, 650, 1.5);
      pLight.position.set(lItem.x - 330, 222, lItem.y - 450);
      parent.add(pLight);
    });

    const topOps = fData.extOpenings.filter((o) => o.side === "top");
    const botOps = fData.extOpenings.filter((o) => o.side === "bottom");
    buildHWallWithOpenings(parent, 0, 30, 0, 660, wallH, wallColor, topOps);
    buildHWallWithOpenings(parent, 870, 30, 0, 660, wallH, wallColor, botOps);

    addBox(parent, 0, 30, 0, 30, 840, wallH, wallColor, 1, true);
    addBox(parent, 630, 30, 0, 30, 840, wallH, wallColor, 1, true);

    fData.partitions.forEach((part) => {
      buildPartitionWithDoors(parent, part, fData.intDoors, wallH - 4, partColor, floorKey);
    });

    // Convecteurs
    fData.electrical.filter((e) => e.type === "heater").forEach((hItem) => {
      const hx = hItem.x < 100 ? 31 : 621;
      addBox(parent, hx, hItem.y - 32, 22, 8, 64, 48, 0xffffff);
      addBox(parent, hx + (hItem.x < 100 ? 8 : -1), hItem.y - 26, 58, 1, 52, 6, 0xef4444);
    });

    if (fData.stair && floorKey === "rdc") {
      addStair(parent, fData.stair.cx, fData.stair.cy, wallH);
    }

    if (floorKey === "rdc") {
      placeGLB(parent, "kitchenCabinet", mx(300, 62), 34, 0, 62, 58, 90, 0);
      placeGLB(parent, "kitchenStove", mx(362, 62), 34, 0, 62, 58, 92, 0);
      placeGLB(parent, "kitchenSink", mx(426, 128), 34, 0, 128, 58, 95, 0);
      placeGLB(parent, "kitchenFridgeLarge", mx(560, 62), 36, 0, 62, 58, 178, 0);

      placeGLB(parent, "table", mx(390, 150), 365, 0, 150, 85, 76, 0);
      [410, 452, 494].forEach((cx) => {
        placeGLB(parent, "chairCushion", mx(cx, 36), 336, 0, 36, 36, 82, 0);
        placeGLB(parent, "chairCushion", mx(cx, 36), 454, 0, 36, 36, 82, Math.PI);
      });

      placeGLB(parent, "rugRectangle", mx(385, 225), 575, 1.8, 225, 230, 3, 0);
      placeGLB(parent, "loungeSofaLong", mx(530, 88), 585, 0, 88, 205, 76, state.mirrored ? Math.PI / 2 : -Math.PI / 2);
      placeGLB(parent, "tableCoffee", mx(425, 70), 640, 0, 70, 105, 42, 0);
      placeGLB(parent, "cabinetTelevision", mx(305, 46), 625, 0, 46, 130, 52, state.mirrored ? -Math.PI / 2 : Math.PI / 2);
      placeGLB(parent, "televisionModern", mx(316, 22), 640, 52, 22, 100, 62, state.mirrored ? -Math.PI / 2 : Math.PI / 2);
      placeGLB(parent, "pottedPlant", mx(575, 44), 815, 0, 44, 44, 95, 0);

      addBed(parent, 36, 560, 190, 140, false);

      placeGLB(parent, "toiletSquare", mx(36, 42), 155, 0, 42, 56, 72, state.mirrored ? -Math.PI / 2 : Math.PI / 2);
      placeGLB(parent, "bathroomSink", mx(110, 52), 34, 0, 52, 42, 85, 0);
    } else {
      addBed(parent, 415, 580, 140, 190, true);
      addBed(parent, 95, 580, 140, 190, true);
      addBed(parent, 430, 120, 120, 190, true);

      placeGLB(parent, "bathtub", mx(34, 152), 34, 0, 152, 72, 58, 0);
      placeGLB(parent, "bathroomSink", mx(34, 46), 120, 0, 46, 52, 85, state.mirrored ? -Math.PI / 2 : Math.PI / 2);

      placeGLB(parent, "toiletSquare", mx(220, 42), 34, 0, 42, 56, 72, 0);
    }
  }

  function rebuildLevels() {
    wallColliders.rdc = [];
    wallColliders.etage = [];
    interactiveDoors.length = 0;
    rdcGroup.clear();
    etageGroup.clear();
    activeColliderKey = "rdc";
    buildLevel(rdcGroup, "rdc", false);
    activeColliderKey = "etage";
    buildLevel(etageGroup, "etage", true);
  }
  rebuildLevels();

  function updateVisibility() {
    const filter = state.view3d.floorFilter;
    rdcGroup.visible = filter !== "etage";
    etageGroup.visible = filter !== "rdc";
    etageGroup.position.y = filter === "etage" ? 0 : 240 + state.view3d.explode;
    roofGroup.visible = Boolean(state.view3d.showRoof) && !walk.active && filter !== "rdc";
    roofGroup.position.y = etageGroup.position.y + 240;
  }
  updateVisibility();

  const slider = document.getElementById("explode-slider");
  const filterSel = document.getElementById("filter-3d-floor");
  const wallSel = document.getElementById("filter-3d-walls");
  const sunMonthSel = document.getElementById("sun-month");
  const sunSlider = document.getElementById("sun-slider");
  const sunLabel = document.getElementById("sun-label");
  const roofToggle = document.getElementById("roof-toggle");
  const walkBtn = document.getElementById("walk-3d-btn");
  const walkHud = document.getElementById("walk-hud");
  const walkCrosshair = document.getElementById("walk-crosshair");
  const walkLockHint = document.getElementById("walk-lock-hint");
  const walkMinimap = document.getElementById("walk-minimap");
  const walkTouchPad = document.getElementById("walk-touch-pad");
  const walkTouchKnob = document.getElementById("walk-touch-knob");
  const walkFloorBadge = document.getElementById("walk-floor-badge");
  const walkStairsBtn = document.getElementById("walk-stairs-btn");
  const walkExitBtn = document.getElementById("walk-exit-btn");
  const walkFovSlider = document.getElementById("walk-fov-slider");
  const walkFovVal = document.getElementById("walk-fov-val");

  const walk = {
    active: false,
    floor: "rdc",
    yaw: 0,
    pitch: -0.04,
    keys: new Set(),
    looking: false,
    lastX: 0,
    lastY: 0,
    targetEyeY: 165,
    stairCooldown: 0,
    joyX: 0,
    joyY: 0
  };

  function drawMinimap(px, py) {
    if (!walkMinimap) return;
    const mctx = walkMinimap.getContext("2d");
    const mw = walkMinimap.width;
    const mh = walkMinimap.height;
    mctx.clearRect(0, 0, mw, mh);
    const sx = mw / 660;
    const sy = mh / 900;

    // Sol
    mctx.fillStyle = "#f8fafc";
    mctx.fillRect(0, 0, mw, mh);

    // Murs du niveau actuel
    mctx.fillStyle = "#1e293b";
    wallColliders[walk.floor].forEach((b) => {
      mctx.fillRect(b.x1 * sx, b.y1 * sy, Math.max(1.5, (b.x2 - b.x1) * sx), Math.max(1.5, (b.y2 - b.y1) * sy));
    });

    // Position & cône de vision
    const vx = px * sx;
    const vy = py * sy;
    mctx.save();
    mctx.translate(vx, vy);
    mctx.rotate(-walk.yaw + Math.PI);
    mctx.beginPath();
    mctx.moveTo(0, 0);
    mctx.arc(0, 0, 22, -Math.PI / 2 - 0.45, -Math.PI / 2 + 0.45);
    mctx.closePath();
    mctx.fillStyle = "rgba(2, 132, 199, 0.28)";
    mctx.fill();
    mctx.restore();

    mctx.beginPath();
    mctx.arc(vx, vy, 4.5, 0, Math.PI * 2);
    mctx.fillStyle = "#0284c7";
    mctx.fill();
    mctx.strokeStyle = "#ffffff";
    mctx.lineWidth = 1.5;
    mctx.stroke();
  }

  function setWalkFloor(floorKey) {
    walk.floor = floorKey;
    walk.targetEyeY = floorKey === "rdc" ? 165 : 240 + 165;
    walkFloorBadge.textContent = floorKey === "rdc" ? "Rez-de-Chaussée" : "1er Étage";
    walkStairsBtn.textContent = floorKey === "rdc" ? "⬆️ Monter à l'étage" : "⬇️ Descendre au RDC";
  }

  function enterWalkMode() {
    walk.active = true;
    controls.enabled = false;
    walkBtn.classList.add("active");
    walkHud.style.display = "flex";
    walkCrosshair.style.display = "block";
    walkLockHint.style.display = "block";
    walkMinimap.style.display = "block";
    if ("ontouchstart" in window || navigator.maxTouchPoints > 0) {
      walkTouchPad.style.display = "block";
    }

    // POV plus large en intérieur
    camera.fov = Number(walkFovSlider.value) || 75;
    camera.updateProjectionMatrix();

    state.view3d.floorFilter = "both";
    state.view3d.explode = 0;
    state.view3d.wallMode = "full";
    filterSel.value = "both";
    slider.value = 0;
    wallSel.value = "full";
    rebuildLevels();
    updateVisibility();

    const hallX = state.mirrored ? 660 - 235 : 235;
    const hallY = 180;
    setWalkFloor("rdc");
    camera.position.set(hallX - 330, 165, hallY - 450);
    walk.yaw = Math.PI;
    walk.pitch = -0.04;
    walk.stairCooldown = 0;
    updateWalkCameraLook();

    // Tenter le verrouillage FPS immédiat (si autorisé par le geste utilisateur)
    if (renderer.domElement.requestPointerLock) {
      try {
        Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {});
      } catch (_) {}
    }
  }

  function exitWalkMode() {
    walk.active = false;
    controls.enabled = true;
    walkBtn.classList.remove("active");
    walkHud.style.display = "none";
    walkCrosshair.style.display = "none";
    walkLockHint.style.display = "none";
    walkMinimap.style.display = "none";
    walkTouchPad.style.display = "none";
    walk.keys.clear();
    updateVisibility();

    if (document.pointerLockElement === renderer.domElement && document.exitPointerLock) {
      try { document.exitPointerLock(); } catch (_) {}
    }

    camera.fov = 42;
    camera.updateProjectionMatrix();
    camera.position.set(-550, 950, 1050);
    controls.target.set(0, 120, 0);
    controls.update();

    interactiveDoors.forEach((d) => {
      d.pivot.rotation.y = d.defaultRot;
      d.currentRot = d.defaultRot;
    });
  }

  function updateWalkCameraLook() {
    const euler = new THREE.Euler(walk.pitch, walk.yaw, 0, "YXZ");
    camera.quaternion.setFromEuler(euler);
  }

  function collides(planX, planY, floorKey) {
    const r = 16;
    const boxes = wallColliders[floorKey];
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (planX + r > b.x1 && planX - r < b.x2 && planY + r > b.y1 && planY - r < b.y2) {
        return true;
      }
    }
    return false;
  }

  walkFovSlider.addEventListener("input", () => {
    const fov = Number(walkFovSlider.value);
    walkFovVal.textContent = `${fov}°`;
    if (walk.active) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  });

  walkBtn.addEventListener("click", () => {
    if (walk.active) exitWalkMode();
    else enterWalkMode();
  });
  walkExitBtn.addEventListener("click", exitWalkMode);
  walkStairsBtn.addEventListener("click", () => {
    if (!walk.active) return;
    const next = walk.floor === "rdc" ? "etage" : "rdc";
    const stair = getFloorData(next).stair;
    setWalkFloor(next);
    walk.stairCooldown = 90;
    if (stair) {
      const exitX = state.mirrored ? stair.cx - 105 : stair.cx + 105;
      camera.position.x = exitX - 330;
      camera.position.z = stair.cy - 450;
    }
  });

  const onKeyDown = (e) => {
    if (!walk.active) return;
    const k = e.key.toLowerCase();
    if (["w", "a", "s", "d", "z", "q", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) {
      e.preventDefault();
      walk.keys.add(k);
    }
    if (k === "escape") exitWalkMode();
  };
  const onKeyUp = (e) => {
    walk.keys.delete(e.key.toLowerCase());
  };
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);

  renderer.domElement.addEventListener("mousedown", (e) => {
    if (!walk.active) return;
    walk.looking = true;
    walk.lastX = e.clientX;
    walk.lastY = e.clientY;
  });
  renderer.domElement.addEventListener("click", () => {
    if (!walk.active) return;
    if (document.pointerLockElement !== renderer.domElement && renderer.domElement.requestPointerLock) {
      try {
        Promise.resolve(renderer.domElement.requestPointerLock()).catch(() => {});
      } catch (_) {}
    }
  });

  document.addEventListener("pointerlockchange", () => {
    if (!walk.active) return;
    const locked = document.pointerLockElement === renderer.domElement;
    walkLockHint.style.display = locked ? "none" : "block";
  });

  window.addEventListener("mousemove", (e) => {
    if (!walk.active) return;
    const locked = document.pointerLockElement === renderer.domElement;
    if (!locked && !walk.looking) return;
    const dx = locked ? e.movementX : (e.clientX - walk.lastX);
    const dy = locked ? e.movementY : (e.clientY - walk.lastY);
    walk.lastX = e.clientX;
    walk.lastY = e.clientY;
    walk.yaw -= dx * 0.0028;
    walk.pitch = Math.max(-1.25, Math.min(1.25, walk.pitch - dy * 0.0025));
    updateWalkCameraLook();
  });
  window.addEventListener("mouseup", () => {
    walk.looking = false;
  });

  // Joystick tactile mobile
  let touchId = null;
  walkTouchPad.addEventListener("touchstart", (e) => {
    if (!walk.active) return;
    e.preventDefault();
    touchId = e.changedTouches[0].identifier;
  }, { passive: false });
  walkTouchPad.addEventListener("touchmove", (e) => {
    if (!walk.active) return;
    e.preventDefault();
    const t = Array.from(e.changedTouches).find((c) => c.identifier === touchId) || e.changedTouches[0];
    const rect = walkTouchPad.getBoundingClientRect();
    const dx = Math.max(-35, Math.min(35, t.clientX - (rect.left + rect.width / 2)));
    const dy = Math.max(-35, Math.min(35, t.clientY - (rect.top + rect.height / 2)));
    walkTouchKnob.style.transform = `translate(${dx}px, ${dy}px)`;
    walk.joyX = dx / 35;
    walk.joyY = -dy / 35;
  }, { passive: false });
  walkTouchPad.addEventListener("touchend", () => {
    touchId = null;
    walk.joyX = 0;
    walk.joyY = 0;
    walkTouchKnob.style.transform = "translate(0px, 0px)";
  });

  sunMonthSel.addEventListener("change", () => {
    state.view3d.sunMonth = Number(sunMonthSel.value);
    updateSunPosition();
  });
  sunSlider.addEventListener("input", () => {
    state.view3d.sunHour = Number(sunSlider.value);
    const h = Math.floor(state.view3d.sunHour);
    const m = state.view3d.sunHour % 1 === 0.5 ? "30" : "00";
    sunLabel.textContent = `${h}h${m === "30" ? "30" : ""}`;
    updateSunPosition();
  });
  roofToggle.addEventListener("change", () => {
    state.view3d.showRoof = roofToggle.checked;
    updateVisibility();
  });

  slider.addEventListener("input", () => {
    state.view3d.explode = Number(slider.value);
    updateVisibility();
  });
  filterSel.addEventListener("change", () => {
    state.view3d.floorFilter = filterSel.value;
    updateVisibility();
  });
  wallSel.addEventListener("change", () => {
    state.view3d.wallMode = wallSel.value;
    rebuildLevels();
  });
  document.getElementById("top-3d-btn").addEventListener("click", () => {
    if (walk.active) exitWalkMode();
    camera.position.set(0, 1550, 10);
    controls.target.set(0, 100, 0);
    controls.update();
  });
  document.getElementById("reset-3d-btn").addEventListener("click", () => {
    if (walk.active) exitWalkMode();
    camera.position.set(-550, 950, 1050);
    controls.target.set(0, 120, 0);
    controls.update();
  });

  function animate() {
    activeAnimId = requestAnimationFrame(animate);
    if (walk.active) {
      const speed = 3.4;
      let fwd = walk.joyY || 0;
      let strafe = walk.joyX || 0;
      if (walk.keys.has("w") || walk.keys.has("z") || walk.keys.has("arrowup")) fwd += 1;
      if (walk.keys.has("s") || walk.keys.has("arrowdown")) fwd -= 1;
      if (walk.keys.has("a") || walk.keys.has("q") || walk.keys.has("arrowleft")) strafe -= 1;
      if (walk.keys.has("d") || walk.keys.has("arrowright")) strafe += 1;

      if (fwd !== 0 || strafe !== 0) {
        const sinY = Math.sin(walk.yaw);
        const cosY = Math.cos(walk.yaw);
        const dx = (-sinY * fwd + cosY * strafe) * speed;
        const dz = (-cosY * fwd - sinY * strafe) * speed;

        const curPlanX = camera.position.x + 330;
        const curPlanY = camera.position.z + 450;

        if (!collides(curPlanX + dx, curPlanY, walk.floor)) {
          camera.position.x += dx;
        }
        if (!collides(camera.position.x + 330, curPlanY + dz, walk.floor)) {
          camera.position.z += dz;
        }
      }

      const px = camera.position.x + 330;
      const py = camera.position.z + 450;

      // Ouverture automatique des portes quand on s'en approche (pousser la porte)
      interactiveDoors.forEach((d) => {
        const dist = Math.hypot(px - d.planX, py - d.planY);
        const target = d.floor === walk.floor && dist < 115 ? d.openRot : d.closedRot;
        d.currentRot += (target - d.currentRot) * 0.14;
        d.pivot.rotation.y = d.currentRot;
      });

      // Montée / descente automatique quand on entre dans la zone de l'escalier
      if (walk.stairCooldown > 0) {
        walk.stairCooldown--;
      } else {
        const stair = getFloorData(walk.floor).stair;
        if (stair) {
          const distStair = Math.hypot(px - stair.cx, py - stair.cy);
          if (distStair < 75) {
            setWalkFloor(walk.floor === "rdc" ? "etage" : "rdc");
            walk.stairCooldown = 95;
          }
        }
      }

      camera.position.y += (walk.targetEyeY - camera.position.y) * 0.12;
      drawMinimap(px, py);
    } else {
      controls.update();
    }
    renderer.render(scene, camera);
  }
  animate();
};
