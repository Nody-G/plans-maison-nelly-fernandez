(() => {
  const DATA = window.HOUSE_DATA;

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  const state = {
    view: "both", // 'both' | 'rdc' | 'etage' | 'overlay' | '3d' | 'specs'
    zoom: 1,
    panX: 0,
    panY: 0,
    northAngle: 15,
    mirrored: true,
    selectedRoomId: null,
    measureMode: false,
    renovateMode: false,
    annotateMode: false,
    removedPartitions: loadJSON("nelly_removed_partitions", []), // ["rdc:4", ...]
    annotations: loadJSON("nelly_annotations", []), // [{ id, floor, x, y, text }]
    measurePoints: [],
    shiftKey: false,
    layers: {
      rooms: true,
      walls: true,
      joinery: true,
      dimensions: true,
      fixtures: true,
      furniture: true,
      electrical: true,
      ventilation: true
    },
    view3d: {
      yaw: -0.55,
      pitch: 0.72,
      explode: 110,
      scale: 0.56,
      panX: 0,
      panY: 40,
      floorFilter: "both", // 'both' | 'rdc' | 'etage'
      wallMode: "full", // 'full' | 'cut' | 'glass'
      sunHour: 14,
      sunMonth: 6,
      showRoof: false
    }
  };

  const NOTE_COLORS = {
    elec: "#f59e0b",
    plomb: "#06b6d4",
    peint: "#a855f7",
    macon: "#f97316",
    menuis: "#3b82f6"
  };

  const CATEGORY_COLORS = {
    day: "#fef3c7",
    night: "#e0f2fe",
    water: "#ccfbf1",
    circulation: "#f1f5f9",
    storage: "#ede9fe"
  };

  const CATEGORY_LABELS = {
    day: "Pièce de vie",
    night: "Espace nuit",
    water: "Pièce d'eau",
    circulation: "Circulation",
    storage: "Rangement"
  };

  function el(tag, attrs = {}, children = []) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, v);
    }
    for (const c of children) {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    }
    return node;
  }

  function applyTransform() {
    const sheet = document.querySelector(".sheet-container");
    if (!sheet) return;
    sheet.style.transform = `translate(${state.panX}px, ${state.panY}px) scale(${state.zoom})`;
    document.getElementById("zoom-label").textContent = `${Math.round(state.zoom * 100)}%`;
  }

  function fitToViewport() {
    const stage = document.getElementById("canvas-stage");
    const sheet = document.querySelector(".sheet-container");
    if (!stage || !sheet) return;

    // Reset temporaire pour mesurer la taille naturelle
    sheet.style.transform = "translate(0px, 0px) scale(1)";
    const stageRect = stage.getBoundingClientRect();
    const sheetW = sheet.offsetWidth;
    const sheetH = sheet.offsetHeight;
    if (!sheetW || !sheetH) return;

    const padX = 48;
    const padY = 64;
    const scaleX = (stageRect.width - padX) / sheetW;
    const scaleY = (stageRect.height - padY) / sheetH;
    state.zoom = Math.max(0.35, Math.min(1.4, +Math.min(scaleX, scaleY).toFixed(3)));
    state.panX = Math.round((stageRect.width - sheetW * state.zoom) / 2);
    state.panY = Math.round((stageRect.height - sheetH * state.zoom) / 2 - 10);
    applyTransform();
  }

  function getSvgPoint(svg, clientX, clientY) {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  function getFloorData(floorKey) {
    const src = DATA.floors[floorKey];
    if (!state.mirrored) return src;
    const W = DATA.meta.widthCm; // 660

    const swapDir = {
      "left-up": "right-up",
      "right-up": "left-up",
      "right-down": "left-down",
      "left-down": "right-down",
      "down-left": "down-right",
      "down-right": "down-left",
      "up-right": "up-left",
      "up-left": "up-right"
    };

    return {
      ...src,
      rooms: src.rooms.map((r) => ({
        ...r,
        rect: r.rect ? [W - r.rect[0] - r.rect[2], r.rect[1], r.rect[2], r.rect[3]] : undefined,
        poly: r.poly ? r.poly.map(([px, py]) => [W - px, py]) : undefined,
        cleanPoly: r.cleanPoly ? r.cleanPoly.map(([px, py]) => [W - px, py]) : undefined,
        labelPos: [W - r.labelPos[0], r.labelPos[1]]
      })),
      partitions: src.partitions.map(([x, y, w, h]) => [W - x - w, y, w, h]),
      extOpenings: src.extOpenings.map((op) => ({
        ...op,
        x: W - op.x - op.w,
        swing: op.swing === "in-right" ? "in-left" : op.swing
      })),
      intDoors: src.intDoors.map((d) => {
        if (d.orient === "v") {
          const thick = d.x === 175 ? 10 : 6;
          return { ...d, x: W - d.x - thick, dir: swapDir[d.dir] || d.dir };
        }
        return { ...d, x: W - d.x - d.w, dir: swapDir[d.dir] || d.dir };
      }),
      stair: src.stair ? { ...src.stair, cx: W - src.stair.cx } : undefined,
      fixtures: src.fixtures.map((f) => ({
        ...f,
        x: W - f.x - f.w,
        type: f.type === "toilet" ? "toilet-left" : f.type
      })),
      electrical: src.electrical.map((item) => ({
        ...item,
        x: W - item.x
      })),
      dimensions: {
        topOuter: [...src.dimensions.topOuter].reverse(),
        topInner: [...src.dimensions.topInner].reverse(),
        bottomInner: [...src.dimensions.bottomInner].reverse(),
        bottomOuter: [...src.dimensions.bottomOuter].reverse(),
        left: [...src.dimensions.right],
        right: [...src.dimensions.left]
      }
    };
  }

  /**
   * Construit le SVG complet d'un niveau (rdc ou etage)
   */
  function buildFloorSVG(floorKey, options = {}) {
    const floor = getFloorData(floorKey);
    const isOverlayTop = options.isOverlayTop || false;
    const width = options.width || 460;

    const svg = el("svg", {
      viewBox: "-130 -130 920 1160",
      width: width,
      class: `plan-svg${state.renovateMode && !isOverlayTop ? " renovate-active" : ""}`,
      "data-floor": floorKey
    });

    const defs = el("defs");
    const hatch = el("pattern", {
      id: `hatch-${floorKey}`,
      width: "12",
      height: "12",
      patternTransform: "rotate(45 0 0)",
      patternUnits: "userSpaceOnUse"
    }, [
      el("rect", { width: "12", height: "12", fill: isOverlayTop ? "#0369a1" : "#1e293b" }),
      el("line", { x1: "0", y1: "0", x2: "0", y2: "12", stroke: "#475569", "stroke-width": "2" })
    ]);
    defs.appendChild(hatch);
    svg.appendChild(defs);

    // 1. CALQUE PIÈCES & SURFACES
    if (state.layers.rooms) {
      const gRooms = el("g", { class: "layer-rooms" });
      floor.rooms.forEach((room) => {
        const fill = isOverlayTop ? "rgba(56, 189, 248, 0.14)" : (CATEGORY_COLORS[room.category] || "#f8fafc");
        const pts = room.cleanPoly || room.poly;
        let shape;
        if (pts) {
          shape = el("polygon", {
            points: pts.map((p) => p.join(",")).join(" "),
            fill,
            stroke: isOverlayTop ? "#0284c7" : "#cbd5e1",
            "stroke-width": isOverlayTop ? "1.5" : "1",
            class: `room-shape ${state.selectedRoomId === room.id ? "selected" : ""}`
          });
        } else if (room.rect) {
          const [x, y, w, h] = room.rect;
          shape = el("rect", {
            x, y, width: w, height: h,
            fill,
            stroke: isOverlayTop ? "#0284c7" : "#cbd5e1",
            "stroke-width": isOverlayTop ? "1.5" : "1",
            class: `room-shape ${state.selectedRoomId === room.id ? "selected" : ""}`
          });
        }
        if (shape) {
          shape.addEventListener("mouseenter", () => {
            document.getElementById("status-room").textContent = `Survol : ${room.name} (${room.surface.toFixed(2)} m²)`;
          });
          shape.addEventListener("mouseleave", () => {
            document.getElementById("status-room").textContent = "Survol : —";
          });
          shape.addEventListener("click", (e) => {
            if (state.measureMode || window.__wasPanning) return;
            e.stopPropagation();
            selectRoom(room, floor);
          });
          gRooms.appendChild(shape);
        }

        if (!isOverlayTop) {
          const [lx, ly] = room.labelPos;
          const isSmall = room.surface < 1.5;
          const gLabel = el("g", { "pointer-events": "none" });
          gLabel.appendChild(el("text", {
            x: lx,
            y: ly - (isSmall ? 2 : 6),
            "text-anchor": "middle",
            "font-size": isSmall ? "13" : "17",
            "font-weight": "700",
            fill: "#0f172a"
          }, [room.name.toUpperCase()]));
          gLabel.appendChild(el("text", {
            x: lx,
            y: ly + (isSmall ? 13 : 15),
            "text-anchor": "middle",
            "font-size": isSmall ? "12" : "15",
            "font-weight": "600",
            fill: "#334155"
          }, [`${room.surface.toFixed(2)} m²`]));
          gRooms.appendChild(gLabel);
        }
      });
      svg.appendChild(gRooms);
    }

    // 2. CALQUE MOBILIER INDICATIF (pour se projeter dans les volumes)
    if (state.layers.furniture && !isOverlayTop) {
      const gFurn = el("g", {
        class: "layer-furniture",
        stroke: "#7c3aed",
        "stroke-width": "1.3",
        "stroke-dasharray": "4 2",
        fill: "rgba(139, 92, 246, 0.08)",
        "pointer-events": "none"
      });

      function mx(x, w = 0) {
        return state.mirrored ? 660 - x - w : x;
      }

      function drawBed(x, y, w, h, pillowSide = "top") {
        const bx = mx(x, w);
        gFurn.appendChild(el("rect", { x: bx, y, width: w, height: h, rx: "4" }));
        if (pillowSide === "top") {
          const pw = (w - 20) / 2;
          if (w > 110) {
            gFurn.appendChild(el("rect", { x: bx + 6, y: y + 6, width: pw, height: 28, rx: "3" }));
            gFurn.appendChild(el("rect", { x: bx + 14 + pw, y: y + 6, width: pw, height: 28, rx: "3" }));
          } else {
            gFurn.appendChild(el("rect", { x: bx + 8, y: y + 6, width: w - 16, height: 26, rx: "3" }));
          }
        } else if (pillowSide === "left") {
          const px = state.mirrored ? bx + w - 32 : bx + 6;
          gFurn.appendChild(el("rect", { x: px, y: y + 8, width: 26, height: h - 16, rx: "3" }));
        }
      }

      if (floorKey === "rdc") {
        // Cuisine : plan de travail haut + cuisson + frigo
        gFurn.appendChild(el("rect", { x: mx(294, 332), y: 33, width: 332, height: 58, rx: "2" }));
        gFurn.appendChild(el("rect", { x: mx(562, 58), y: 36, width: 58, height: 52, rx: "2" }));
        gFurn.appendChild(el("circle", { cx: mx(345), cy: 52, r: "9" }));
        gFurn.appendChild(el("circle", { cx: mx(372), cy: 52, r: "9" }));
        gFurn.appendChild(el("circle", { cx: mx(345), cy: 74, r: "8" }));
        gFurn.appendChild(el("circle", { cx: mx(372), cy: 74, r: "8" }));

        // Séjour : table à manger en haut + salon canapé/table basse en bas
        gFurn.appendChild(el("rect", { x: mx(390, 150), y: 365, width: 150, height: 85, rx: "4" }));
        [415, 455, 495].forEach((cx) => {
          gFurn.appendChild(el("rect", { x: mx(cx, 24), y: 348, width: 24, height: 14, rx: "2" }));
          gFurn.appendChild(el("rect", { x: mx(cx, 24), y: 453, width: 24, height: 14, rx: "2" }));
        });
        gFurn.appendChild(el("rect", { x: mx(530, 88), y: 585, width: 88, height: 205, rx: "6" }));
        gFurn.appendChild(el("rect", { x: mx(425, 75), y: 635, width: 75, height: 110, rx: "4" }));

        // Chambre 4 : lit 140x190 contre mur extérieur
        drawBed(36, 560, 190, 140, "left");
      } else {
        drawBed(415, 580, 140, 190, "top");
        drawBed(95, 580, 140, 190, "top");
        drawBed(430, 120, 120, 190, "top");
      }

      svg.appendChild(gFurn);
    }

    // 3. CALQUE MOBILIER SANITAIRE & ESCALIER
    if (state.layers.fixtures && !isOverlayTop) {
      const gFix = el("g", { class: "layer-fixtures", stroke: "#475569", "stroke-width": "1.8", fill: "#ffffff", "pointer-events": "none" });

      floor.fixtures.forEach((f) => {
        if (f.type === "bathtub") {
          gFix.appendChild(el("rect", { x: f.x, y: f.y, width: f.w, height: f.h, rx: "6" }));
          gFix.appendChild(el("rect", { x: f.x + 8, y: f.y + 8, width: f.w - 16, height: f.h - 16, rx: "14", fill: "#f1f5f9" }));
          gFix.appendChild(el("circle", { cx: f.x + f.w - 22, cy: f.y + f.h / 2, r: "4", fill: "#64748b" }));
        } else if (f.type === "sink-wc" || f.type === "sink-bath") {
          gFix.appendChild(el("rect", { x: f.x, y: f.y, width: f.w, height: f.h, rx: "6" }));
          gFix.appendChild(el("ellipse", { cx: f.x + f.w / 2, cy: f.y + f.h / 2, rx: f.w * 0.34, ry: f.h * 0.3, fill: "#f1f5f9" }));
        } else if (f.type === "bidet") {
          gFix.appendChild(el("ellipse", { cx: f.x + f.w / 2, cy: f.y + f.h / 2, rx: f.w / 2, ry: f.h / 2 }));
          gFix.appendChild(el("ellipse", { cx: f.x + f.w / 2, cy: f.y + f.h / 2, rx: f.w * 0.28, ry: f.h * 0.28, fill: "#f1f5f9" }));
        } else if (f.type === "toilet") {
          gFix.appendChild(el("rect", { x: f.x, y: f.y + 6, width: 14, height: f.h - 12, rx: "2" }));
          gFix.appendChild(el("ellipse", { cx: f.x + 28, cy: f.y + f.h / 2, rx: 16, ry: 15 }));
        } else if (f.type === "toilet-left") {
          gFix.appendChild(el("rect", { x: f.x + f.w - 14, y: f.y + 6, width: 14, height: f.h - 12, rx: "2" }));
          gFix.appendChild(el("ellipse", { cx: f.x + f.w - 28, cy: f.y + f.h / 2, rx: 16, ry: 15 }));
        } else if (f.type === "toilet-down") {
          gFix.appendChild(el("rect", { x: f.x + 4, y: f.y, width: f.w - 8, height: 14, rx: "2" }));
          gFix.appendChild(el("ellipse", { cx: f.x + f.w / 2, cy: f.y + 32, rx: 14, ry: 17 }));
        } else if (f.type === "kitchen-sink") {
          gFix.appendChild(el("rect", { x: f.x, y: f.y, width: f.w, height: f.h, rx: "3" }));
          gFix.appendChild(el("rect", { x: f.x + 6, y: f.y + 8, width: 38, height: 38, rx: "3", fill: "#f1f5f9" }));
          gFix.appendChild(el("rect", { x: f.x + 48, y: f.y + 8, width: 38, height: 38, rx: "3", fill: "#f1f5f9" }));
          for (let i = 0; i < 4; i++) {
            const lx = f.x + 95 + i * 7;
            gFix.appendChild(el("line", { x1: lx, y1: f.y + 10, x2: lx, y2: f.y + 44, "stroke-width": "1.2" }));
          }
        }
      });

      if (floor.stair) {
        const { cx, cy, radius } = floor.stair;
        const gStair = el("g", { class: "stair" });
        gStair.appendChild(el("circle", { cx, cy, r: radius, fill: "#ffffff", stroke: "#334155", "stroke-width": "2" }));
        gStair.appendChild(el("circle", { cx, cy, r: 12, fill: "#cbd5e1", stroke: "#334155", "stroke-width": "1.8" }));
        const steps = 13;
        for (let i = 0; i < steps; i++) {
          const ang = (i * (Math.PI * 1.65)) / steps - Math.PI * 0.85;
          const x1 = cx + 12 * Math.cos(ang);
          const y1 = cy + 12 * Math.sin(ang);
          const x2 = cx + radius * Math.cos(ang);
          const y2 = cy + radius * Math.sin(ang);
          gStair.appendChild(el("line", { x1, y1, x2, y2, stroke: "#64748b", "stroke-width": "1.3" }));
        }
        gStair.appendChild(el("path", {
          d: `M ${cx - radius * 0.55} ${cy + 15} A ${radius * 0.6} ${radius * 0.6} 0 1 1 ${cx + radius * 0.45} ${cy - 25}`,
          fill: "none",
          stroke: "#0284c7",
          "stroke-width": "2.2",
          "stroke-dasharray": "5 3"
        }));
        gStair.appendChild(el("text", {
          x: cx,
          y: cy + radius + 16,
          "text-anchor": "middle",
          "font-size": "11",
          "font-weight": "700",
          fill: "#0284c7",
          stroke: "none"
        }, [floorKey === "rdc" ? "MONTÉE ÉTAGE" : "ARRIVÉE ESCALIER"]));
        gFix.appendChild(gStair);
      }

      svg.appendChild(gFix);
    }

    // 4. CALQUE MURS & CLOISONS
    if (state.layers.walls) {
      const gWalls = el("g", { class: "layer-walls", "pointer-events": state.renovateMode ? "auto" : "none" });
      const wallStroke = isOverlayTop ? "#0284c7" : "#0f172a";
      const extFill = isOverlayTop ? "none" : `url(#hatch-${floorKey})`;

      gWalls.appendChild(el("rect", { x: 0, y: 0, width: 660, height: 30, fill: extFill, stroke: wallStroke, "stroke-width": "2" }));
      gWalls.appendChild(el("rect", { x: 0, y: 870, width: 660, height: 30, fill: extFill, stroke: wallStroke, "stroke-width": "2" }));
      gWalls.appendChild(el("rect", { x: 0, y: 30, width: 30, height: 840, fill: extFill, stroke: wallStroke, "stroke-width": "2" }));
      gWalls.appendChild(el("rect", { x: 630, y: 30, width: 30, height: 840, fill: extFill, stroke: wallStroke, "stroke-width": "2" }));

      floor.partitions.forEach(([x, y, w, h], idx) => {
        const partKey = `${floorKey}:${idx}`;
        const isRemoved = state.removedPartitions.includes(partKey);
        const cls = [
          state.renovateMode && !isOverlayTop ? "partition-editable" : "",
          isRemoved ? "partition-removed" : ""
        ].filter(Boolean).join(" ");

        const pRect = el("rect", {
          x, y, width: w, height: h,
          fill: isOverlayTop ? "rgba(2, 132, 199, 0.4)" : "#334155",
          stroke: wallStroke,
          "stroke-width": "1",
          class: cls
        });
        if (state.renovateMode && !isOverlayTop) {
          pRect.addEventListener("click", (e) => {
            e.stopPropagation();
            if (isRemoved) {
              state.removedPartitions = state.removedPartitions.filter((k) => k !== partKey);
            } else {
              state.removedPartitions.push(partKey);
            }
            localStorage.setItem("nelly_removed_partitions", JSON.stringify(state.removedPartitions));
            if (window.__renderAnnotationsSidebar) window.__renderAnnotationsSidebar();
            render(false);
          });
        }
        gWalls.appendChild(pRect);
      });

      svg.appendChild(gWalls);
    }

    // 5. CALQUE MENUISERIES & OUVERTURES
    if (state.layers.joinery) {
      const gJoin = el("g", { class: "layer-joinery", "pointer-events": "none" });

      floor.extOpenings.forEach((op) => {
        const yWall = op.side === "top" ? 0 : 870;
        const typeLabel = op.type === "entry-door" ? "Porte d'entrée" : (op.type === "window-high" ? "Châssis haut" : "Fenêtre 2 vantaux");
        const tip = `${op.code ? op.code + " — " : ""}${typeLabel} (${op.w} cm)${op.vent ? " • Vent. " + op.vent : ""}`;

        gJoin.appendChild(el("rect", { x: op.x, y: yWall - 1, width: op.w, height: 32, fill: "#ffffff", stroke: "none" }));
        const frame = el("rect", {
          x: op.x, y: yWall + 8, width: op.w, height: 14,
          fill: "#e0f2fe", stroke: "#0284c7", "stroke-width": "2",
          "pointer-events": isOverlayTop ? "none" : "auto",
          style: "cursor:help"
        }, [el("title", {}, [tip])]);
        frame.addEventListener("mouseenter", () => {
          document.getElementById("status-room").textContent = `Menuiserie : ${tip}`;
        });
        frame.addEventListener("mouseleave", () => {
          document.getElementById("status-room").textContent = "Survol : —";
        });
        gJoin.appendChild(frame);
        gJoin.appendChild(el("line", { x1: op.x, y1: yWall + 15, x2: op.x + op.w, y2: yWall + 15, stroke: "#0369a1", "stroke-width": "1.5" }));

        if (op.type === "entry-door") {
          if (op.swing === "in-left") {
            gJoin.appendChild(el("line", { x1: op.x, y1: 30, x2: op.x, y2: 30 + op.w, stroke: "#0284c7", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${op.x + op.w} 30 A ${op.w} ${op.w} 0 0 1 ${op.x} ${30 + op.w}`, fill: "none", stroke: "#0284c7", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          } else {
            gJoin.appendChild(el("line", { x1: op.x + op.w, y1: 30, x2: op.x + op.w, y2: 30 + op.w, stroke: "#0284c7", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${op.x} 30 A ${op.w} ${op.w} 0 0 0 ${op.x + op.w} ${30 + op.w}`, fill: "none", stroke: "#0284c7", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          }
        } else if (op.type === "french-door") {
          const half = op.w / 2;
          gJoin.appendChild(el("path", { d: `M ${op.x} 870 A ${half} ${half} 0 0 1 ${op.x + half} ${870 - half}`, fill: "none", stroke: "#0284c7", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          gJoin.appendChild(el("path", { d: `M ${op.x + op.w} 870 A ${half} ${half} 0 0 0 ${op.x + half} ${870 - half}`, fill: "none", stroke: "#0284c7", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
        }

        if (op.code && !isOverlayTop) {
          const ty = op.side === "top" ? 50 : 858;
          gJoin.appendChild(el("text", { x: op.x + op.w / 2, y: ty, "text-anchor": "middle", "font-size": "13", "font-weight": "800", fill: "#0369a1" }, [op.code]));
        }
      });

      floor.intDoors.forEach((d) => {
        if (d.orient === "v") {
          gJoin.appendChild(el("rect", { x: d.x - 1, y: d.y, width: 12, height: d.w, fill: "#ffffff" }));
          if (d.dir === "left-up") {
            gJoin.appendChild(el("line", { x1: d.x, y1: d.y, x2: d.x - d.w, y2: d.y, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x - d.w} ${d.y} A ${d.w} ${d.w} 0 0 0 ${d.x} ${d.y + d.w}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          } else if (d.dir === "right-up") {
            gJoin.appendChild(el("line", { x1: d.x + 6, y1: d.y, x2: d.x + 6 + d.w, y2: d.y, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x + 6 + d.w} ${d.y} A ${d.w} ${d.w} 0 0 1 ${d.x + 6} ${d.y + d.w}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          } else if (d.dir === "right-down") {
            gJoin.appendChild(el("line", { x1: d.x + 6, y1: d.y + d.w, x2: d.x + 6 + d.w, y2: d.y + d.w, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x + 6} ${d.y} A ${d.w} ${d.w} 0 0 1 ${d.x + 6 + d.w} ${d.y + d.w}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          } else if (d.dir === "left-down") {
            gJoin.appendChild(el("line", { x1: d.x, y1: d.y + d.w, x2: d.x - d.w, y2: d.y + d.w, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x} ${d.y} A ${d.w} ${d.w} 0 0 0 ${d.x - d.w} ${d.y + d.w}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          }
        } else {
          gJoin.appendChild(el("rect", { x: d.x, y: d.y - 1, width: d.w, height: 8, fill: "#ffffff" }));
          if (d.dir === "down-left") {
            gJoin.appendChild(el("line", { x1: d.x, y1: d.y + 6, x2: d.x, y2: d.y + 6 + d.w, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x} ${d.y + 6 + d.w} A ${d.w} ${d.w} 0 0 0 ${d.x + d.w} ${d.y + 6}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          } else if (d.dir === "down-right") {
            gJoin.appendChild(el("line", { x1: d.x + d.w, y1: d.y + 6, x2: d.x + d.w, y2: d.y + 6 + d.w, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x} ${d.y + 6} A ${d.w} ${d.w} 0 0 0 ${d.x + d.w} ${d.y + 6 + d.w}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          } else if (d.dir === "up-right") {
            gJoin.appendChild(el("line", { x1: d.x + d.w, y1: d.y, x2: d.x + d.w, y2: d.y - d.w, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x} ${d.y} A ${d.w} ${d.w} 0 0 1 ${d.x + d.w} ${d.y - d.w}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          } else if (d.dir === "up-left") {
            gJoin.appendChild(el("line", { x1: d.x, y1: d.y, x2: d.x, y2: d.y - d.w, stroke: "#334155", "stroke-width": "2" }));
            gJoin.appendChild(el("path", { d: `M ${d.x + d.w} ${d.y} A ${d.w} ${d.w} 0 0 0 ${d.x} ${d.y - d.w}`, fill: "none", stroke: "#64748b", "stroke-width": "1.2", "stroke-dasharray": "4 3" }));
          }
        }
      });

      svg.appendChild(gJoin);
    }

    // 6. CALQUE ÉLECTRICITÉ & CHAUFFAGE
    if (state.layers.electrical && !isOverlayTop) {
      const gElec = el("g", { class: "layer-electrical", "pointer-events": "none" });
      floor.electrical.forEach((item) => {
        if (item.type === "heater") {
          gElec.appendChild(el("rect", { x: item.x - 4, y: item.y - 26, width: 8, height: 52, rx: "2", fill: "#fee2e2", stroke: "#dc2626", "stroke-width": "1.6" }));
          gElec.appendChild(el("text", { x: item.x + (item.x < 100 ? 14 : -14), y: item.y + 4, "text-anchor": "middle", "font-size": "11", "font-weight": "700", fill: "#dc2626" }, [item.label]));
        } else if (item.type === "light") {
          gElec.appendChild(el("line", { x1: item.x - 7, y1: item.y - 7, x2: item.x + 7, y2: item.y + 7, stroke: "#dc2626", "stroke-width": "1.8" }));
          gElec.appendChild(el("line", { x1: item.x + 7, y1: item.y - 7, x2: item.x - 7, y2: item.y + 7, stroke: "#dc2626", "stroke-width": "1.8" }));
        } else if (item.type === "outlet") {
          gElec.appendChild(el("circle", { cx: item.x, cy: item.y, r: "6", fill: "#ffffff", stroke: "#dc2626", "stroke-width": "1.6" }));
          gElec.appendChild(el("text", { x: item.x, y: item.y + 18, "text-anchor": "middle", "font-size": "10", "font-weight": "700", fill: "#dc2626" }, [item.label]));
        } else if (item.type === "panel") {
          gElec.appendChild(el("rect", { x: item.x, y: item.y - 18, width: 8, height: 36, fill: "#dc2626" }));
        }
      });
      svg.appendChild(gElec);
    }

    // 7. CALQUE VENTILATION
    if (state.layers.ventilation && !isOverlayTop) {
      const gVent = el("g", { class: "layer-ventilation", "pointer-events": "none" });
      floor.extOpenings.forEach((op) => {
        if (!op.vent) return;
        const cx = op.x + op.w / 2;
        const yPos = op.side === "top" ? -14 : 922;
        gVent.appendChild(el("rect", { x: cx - 14, y: yPos - 11, width: 28, height: 16, rx: "8", fill: "#ecfdf5", stroke: "#059669", "stroke-width": "1.3" }));
        gVent.appendChild(el("text", { x: cx, y: yPos + 1, "text-anchor": "middle", "font-size": "10", "font-weight": "800", fill: "#059669" }, [op.vent]));
      });
      svg.appendChild(gVent);
    }

    // 8. CALQUE COTATIONS
    if (state.layers.dimensions && !isOverlayTop) {
      const gDim = el("g", { class: "layer-dimensions", "pointer-events": "none" });
      const d = floor.dimensions;

      function drawHChain(vals, yLine) {
        let curX = 0;
        gDim.appendChild(el("line", { x1: 0, y1: yLine, x2: 660, y2: yLine, stroke: "#334155", "stroke-width": "1" }));
        vals.forEach((v) => {
          gDim.appendChild(el("line", { x1: curX, y1: yLine - 6, x2: curX, y2: yLine + 6, stroke: "#334155", "stroke-width": "1" }));
          gDim.appendChild(el("line", { x1: curX - 3, y1: yLine + 3, x2: curX + 3, y2: yLine - 3, stroke: "#0f172a", "stroke-width": "1.5" }));
          gDim.appendChild(el("text", { x: curX + v / 2, y: yLine - 5, "text-anchor": "middle", "font-size": v < 35 ? "10" : "12", "font-weight": "600", fill: "#0f172a" }, [String(v)]));
          curX += v;
        });
        gDim.appendChild(el("line", { x1: curX, y1: yLine - 6, x2: curX, y2: yLine + 6, stroke: "#334155", "stroke-width": "1" }));
        gDim.appendChild(el("line", { x1: curX - 3, y1: yLine + 3, x2: curX + 3, y2: yLine - 3, stroke: "#0f172a", "stroke-width": "1.5" }));
      }

      function drawVChain(vals, xLine) {
        let curY = 0;
        gDim.appendChild(el("line", { x1: xLine, y1: 0, x2: xLine, y2: 900, stroke: "#334155", "stroke-width": "1" }));
        vals.forEach((v) => {
          gDim.appendChild(el("line", { x1: xLine - 6, y1: curY, x2: xLine + 6, y2: curY, stroke: "#334155", "stroke-width": "1" }));
          gDim.appendChild(el("line", { x1: xLine - 3, y1: curY + 3, x2: xLine + 3, y2: curY - 3, stroke: "#0f172a", "stroke-width": "1.5" }));
          const mid = curY + v / 2;
          gDim.appendChild(el("text", { x: xLine - 6, y: mid, "text-anchor": "middle", transform: `rotate(-90 ${xLine - 6} ${mid})`, "font-size": v < 35 ? "10" : "12", "font-weight": "600", fill: "#0f172a" }, [String(v)]));
          curY += v;
        });
        gDim.appendChild(el("line", { x1: xLine - 6, y1: curY, x2: xLine + 6, y2: curY, stroke: "#334155", "stroke-width": "1" }));
        gDim.appendChild(el("line", { x1: xLine - 3, y1: curY + 3, x2: xLine + 3, y2: curY - 3, stroke: "#0f172a", "stroke-width": "1.5" }));
      }

      drawHChain(d.topInner, -42);
      drawHChain(d.topOuter, -76);
      gDim.appendChild(el("line", { x1: 0, y1: -106, x2: 660, y2: -106, stroke: "#0f172a", "stroke-width": "1.4" }));
      gDim.appendChild(el("text", { x: 330, y: -112, "text-anchor": "middle", "font-size": "14", "font-weight": "800", fill: "#0f172a" }, ["6,60 m FINI"]));

      drawHChain(d.bottomInner, 945);
      drawHChain(d.bottomOuter, 978);
      gDim.appendChild(el("line", { x1: 0, y1: 1008, x2: 660, y2: 1008, stroke: "#0f172a", "stroke-width": "1.4" }));
      gDim.appendChild(el("text", { x: 330, y: 1024, "text-anchor": "middle", "font-size": "14", "font-weight": "800", fill: "#0f172a" }, ["6,60 m FINI"]));

      drawVChain(d.left, -48);
      gDim.appendChild(el("line", { x1: -88, y1: 0, x2: -88, y2: 900, stroke: "#0f172a", "stroke-width": "1.4" }));
      gDim.appendChild(el("text", { x: -96, y: 450, "text-anchor": "middle", transform: "rotate(-90 -96 450)", "font-size": "14", "font-weight": "800", fill: "#0f172a" }, ["9,00 m FINI"]));

      drawVChain(d.right, 708);
      gDim.appendChild(el("line", { x1: 748, y1: 0, x2: 748, y2: 900, stroke: "#0f172a", "stroke-width": "1.4" }));
      gDim.appendChild(el("text", { x: 764, y: 450, "text-anchor": "middle", transform: "rotate(-90 764 450)", "font-size": "14", "font-weight": "800", fill: "#0f172a" }, ["9,00 m FINI"]));

      svg.appendChild(gDim);
    }

    // 9. CALQUE ANNOTATIONS DE CHANTIER
    if (!isOverlayTop && state.annotations.length) {
      const gAnn = el("g", { class: "layer-annotations" });
      state.annotations.forEach((ann, i) => {
        if (ann.floor !== floorKey) return;
        const col = NOTE_COLORS[ann.cat] || "#f59e0b";
        const gPin = el("g", { style: "cursor:pointer" });
        gPin.appendChild(el("circle", { cx: ann.x, cy: ann.y, r: "14", fill: col, stroke: "#0f172a", "stroke-width": "2" }));
        gPin.appendChild(el("text", { x: ann.x, y: ann.y + 5, "text-anchor": "middle", "font-size": "13", "font-weight": "800", fill: "#0f172a" }, [String(i + 1)]));
        const title = el("title", {}, [ann.text]);
        gPin.appendChild(title);
        gAnn.appendChild(gPin);
      });
      svg.appendChild(gAnn);
    }

    // Suivi coordonnées + outil mesure / annotation en temps réel
    svg.addEventListener("mousemove", (e) => {
      const pt = getSvgPoint(svg, e.clientX, e.clientY);
      const rx = Math.round(pt.x);
      const ry = Math.round(pt.y);
      if (rx >= 0 && rx <= 660 && ry >= 0 && ry <= 900) {
        document.getElementById("status-coords").textContent = `Position (${floor.shortName}) : X = ${rx} cm  |  Y = ${ry} cm`;
      } else {
        document.getElementById("status-coords").textContent = "Position : Hors bâtiment";
      }

      if (state.measureMode && state.measurePoints.length === 1) {
        const p1 = state.measurePoints[0];
        let p2 = { x: pt.x, y: pt.y };
        if (state.shiftKey || e.shiftKey) {
          if (Math.abs(p2.x - p1.x) > Math.abs(p2.y - p1.y)) p2.y = p1.y;
          else p2.x = p1.x;
        }
        drawMeasureOverlay(svg, [p1, p2], true);
      }
    });

    svg.addEventListener("click", (e) => {
      if (window.__wasPanning) return;
      if (state.annotateMode) {
        const pt = getSvgPoint(svg, e.clientX, e.clientY);
        if (typeof window.__openNoteModal === "function") {
          window.__openNoteModal(floorKey, Math.round(pt.x), Math.round(pt.y));
        }
        return;
      }
      if (!state.measureMode) return;
      const pt = getSvgPoint(svg, e.clientX, e.clientY);
      let x = pt.x;
      let y = pt.y;
      if (state.measurePoints.length === 1 && (state.shiftKey || e.shiftKey)) {
        const p1 = state.measurePoints[0];
        if (Math.abs(x - p1.x) > Math.abs(y - p1.y)) y = p1.y;
        else x = p1.x;
      }
      if (state.measurePoints.length >= 2) state.measurePoints = [];
      state.measurePoints.push({ x, y });
      drawMeasureOverlay(svg, state.measurePoints, false);
    });

    return svg;
  }

  function drawMeasureOverlay(svg, pts, isPreview) {
    svg.querySelectorAll(".measure-overlay").forEach((n) => n.remove());
    if (!pts.length) return;
    const g = el("g", { class: "measure-overlay", "pointer-events": "none" });
    pts.forEach((p) => {
      g.appendChild(el("circle", { cx: p.x, cy: p.y, r: "6", fill: "#ef4444", stroke: "#fff", "stroke-width": "2" }));
    });
    if (pts.length === 2) {
      const [p1, p2] = pts;
      const distCm = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const distM = (distCm / 100).toFixed(2);
      g.appendChild(el("line", {
        x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y,
        stroke: isPreview ? "#f97316" : "#ef4444",
        "stroke-width": "2.5",
        "stroke-dasharray": "6 3"
      }));
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2 - 14;
      g.appendChild(el("rect", { x: mx - 50, y: my - 14, width: 100, height: 22, rx: "4", fill: "#0f172a" }));
      g.appendChild(el("text", { x: mx, y: my + 2, "text-anchor": "middle", "font-size": "12", "font-weight": "700", fill: "#ffffff" }, [`${distM} m (${Math.round(distCm)} cm)`]));
    }
    svg.appendChild(g);
  }

  function computeRoomMetrics(room, customH) {
    let perimCm = 0;
    if (room.rect) {
      perimCm = 2 * (room.rect[2] + room.rect[3]);
    } else {
      const pts = room.cleanPoly || room.poly;
      if (pts && pts.length > 1) {
        for (let i = 0; i < pts.length; i++) {
          const [x1, y1] = pts[i];
          const [x2, y2] = pts[(i + 1) % pts.length];
          perimCm += Math.hypot(x2 - x1, y2 - y1);
        }
      }
    }
    const h = customH || state.ceilingH || 2.5;
    const perimM = perimCm / 100;
    const plinthesM = Math.max(0, perimM - 0.85);
    const wallPaintM2 = Math.max(0, perimM * h - 2.4); // HSP réglable moins ~2,4 m² d'ouvertures
    return { perimM, plinthesM, wallPaintM2 };
  }

  function selectRoom(room, floor) {
    state.selectedRoomId = room.id;
    const m = computeRoomMetrics(room);
    const box = document.getElementById("inspector-content");
    box.innerHTML = `
      <h3>${room.name}</h3>
      <div class="inspector-metric">${room.surface.toFixed(2)} m²</div>
      <div class="inspector-row"><span>Niveau</span><strong>${floor.name}</strong></div>
      <div class="inspector-row"><span>Type</span><strong>${CATEGORY_LABELS[room.category] || room.category}</strong></div>
      <div class="inspector-row"><span>Dimensions</span><strong>${room.dimsText}</strong></div>
      <div class="inspector-row"><span>Périmètre</span><strong>${m.perimM.toFixed(1)} m</strong></div>
      <div class="inspector-row"><span>Plinthes (est.)</span><strong>${m.plinthesM.toFixed(1)} ml</strong></div>
      <div class="inspector-row"><span>Murs à peindre</span><strong>${m.wallPaintM2.toFixed(1)} m²</strong></div>
      <div class="inspector-notes">${room.notes}</div>
    `;
    render(false);
  }

  function buildNorthCompassSVG() {
    return `
      <svg width="38" height="38" viewBox="-20 -20 40 40" title="Orientation Nord (${state.northAngle}°)">
        <circle cx="0" cy="0" r="18" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.2"/>
        <g transform="rotate(${state.northAngle})">
          <polygon points="0,-14 5,4 0,0 -5,4" fill="#dc2626"/>
          <polygon points="0,14 5,4 0,0 -5,4" fill="#cbd5e1"/>
          <text x="0" y="-15" text-anchor="middle" font-size="7" font-weight="800" fill="#0f172a">N</text>
        </g>
      </svg>
    `;
  }

  function getFloorDataFor3D(floorKey) {
    const base = getFloorData(floorKey);
    return {
      ...base,
      partitions: base.partitions.filter((_, idx) => !state.removedPartitions.includes(`${floorKey}:${idx}`))
    };
  }

  // Rendu Vue 3D Axonométrique Interactive sur Canvas (tri de profondeur, meubles, zoom molette & pan)
  function render3DView(container) {
    if (typeof window.renderThree3DView === "function") {
      return window.renderThree3DView(container, state, getFloorDataFor3D, CATEGORY_COLORS);
    }
    container.innerHTML = `
      <div class="view3d-wrapper">
        <div class="view3d-controls" style="flex-wrap:wrap; justify-content:center;">
          <span style="color:#475569;">🖱️ Glisser gauche : Pivoter • Clic droit / Shift : Déplacer • Molette : Zoomer</span>
          <label>Écartement :
            <input type="range" id="explode-slider" min="0" max="260" value="${state.view3d.explode}">
          </label>
          <select id="filter-3d-floor" class="btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">
            <option value="both" ${state.view3d.floorFilter === "both" ? "selected" : ""}>RDC + Étage</option>
            <option value="rdc" ${state.view3d.floorFilter === "rdc" ? "selected" : ""}>RDC seul</option>
            <option value="etage" ${state.view3d.floorFilter === "etage" ? "selected" : ""}>Étage seul</option>
          </select>
          <button class="btn" id="top-3d-btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">Vue dessus</button>
          <button class="btn" id="reset-3d-btn" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">Vue Iso</button>
        </div>
        <canvas id="canvas-3d" width="920" height="620" style="cursor: grab; border: 1px solid #cbd5e1; border-radius: 6px; background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%); max-width:100%;"></canvas>
      </div>
    `;

    const canvas = document.getElementById("canvas-3d");
    const ctx = canvas.getContext("2d");
    const slider = document.getElementById("explode-slider");
    const filterSel = document.getElementById("filter-3d-floor");

    function project(x, y, z) {
      const cx = x - 330;
      const cy = y - 450;
      const cosY = Math.cos(state.view3d.yaw);
      const sinY = Math.sin(state.view3d.yaw);
      const rx = cx * cosY - cy * sinY;
      const ry = cx * sinY + cy * cosY;
      const cosP = Math.cos(state.view3d.pitch);
      const sinP = Math.sin(state.view3d.pitch);
      const s = state.view3d.scale;
      const sx = canvas.width / 2 + state.view3d.panX + rx * s;
      const sy = canvas.height / 2 + state.view3d.panY + (ry * cosP - z * sinP) * s;
      const depth = ry * sinP + z * cosP;
      return [sx, sy, depth];
    }

    function mx(x, w = 0) {
      return state.mirrored ? 660 - x - w : x;
    }

    function draw3DScene() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const faceQueue = [];

      function pushBox(x, y, z, w, d, h, fillTop, fillSideA, fillSideB, stroke = "rgba(15,23,42,0.45)", layer = 1) {
        const p = [
          project(x, y, z),
          project(x + w, y, z),
          project(x + w, y + d, z),
          project(x, y + d, z),
          project(x, y, z + h),
          project(x + w, y, z + h),
          project(x + w, y + d, z + h),
          project(x, y + d, z + h)
        ];
        const sideB = fillSideB || fillSideA;
        const faces = [
          { idx: [0, 1, 5, 4], col: fillSideA },
          { idx: [1, 2, 6, 5], col: sideB },
          { idx: [2, 3, 7, 6], col: fillSideA },
          { idx: [3, 0, 4, 7], col: sideB },
          { idx: [4, 5, 6, 7], col: fillTop }
        ];
        faces.forEach((f) => {
          const pts = f.idx.map((i) => p[i]);
          const avgDepth = (pts[0][2] + pts[1][2] + pts[2][2] + pts[3][2]) / 4;
          faceQueue.push({ pts, col: f.col, stroke, depth: avgDepth, layer });
        });
      }

      function pushPolyFloor(pts2d, z, fill, layer = 0) {
        const pts = pts2d.map(([px, py]) => project(px, py, z));
        const avgDepth = pts.reduce((acc, p) => acc + p[2], 0) / pts.length;
        faceQueue.push({ pts, col: fill, stroke: "rgba(100,116,139,0.25)", depth: avgDepth, layer });
      }

      function pushBed3D(x, y, z, w, d, pillowTop = true, layer = 1) {
        const bx = mx(x, w);
        pushBox(bx, y, z, w, d, 24, "#f8fafc", "#cbd5e1", "#94a3b8", "rgba(15,23,42,0.45)", layer);
        if (pillowTop) {
          pushBox(bx + 2, y + 38, z + 24, w - 4, d - 40, 6, "#93c5fd", "#60a5fa", "#3b82f6", "rgba(15,23,42,0.45)", layer);
          if (w > 110) {
            const pw = (w - 18) / 2;
            pushBox(bx + 6, y + 6, z + 24, pw, 26, 7, "#ffffff", "#e2e8f0", "#cbd5e1", "rgba(15,23,42,0.45)", layer);
            pushBox(bx + 12 + pw, y + 6, z + 24, pw, 26, 7, "#ffffff", "#e2e8f0", "#cbd5e1", "rgba(15,23,42,0.45)", layer);
          } else {
            pushBox(bx + 8, y + 6, z + 24, w - 16, 26, 7, "#ffffff", "#e2e8f0", "#cbd5e1", "rgba(15,23,42,0.45)", layer);
          }
        } else {
          const px = state.mirrored ? bx + w - 34 : bx + 6;
          const cx = state.mirrored ? bx + 2 : bx + 38;
          pushBox(cx, y + 2, z + 24, w - 40, d - 4, 6, "#93c5fd", "#60a5fa", "#3b82f6", "rgba(15,23,42,0.45)", layer);
          pushBox(px, y + 8, z + 24, 26, d - 16, 7, "#ffffff", "#e2e8f0", "#cbd5e1", "rgba(15,23,42,0.45)", layer);
        }
      }

      function pushStair3D(cx, cy, zBase, totalH, layer = 1) {
        pushBox(cx - 7, cy - 7, zBase, 14, 14, totalH + 20, "#64748b", "#475569", "#334155", "rgba(15,23,42,0.45)", layer);
        const steps = 13;
        const radius = 82;
        for (let i = 0; i < steps; i++) {
          const ang = (i * (Math.PI * 1.65)) / steps - Math.PI * 0.85;
          const sz = zBase + (i / steps) * totalH;
          const sx = cx + Math.cos(ang) * (radius * 0.55) - 16;
          const sy = cy + Math.sin(ang) * (radius * 0.55) - 10;
          pushBox(sx, sy, sz, 32, 20, 6, "#e2e8f0", "#94a3b8", "#64748b", "rgba(15,23,42,0.45)", layer);
        }
      }

      function buildFloor3D(floorKey, zBase, isUpper) {
        const fData = getFloorData(floorKey);
        const wallH = 135;
        const wallTop = isUpper ? "#bae6fd" : "#e2e8f0";
        const wallSideA = isUpper ? "rgba(56,189,248,0.65)" : "rgba(148,163,184,0.85)";
        const wallSideB = isUpper ? "rgba(14,165,233,0.75)" : "rgba(100,116,139,0.85)";
        const floorLayer = isUpper ? 2 : 0;
        const objLayer = isUpper ? 3 : 1;

        // Dalle de base (couche sol)
        pushBox(0, 0, zBase - 12, 660, 900, 12, "#f1f5f9", "#cbd5e1", "#94a3b8", "rgba(15,23,42,0.45)", floorLayer);

        // Sols colorés par pièce (couche sol)
        fData.rooms.forEach((r) => {
          const col = CATEGORY_COLORS[r.category] || "#f8fafc";
          const pts = r.cleanPoly || r.poly;
          if (pts) pushPolyFloor(pts, zBase + 0.5, col, floorLayer);
          else if (r.rect) {
            const [rx, ry, rw, rh] = r.rect;
            pushPolyFloor([[rx, ry], [rx + rw, ry], [rx + rw, ry + rh], [rx, ry + rh]], zBase + 0.5, col, floorLayer);
          }
        });

        // Wrapper local pour placer tous les murs et meubles sur objLayer
        const pushObj = (x, y, z, w, d, h, ft, fsa, fsb, st) => pushBox(x, y, z, w, d, h, ft, fsa, fsb, st, objLayer);

        // Murs extérieurs (30 cm) découpés en 3 segments pour un tri de profondeur précis
        [0, 220, 440].forEach((sx) => {
          pushObj(sx, 0, zBase, 220, 30, wallH, wallTop, wallSideA, wallSideB);
          pushObj(sx, 870, zBase, 220, 30, wallH, wallTop, wallSideA, wallSideB);
        });
        [30, 310, 590].forEach((sy) => {
          pushObj(0, sy, zBase, 30, 280, wallH, wallTop, wallSideA, wallSideB);
          pushObj(630, sy, zBase, 30, 280, wallH, wallTop, wallSideA, wallSideB);
        });

        // Cloisons intérieures
        fData.partitions.forEach(([x, y, w, h]) => {
          pushObj(x, y, zBase, w, h, wallH * 0.94, "#cbd5e1", "rgba(148,163,184,0.75)", "rgba(100,116,139,0.75)");
        });

        // Escalier
        if (fData.stair && floorKey === "rdc") {
          pushStair3D(fData.stair.cx, fData.stair.cy, zBase, wallH, objLayer);
        }

        // Meubles & Sanitaires 3D
        if (floorKey === "rdc") {
          pushObj(mx(294, 332), 33, zBase, 332, 58, 46, "#f8fafc", "#cbd5e1", "#94a3b8");
          pushObj(mx(562, 58), 36, zBase, 58, 52, 95, "#e2e8f0", "#cbd5e1", "#94a3b8");
          pushObj(mx(390, 150), 365, zBase + 36, 150, 85, 5, "#d97706", "#b45309", "#92400e");
          pushObj(mx(398, 134), 373, zBase, 134, 69, 36, "rgba(120,53,15,0.2)", "#78350f", "#78350f");
          [415, 455, 495].forEach((cx) => {
            pushObj(mx(cx, 24), 348, zBase, 24, 14, 24, "#fde68a", "#d97706", "#b45309");
            pushObj(mx(cx, 24), 453, zBase, 24, 14, 24, "#fde68a", "#d97706", "#b45309");
          });
          pushObj(mx(530, 88), 585, zBase, 88, 205, 30, "#64748b", "#475569", "#334155");
          pushObj(mx(state.mirrored ? 530 : 596, 22), 585, zBase + 30, 22, 205, 22, "#475569", "#334155", "#1e293b");
          pushObj(mx(425, 75), 635, zBase, 75, 110, 20, "#d97706", "#b45309", "#92400e");
          pushBed3D(36, 560, zBase, 190, 140, false, objLayer);
          pushObj(mx(36, 40), 155, zBase, 40, 56, 26, "#ffffff", "#e2e8f0", "#cbd5e1");
          pushObj(mx(110, 52), 34, zBase + 35, 52, 36, 12, "#ffffff", "#cbd5e1", "#94a3b8");
        } else {
          pushBed3D(415, 580, zBase, 140, 190, true, objLayer);
          pushBed3D(95, 580, zBase, 140, 190, true, objLayer);
          pushBed3D(430, 120, zBase, 120, 190, true, objLayer);
          pushObj(mx(34, 152), 34, zBase, 152, 72, 32, "#ffffff", "#bae6fd", "#7dd3fc");
          pushObj(mx(34, 44), 120, zBase + 35, 44, 52, 12, "#ffffff", "#cbd5e1", "#94a3b8");
          pushObj(mx(222, 38), 34, zBase, 38, 56, 26, "#ffffff", "#e2e8f0", "#cbd5e1");
        }
      }

      const wallH = 135;
      const zRdc = 0;
      const zEtage = state.view3d.floorFilter === "etage" ? 0 : wallH + state.view3d.explode;

      if (state.view3d.floorFilter !== "etage") buildFloor3D("rdc", zRdc, false);
      if (state.view3d.floorFilter !== "rdc") buildFloor3D("etage", zEtage, true);

      // Tri par couche (dalle/sol avant murs/meubles, RDC avant Étage) puis par profondeur
      faceQueue.sort((a, b) => (a.layer - b.layer) || (a.depth - b.depth));
      faceQueue.forEach((f) => {
        ctx.beginPath();
        ctx.moveTo(f.pts[0][0], f.pts[0][1]);
        for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i][0], f.pts[i][1]);
        ctx.closePath();
        ctx.fillStyle = f.col;
        ctx.fill();
        ctx.strokeStyle = f.stroke;
        ctx.lineWidth = 0.85;
        ctx.stroke();
      });

      // Étiquettes des niveaux
      ctx.font = "bold 13px Inter, sans-serif";
      if (state.view3d.floorFilter !== "etage") {
        const lblRdc = project(-75, 450, zRdc + 65);
        ctx.fillStyle = "#0f172a";
        ctx.fillText("RDC", lblRdc[0] - 18, lblRdc[1]);
      }
      if (state.view3d.floorFilter !== "rdc") {
        const lblEt = project(-75, 450, zEtage + 65);
        ctx.fillStyle = "#0284c7";
        ctx.fillText("ÉTAGE", lblEt[0] - 24, lblEt[1]);
      }
    }

    draw3DScene();

    let dragMode = null; // 'rotate' | 'pan'
    let lastX = 0, lastY = 0;

    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    canvas.addEventListener("mousedown", (e) => {
      dragMode = (e.button === 2 || e.button === 1 || e.shiftKey) ? "pan" : "rotate";
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = dragMode === "pan" ? "move" : "grabbing";
    });
    window.addEventListener("mouseup", () => {
      dragMode = null;
      if (canvas) canvas.style.cursor = "grab";
    });
    window.addEventListener("mousemove", (e) => {
      if (!dragMode) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;

      if (dragMode === "pan") {
        state.view3d.panX += dx;
        state.view3d.panY += dy;
      } else {
        // Axes naturels : glisser à droite tourne vers la droite, glisser en bas incline vers le bas
        state.view3d.yaw -= dx * 0.008;
        state.view3d.pitch = Math.max(0.08, Math.min(1.45, state.view3d.pitch - dy * 0.007));
      }
      draw3DScene();
    });

    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.91;
      state.view3d.scale = Math.max(0.25, Math.min(1.8, +(state.view3d.scale * factor).toFixed(3)));
      draw3DScene();
    }, { passive: false });

    slider.addEventListener("input", () => { state.view3d.explode = Number(slider.value); draw3DScene(); });
    filterSel.addEventListener("change", () => { state.view3d.floorFilter = filterSel.value; draw3DScene(); });
    document.getElementById("top-3d-btn").addEventListener("click", () => {
      state.view3d.yaw = 0;
      state.view3d.pitch = 0.08;
      state.view3d.panX = 0;
      state.view3d.panY = 0;
      draw3DScene();
    });
    document.getElementById("reset-3d-btn").addEventListener("click", () => {
      state.view3d = { yaw: -0.55, pitch: 0.72, explode: 110, scale: 0.56, panX: 0, panY: 40, floorFilter: filterSel.value };
      slider.value = 110;
      draw3DScene();
    });
  }

  function renderSpecsView(container) {
    let totalPlinthes = 0;
    let totalPaint = 0;

    const rdcRows = DATA.floors.rdc.rooms.map((r) => {
      const m = computeRoomMetrics(r);
      totalPlinthes += m.plinthesM;
      totalPaint += m.wallPaintM2;
      return `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${CATEGORY_LABELS[r.category]}</td>
          <td>${r.dimsText}</td>
          <td style="text-align:right"><strong>${r.surface.toFixed(2)} m²</strong></td>
          <td style="text-align:right">${m.plinthesM.toFixed(1)} ml</td>
          <td style="text-align:right">${m.wallPaintM2.toFixed(1)} m²</td>
        </tr>
      `;
    }).join("");

    const etRows = DATA.floors.etage.rooms.map((r) => {
      const m = computeRoomMetrics(r);
      totalPlinthes += m.plinthesM;
      totalPaint += m.wallPaintM2;
      return `
        <tr>
          <td><strong>${r.name}</strong></td>
          <td>${CATEGORY_LABELS[r.category]}</td>
          <td>${r.dimsText}</td>
          <td style="text-align:right"><strong>${r.surface.toFixed(2)} m²</strong></td>
          <td style="text-align:right">${m.plinthesM.toFixed(1)} ml</td>
          <td style="text-align:right">${m.wallPaintM2.toFixed(1)} m²</td>
        </tr>
      `;
    }).join("");

    const joinRows = DATA.joinery.map((j) => `
      <tr>
        <td><strong>${j.code}</strong></td>
        <td>${j.type}</td>
        <td>${j.widthCm} cm</td>
        <td>${j.vent}</td>
        <td>${j.location}</td>
      </tr>
    `).join("");

    container.innerHTML = `
      <div class="data-view">
        <h2>Dossier Technique, Surfaces &amp; Métrés — ${DATA.meta.title} (${DATA.meta.location})</h2>
        <p style="margin-bottom:16px; color:#475569; font-size:13px;">
          Modèle : <strong>${DATA.meta.model}</strong> &nbsp;|&nbsp;
          Structure : <strong>${DATA.meta.structure}</strong> &nbsp;|&nbsp;
          Emprise : <strong>6,60 m × 9,00 m</strong> &nbsp;|&nbsp;
          Surface habitable : <strong>${DATA.meta.totalSurface} m²</strong> &nbsp;|&nbsp;
          Métré estimatif (HSP 2,50 m) : <strong>${totalPlinthes.toFixed(1)} ml</strong> de plinthes, <strong>${totalPaint.toFixed(0)} m²</strong> de murs à peindre
        </p>

        <div class="tables-grid">
          <div>
            <h3 style="margin-bottom:8px; font-size:14px;">Rez-de-Chaussée</h3>
            <table class="spec-table">
              <thead><tr><th>Pièce</th><th>Type</th><th>Dimensions</th><th>Surface</th><th>Plinthes</th><th>Murs (peint.)</th></tr></thead>
              <tbody>
                ${rdcRows}
                <tr class="total-row"><td colspan="3">TOTAL REZ-DE-CHAUSSÉE</td><td style="text-align:right">${DATA.floors.rdc.surfaceTotal.toFixed(2)} m²</td><td colspan="2"></td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <h3 style="margin-bottom:8px; font-size:14px;">Étage</h3>
            <table class="spec-table">
              <thead><tr><th>Pièce</th><th>Type</th><th>Dimensions</th><th>Surface</th><th>Plinthes</th><th>Murs (peint.)</th></tr></thead>
              <tbody>
                ${etRows}
                <tr class="total-row"><td colspan="3">TOTAL ÉTAGE</td><td style="text-align:right">${DATA.floors.etage.surfaceTotal.toFixed(2)} m²</td><td colspan="2"></td></tr>
              </tbody>
            </table>
          </div>
        </div>

        <h3 style="margin-bottom:8px; font-size:14px;">Nomenclature des Menuiseries &amp; Ventilation</h3>
        <table class="spec-table">
          <thead><tr><th>Repère</th><th>Type d'ouverture</th><th>Largeur</th><th>Ventilation</th><th>Localisation</th></tr></thead>
          <tbody>${joinRows}</tbody>
        </table>
      </div>
    `;
  }

  function render(shouldFit = false) {
    if (state.view !== "3d" && typeof window.disposeThree3DView === "function") {
      window.disposeThree3DView();
    }
    const stage = document.getElementById("canvas-stage");
    stage.innerHTML = "";

    const isStatic = state.view === "specs" || state.view === "budget";
    const is2D = state.view !== "3d" && !isStatic;
    stage.classList.toggle("static-view", isStatic);
    stage.classList.toggle("view-3d-full", state.view === "3d");
    stage.classList.toggle("measuring", is2D && state.measureMode);

    const floatCtrl = document.querySelector(".floating-controls");
    if (floatCtrl) floatCtrl.style.display = is2D ? "flex" : "none";
    const floatTools = document.getElementById("floating-tools");
    if (floatTools) floatTools.style.display = is2D ? "flex" : "none";
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.toggle("hidden", !is2D);
    const statusBar = document.querySelector(".statusbar");
    if (statusBar) statusBar.style.display = is2D ? "flex" : "none";

    if (state.view === "3d") {
      render3DView(stage);
      return;
    }
    if (state.view === "specs") {
      renderSpecsView(stage);
      return;
    }
    if (state.view === "budget" && typeof window.renderBudgetView === "function") {
      window.renderBudgetView(stage, state, DATA, computeRoomMetrics, window.__renderAnnotationsSidebar);
      return;
    }

    const sheet = document.createElement("div");
    sheet.className = "sheet-container";

    sheet.innerHTML = `
      <div class="sheet-header">
        <div>
          <div class="sheet-title">${DATA.meta.title} — ${DATA.meta.location}${!state.mirrored ? " (PLAN INVERSÉ)" : ""}</div>
          <div class="sheet-subtitle">${DATA.meta.model} • ${DATA.meta.structure}</div>
        </div>
        <div style="display:flex; align-items:center; gap:14px;">
          <div id="compass-slot">${buildNorthCompassSVG()}</div>
          <div class="sheet-meta">
            <strong>Emprise :</strong> 6,60 m × 9,00 m (Murs 30 cm / Cloisons 6 cm)<br>
            <strong>Surface Totale :</strong> ${DATA.meta.totalSurface} m² (RDC 49,20 m² + Étage 46,58 m²)
          </div>
        </div>
      </div>
      <div class="plans-grid" id="plans-grid"></div>
      <div class="sheet-footer">
        <div class="legend-inline">
          <span class="legend-chip"><span class="legend-swatch" style="background:#fef3c7"></span> Pièce de vie</span>
          <span class="legend-chip"><span class="legend-swatch" style="background:#e0f2fe"></span> Espace nuit</span>
          <span class="legend-chip"><span class="legend-swatch" style="background:#ccfbf1"></span> Pièce d'eau</span>
          <span class="legend-chip"><span class="legend-swatch" style="background:#ede9fe"></span> Rangement</span>
          <span class="legend-chip"><span class="legend-swatch" style="background:#1e293b"></span> Mur porteur 30 cm</span>
          <span class="legend-chip"><span class="legend-swatch" style="background:#dc2626"></span> Électricité / Convecteur</span>
          <span class="legend-chip"><span class="legend-swatch" style="background:#059669"></span> Ventilation (A, E, F, G)</span>
        </div>
        <div>Cotes en centimètres (cm) • Plan mis au propre</div>
      </div>
    `;

    const grid = sheet.querySelector("#plans-grid");

    if (state.view === "both") {
      const b1 = document.createElement("div");
      b1.className = "plan-box";
      b1.innerHTML = `<div class="plan-box-title">REZ-DE-CHAUSSÉE — 49,20 m²</div>`;
      b1.appendChild(buildFloorSVG("rdc", { width: 430 }));

      const b2 = document.createElement("div");
      b2.className = "plan-box";
      b2.innerHTML = `<div class="plan-box-title">ÉTAGE — 46,58 m²</div>`;
      b2.appendChild(buildFloorSVG("etage", { width: 430 }));

      grid.appendChild(b1);
      grid.appendChild(b2);
    } else if (state.view === "rdc") {
      const b = document.createElement("div");
      b.className = "plan-box";
      b.innerHTML = `<div class="plan-box-title">PLAN DU REZ-DE-CHAUSSÉE — 49,20 m²</div>`;
      b.appendChild(buildFloorSVG("rdc", { width: 560 }));
      grid.appendChild(b);
    } else if (state.view === "etage") {
      const b = document.createElement("div");
      b.className = "plan-box";
      b.innerHTML = `<div class="plan-box-title">PLAN DE L'ÉTAGE — 46,58 m²</div>`;
      b.appendChild(buildFloorSVG("etage", { width: 560 }));
      grid.appendChild(b);
    } else if (state.view === "overlay") {
      const b = document.createElement("div");
      b.className = "plan-box";
      b.innerHTML = `<div class="plan-box-title">SUPERPOSITION STRUCTURELLE (RDC en fond + Étage en bleu)</div>`;
      const wrap = document.createElement("div");
      wrap.style.position = "relative";
      const svgRdc = buildFloorSVG("rdc", { width: 540 });
      const svgEt = buildFloorSVG("etage", { width: 540, isOverlayTop: true });
      svgEt.style.position = "absolute";
      svgEt.style.top = "0";
      svgEt.style.left = "0";
      svgEt.style.pointerEvents = "none";
      wrap.appendChild(svgRdc);
      wrap.appendChild(svgEt);
      b.appendChild(wrap);
      grid.appendChild(b);
    }

    stage.appendChild(sheet);
    if (shouldFit) {
      requestAnimationFrame(fitToViewport);
    } else {
      applyTransform();
    }
  }

  // Export SVG / PNG haute définition
  function exportPlan(format) {
    const svgs = document.querySelectorAll(".plan-svg");
    if (!svgs.length) {
      alert("Affichez d'abord un plan 2D (RDC, Étage ou RDC + Étage) pour l'exporter.");
      return;
    }
    const targetSvg = svgs[0];
    const serializer = new XMLSerializer();

    if (format === "svg") {
      svgs.forEach((svg, idx) => {
        const source = '<?xml version="1.0" encoding="UTF-8"?>\n' + serializer.serializeToString(svg);
        const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Plan-Nelly-Fernandez-${svg.dataset.floor || idx}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      });
      return;
    }

    if (format === "png") {
      const gap = 80;
      const singleW = 920;
      const singleH = 1160;
      const totalW = svgs.length === 2 ? singleW * 2 + gap : singleW;
      const scale = 3; // Ultra haute définition
      const canvas = document.createElement("canvas");
      canvas.width = totalW * scale;
      canvas.height = (singleH + 110) * scale;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Titre sur l'image exportée
      ctx.fillStyle = "#0f172a";
      ctx.font = `bold ${28 * scale}px Inter, sans-serif`;
      ctx.fillText(`${DATA.meta.title.toUpperCase()} — ${DATA.meta.location.toUpperCase()} (95,78 m²)`, 40 * scale, 52 * scale);

      let loaded = 0;
      svgs.forEach((svg, idx) => {
        const clone = svg.cloneNode(true);
        clone.setAttribute("width", singleW);
        clone.setAttribute("height", singleH);
        const svgStr = serializer.serializeToString(clone);
        const img = new Image();
        img.onload = () => {
          const xOffset = idx * (singleW + gap);
          ctx.drawImage(img, xOffset * scale, 90 * scale, singleW * scale, singleH * scale);
          loaded++;
          if (loaded === svgs.length) {
            const link = document.createElement("a");
            link.download = `Plan-Nelly-Fernandez-${state.view}.png`;
            link.href = canvas.toDataURL("image/png");
            link.click();
          }
        };
        img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
      });
    }
  }

  function setupPanAndZoom() {
    const stage = document.getElementById("canvas-stage");

    // Zoom à la molette centré sur le curseur
    stage.addEventListener("wheel", (e) => {
      if (state.view === "3d" || state.view === "specs") return;
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
      const newZoom = Math.max(0.3, Math.min(3.5, +(state.zoom * zoomFactor).toFixed(3)));
      const ratio = newZoom / state.zoom;

      state.panX = mouseX - (mouseX - state.panX) * ratio;
      state.panY = mouseY - (mouseY - state.panY) * ratio;
      state.zoom = newZoom;
      applyTransform();
    }, { passive: false });

    // Déplacement (Pan) par cliquer-glisser
    let isDown = false;
    let startX = 0, startY = 0;
    let startPanX = 0, startPanY = 0;

    stage.addEventListener("mousedown", (e) => {
      if (state.view === "3d" || state.view === "specs") return;
      if (e.button !== 0) return;
      isDown = true;
      window.__wasPanning = false;
      startX = e.clientX;
      startY = e.clientY;
      startPanX = state.panX;
      startPanY = state.panY;
      stage.classList.add("panning");
    });

    window.addEventListener("mousemove", (e) => {
      if (!isDown) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      if (Math.hypot(dx, dy) > 4) {
        window.__wasPanning = true;
      }
      state.panX = startPanX + dx;
      state.panY = startPanY + dy;
      applyTransform();
    });

    window.addEventListener("mouseup", () => {
      if (!isDown) return;
      isDown = false;
      stage.classList.remove("panning");
      setTimeout(() => { window.__wasPanning = false; }, 30);
    });
  }

  function init() {
    document.querySelectorAll(".view-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".view-tab").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.view = btn.dataset.view;
        render(true);
      });
    });

    document.querySelectorAll(".layer-toggle").forEach((chk) => {
      chk.addEventListener("change", () => {
        state.layers[chk.dataset.layer] = chk.checked;
        render(false);
      });
    });

    document.getElementById("zoom-in").addEventListener("click", () => {
      const stage = document.getElementById("canvas-stage");
      const cx = stage.clientWidth / 2;
      const cy = stage.clientHeight / 2;
      const newZoom = Math.min(3.5, +(state.zoom * 1.2).toFixed(3));
      const ratio = newZoom / state.zoom;
      state.panX = cx - (cx - state.panX) * ratio;
      state.panY = cy - (cy - state.panY) * ratio;
      state.zoom = newZoom;
      applyTransform();
    });

    document.getElementById("zoom-out").addEventListener("click", () => {
      const stage = document.getElementById("canvas-stage");
      const cx = stage.clientWidth / 2;
      const cy = stage.clientHeight / 2;
      const newZoom = Math.max(0.3, +(state.zoom / 1.2).toFixed(3));
      const ratio = newZoom / state.zoom;
      state.panX = cx - (cx - state.panX) * ratio;
      state.panY = cy - (cy - state.panY) * ratio;
      state.zoom = newZoom;
      applyTransform();
    });

    document.getElementById("zoom-fit").addEventListener("click", fitToViewport);
    document.getElementById("zoom-reset").addEventListener("click", () => {
      state.zoom = 1;
      const stage = document.getElementById("canvas-stage");
      const sheet = document.querySelector(".sheet-container");
      if (stage && sheet) {
        state.panX = Math.round((stage.clientWidth - sheet.offsetWidth) / 2);
        state.panY = Math.round((stage.clientHeight - sheet.offsetHeight) / 2);
      }
      applyTransform();
    });

    const renovateBtn = document.getElementById("btn-renovate");
    const annotateBtn = document.getElementById("btn-annotate");
    const measureBtn = document.getElementById("btn-measure");
    const banner = document.getElementById("measure-banner");

    const noteModal = document.getElementById("note-modal");
    const noteCat = document.getElementById("note-category");
    const noteText = document.getElementById("note-text");
    let pendingNotePos = null;

    window.__openNoteModal = (floor, x, y) => {
      pendingNotePos = { floor, x, y };
      noteText.value = "";
      noteModal.classList.add("open");
      setTimeout(() => noteText.focus(), 30);
    };

    function savePendingNote() {
      if (!pendingNotePos) return;
      const txt = noteText.value.trim();
      if (txt) {
        state.annotations.push({
          id: Date.now(),
          floor: pendingNotePos.floor,
          x: pendingNotePos.x,
          y: pendingNotePos.y,
          cat: noteCat.value,
          text: txt
        });
        localStorage.setItem("nelly_annotations", JSON.stringify(state.annotations));
        renderAnnotationsSidebar();
        render(false);
      }
      pendingNotePos = null;
      noteModal.classList.remove("open");
    }

    document.getElementById("note-save").addEventListener("click", savePendingNote);
    document.getElementById("note-cancel").addEventListener("click", () => {
      pendingNotePos = null;
      noteModal.classList.remove("open");
    });
    noteText.addEventListener("keydown", (e) => {
      if (e.key === "Enter") savePendingNote();
      if (e.key === "Escape") {
        pendingNotePos = null;
        noteModal.classList.remove("open");
      }
    });

    function renderAnnotationsSidebar() {
      const listEl = document.getElementById("annotations-list");
      if (!listEl) return;
      const items = [];
      state.removedPartitions.forEach((pk) => {
        const [fl, idx] = pk.split(":");
        items.push(`
          <div class="annotation-item" style="border-left:3px solid #f97316;">
            <span style="flex:1; color:#fdba74;"><strong>${fl.toUpperCase()}</strong> : Cloison #${Number(idx) + 1} ouverte</span>
            <button class="btn" data-restore-part="${pk}" style="padding:2px 6px; font-size:10px;">Remettre</button>
          </div>
        `);
      });
      state.annotations.forEach((ann, idx) => {
        const col = NOTE_COLORS[ann.cat] || "#f59e0b";
        items.push(`
          <div class="annotation-item">
            <span class="annotation-badge" style="background:${col}">${idx + 1}</span>
            <span style="flex:1; color:#e2e8f0; overflow:hidden; text-overflow:ellipsis;"><strong>${ann.floor.toUpperCase()}</strong> : ${ann.text}</span>
            <button class="btn" data-del-ann="${ann.id}" style="padding:2px 6px; font-size:10px;">✕</button>
          </div>
        `);
      });
      listEl.innerHTML = items.length ? items.join("") : "Aucune note. Utilisez la barre d'outils en bas du plan.";
      listEl.querySelectorAll("[data-del-ann]").forEach((b) => {
        b.addEventListener("click", () => {
          const id = Number(b.dataset.delAnn);
          state.annotations = state.annotations.filter((a) => a.id !== id);
          localStorage.setItem("nelly_annotations", JSON.stringify(state.annotations));
          renderAnnotationsSidebar();
          render(false);
        });
      });
      listEl.querySelectorAll("[data-restore-part]").forEach((b) => {
        b.addEventListener("click", () => {
          const pk = b.dataset.restorePart;
          state.removedPartitions = state.removedPartitions.filter((k) => k !== pk);
          localStorage.setItem("nelly_removed_partitions", JSON.stringify(state.removedPartitions));
          renderAnnotationsSidebar();
          render(false);
        });
      });
    }
    window.__renderAnnotationsSidebar = renderAnnotationsSidebar;
    renderAnnotationsSidebar();

    const selectBtn = document.getElementById("btn-select");
    function clearToolModes(except) {
      if (except !== "measure") state.measureMode = false;
      if (except !== "renovate") state.renovateMode = false;
      if (except !== "annotate") state.annotateMode = false;
      const isSelect = !state.measureMode && !state.renovateMode && !state.annotateMode;
      if (selectBtn) selectBtn.classList.toggle("active", isSelect);
      measureBtn.classList.toggle("active", state.measureMode);
      renovateBtn.classList.toggle("active", state.renovateMode);
      annotateBtn.classList.toggle("active", state.annotateMode);
      banner.classList.toggle("visible", state.measureMode || state.renovateMode || state.annotateMode);
      if (state.measureMode) banner.innerHTML = "Mode Mesure : cliquez 2 points (<strong>Shift</strong> orthogonal, <strong>Échap</strong> annuler)";
      else if (state.renovateMode) banner.innerHTML = "Mode Cloisons : cliquez sur une cloison (6 cm) pour l'ouvrir ou la remettre";
      else if (state.annotateMode) banner.innerHTML = "Mode Annotation : cliquez sur le plan pour ajouter une note de chantier";
    }

    if (selectBtn) {
      selectBtn.addEventListener("click", () => {
        clearToolModes(null);
        render(false);
      });
    }

    // Menu déroulant Exporter
    const exportMenuBtn = document.getElementById("btn-export-menu");
    const exportDropdown = document.getElementById("export-dropdown");
    if (exportMenuBtn && exportDropdown) {
      exportMenuBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle("open");
      });
      window.addEventListener("click", () => exportDropdown.classList.remove("open"));
    }

    function toggleMeasure(force) {
      state.measureMode = typeof force === "boolean" ? force : !state.measureMode;
      state.measurePoints = [];
      clearToolModes(state.measureMode ? "measure" : null);
      render(false);
    }
    measureBtn.addEventListener("click", () => toggleMeasure());

    renovateBtn.addEventListener("click", () => {
      state.renovateMode = !state.renovateMode;
      clearToolModes(state.renovateMode ? "renovate" : null);
      render(false);
    });

    annotateBtn.addEventListener("click", () => {
      state.annotateMode = !state.annotateMode;
      clearToolModes(state.annotateMode ? "annotate" : null);
      render(false);
    });

    document.getElementById("btn-reset-works").addEventListener("click", () => {
      state.removedPartitions = [];
      state.annotations = [];
      localStorage.removeItem("nelly_removed_partitions");
      localStorage.removeItem("nelly_annotations");
      renderAnnotationsSidebar();
      render(false);
    });

    document.getElementById("north-slider").addEventListener("input", (e) => {
      state.northAngle = Number(e.target.value);
      document.getElementById("north-angle-label").textContent = `${state.northAngle}°`;
      const slot = document.getElementById("compass-slot");
      if (slot) slot.innerHTML = buildNorthCompassSVG();
      if (typeof window.updateSun3D === "function") window.updateSun3D();
    });

    document.getElementById("btn-export-png").addEventListener("click", () => exportPlan("png"));
    document.getElementById("btn-export-svg").addEventListener("click", () => exportPlan("svg"));
    document.getElementById("btn-print").addEventListener("click", () => window.print());

    document.getElementById("btn-fullscreen").addEventListener("click", () => {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.().catch(() => {});
      } else {
        document.exitFullscreen?.().catch(() => {});
      }
    });

    document.getElementById("btn-save-project").addEventListener("click", () => {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        northAngle: state.northAngle,
        removedPartitions: state.removedPartitions,
        annotations: state.annotations,
        budget: loadJSON("nelly_budget_v2", null)
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dossier-travaux-nelly-fernandez.json";
      a.click();
      URL.revokeObjectURL(url);
    });

    const fileInput = document.getElementById("project-file-input");
    document.getElementById("btn-load-project").addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          if (Array.isArray(data.removedPartitions)) {
            state.removedPartitions = data.removedPartitions;
            localStorage.setItem("nelly_removed_partitions", JSON.stringify(state.removedPartitions));
          }
          if (Array.isArray(data.annotations)) {
            state.annotations = data.annotations;
            localStorage.setItem("nelly_annotations", JSON.stringify(state.annotations));
          }
          if (typeof data.northAngle === "number") {
            state.northAngle = data.northAngle;
            document.getElementById("north-slider").value = data.northAngle;
            document.getElementById("north-angle-label").textContent = `${data.northAngle}°`;
          }
          if (data.budget) {
            localStorage.setItem("nelly_budget_v2", JSON.stringify(data.budget));
          }
          renderAnnotationsSidebar();
          render(false);
        } catch (err) {
          alert("Fichier de sauvegarde invalide.");
        }
      };
      reader.readAsText(file);
      fileInput.value = "";
    });

    // Raccourcis clavier pro
    window.addEventListener("keydown", (e) => {
      if (e.key === "Shift") state.shiftKey = true;
      if (e.target.tagName === "INPUT") return;
      if (e.key.toLowerCase() === "m") toggleMeasure();
      if (e.key.toLowerCase() === "f") fitToViewport();
      if (e.key === "Escape" && state.measureMode) toggleMeasure(false);
    });
    window.addEventListener("keyup", (e) => {
      if (e.key === "Shift") state.shiftKey = false;
    });

    window.addEventListener("resize", () => {
      if (state.view !== "3d" && state.view !== "specs") fitToViewport();
    });

    setupPanAndZoom();
    render(true);
  }

  window.addEventListener("DOMContentLoaded", init);
})();
