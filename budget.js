/**
 * Module Chiffrage & Travaux — Maison Nelly Fernandez (Pélissanne)
 * Détail matériaux (formats carrelage 60x120, etc., chutes, cartons/pots) + Pose artisan.
 */
(() => {
  const TILE_FORMATS = {
    "45x45": { label: "45 × 45 cm (Standard)", w: 45, h: 45, waste: 8, boxM2: 1.42 },
    "60x60": { label: "60 × 60 cm (Classique)", w: 60, h: 60, waste: 10, boxM2: 1.44 },
    "30x60": { label: "30 × 60 cm (Rectangulaire)", w: 30, h: 60, waste: 10, boxM2: 1.44 },
    "60x120": { label: "60 × 120 cm (Grand format)", w: 60, h: 120, waste: 13, boxM2: 1.44 },
    "20x120": { label: "20 × 120 cm (Imitation parquet)", w: 20, h: 120, waste: 12, boxM2: 1.20 },
    "custom": { label: "Format personnalisé", w: 60, h: 120, waste: 12, boxM2: 1.44 }
  };

  const DEFAULT_PRICES = {
    diy: {
      paintPotPrice: 65,    // €/pot (ex. 10L)
      paintPotLiters: 10,   // L/pot
      paintYield: 10,       // m²/L
      paintCoats: 2,
      paintLabor: 0,        // €/m² pose
      parquetMat: 24,       // €/m²
      parquetBoxM2: 2.22,
      parquetWaste: 8,
      parquetLabor: 0,
      tileMat: 28,          // €/m² carrelage acheté
      tileFormat: "60x120",
      tileW: 60,
      tileH: 120,
      tileBoxM2: 1.44,
      tileWaste: 13,
      tileLabor: 8,         // colle/joints seuls ~8 €/m²
      plinthe: 6,           // €/ml
      demoCloison: 12,      // €/m²
      heater: 260,          // €/u
      windowStd: 480,       // €/u
      entryDoor: 1100       // €/u
    },
    pro: {
      paintPotPrice: 65,
      paintPotLiters: 10,
      paintYield: 10,
      paintCoats: 2,
      paintLabor: 25,       // €/m² main d'œuvre peintre
      parquetMat: 26,
      parquetBoxM2: 2.22,
      parquetWaste: 8,
      parquetLabor: 32,     // €/m² pose artisan
      tileMat: 32,          // €/m² carrelage choisi
      tileFormat: "60x120",
      tileW: 60,
      tileH: 120,
      tileBoxM2: 1.44,
      tileWaste: 13,
      tileLabor: 55,        // €/m² pose + colle grand format
      plinthe: 16,
      demoCloison: 55,
      heater: 450,
      windowStd: 950,
      entryDoor: 2200
    }
  };

  function loadBudgetState() {
    try {
      const raw = localStorage.getItem("nelly_budget_v2");
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      mode: "pro",
      ceilingH: 2.5,
      tvaRate: 10,
      contingencyPct: 10,
      prices: { ...DEFAULT_PRICES.pro },
      rooms: {},
      equip: {
        heaters: 0,
        windows: 0,
        entryDoor: 0,
        elecPanel: false,
        vmc: false
      },
      noteCosts: {}
    };
  }

  function saveBudgetState(b) {
    try {
      localStorage.setItem("nelly_budget_v2", JSON.stringify(b));
    } catch (_) {}
  }

  window.renderBudgetView = function (container, state, DATA, computeRoomMetrics, renderAnnotationsSidebar) {
    const b = loadBudgetState();
    state.ceilingH = b.ceilingH || 2.5;
    const p = b.prices;

    const allRooms = [
      ...DATA.floors.rdc.rooms.map((r) => ({ ...r, floorName: "RDC" })),
      ...DATA.floors.etage.rooms.map((r) => ({ ...r, floorName: "Étage" }))
    ];

    allRooms.forEach((r) => {
      if (!b.rooms[r.id]) {
        b.rooms[r.id] = { paintWall: false, paintCeil: false, floor: "none", plinthes: false };
      }
    });

    // Prix effectifs au m² (Matériaux + Chutes + Pose)
    const paintMatPerM2 = ((p.paintPotPrice / Math.max(1, p.paintPotLiters)) / Math.max(1, p.paintYield)) * Math.max(1, p.paintCoats);
    const paintTotalPerM2 = paintMatPerM2 + (p.paintLabor || 0);

    const parquetMult = 1 + (p.parquetWaste || 0) / 100;
    const parquetTotalPerM2 = p.parquetMat * parquetMult + (p.parquetLabor || 0);

    const tileMult = 1 + (p.tileWaste || 0) / 100;
    const tileTotalPerM2 = p.tileMat * tileMult + (p.tileLabor || 0);

    let sumPaint = 0;
    let sumFloor = 0;
    let sumDemo = 0;
    let sumEquip = 0;
    let sumNotes = 0;

    // Quantités cumulées pour la liste de courses / commande
    let netPaintM2 = 0;
    let netParquetM2 = 0;
    let netTileM2 = 0;
    let netPlinthesMl = 0;

    const roomRowsHtml = allRooms.map((r) => {
      const cfg = b.rooms[r.id];
      const m = computeRoomMetrics(r, b.ceilingH);
      let rowTotal = 0;

      if (cfg.paintWall) {
        netPaintM2 += m.wallPaintM2;
        const c = m.wallPaintM2 * paintTotalPerM2;
        rowTotal += c;
        sumPaint += c;
      }
      if (cfg.paintCeil) {
        netPaintM2 += r.surface;
        const c = r.surface * paintTotalPerM2;
        rowTotal += c;
        sumPaint += c;
      }
      if (cfg.floor === "parquet") {
        netParquetM2 += r.surface;
        const c = r.surface * parquetTotalPerM2;
        rowTotal += c;
        sumFloor += c;
      } else if (cfg.floor === "tile") {
        netTileM2 += r.surface;
        const c = r.surface * tileTotalPerM2;
        rowTotal += c;
        sumFloor += c;
      }
      if (cfg.plinthes) {
        netPlinthesMl += m.plinthesM;
        const c = m.plinthesM * p.plinthe;
        rowTotal += c;
        sumFloor += c;
      }

      return `
        <tr>
          <td><strong>${r.name}</strong> <span style="color:#64748b; font-size:11px;">(${r.floorName})</span></td>
          <td style="text-align:right">${r.surface.toFixed(2)} m²</td>
          <td style="text-align:right">${m.wallPaintM2.toFixed(1)} m²</td>
          <td style="text-align:center"><input type="checkbox" class="b-room-chk" data-id="${r.id}" data-field="paintWall" ${cfg.paintWall ? "checked" : ""}></td>
          <td style="text-align:center"><input type="checkbox" class="b-room-chk" data-id="${r.id}" data-field="paintCeil" ${cfg.paintCeil ? "checked" : ""}></td>
          <td>
            <select class="b-room-floor" data-id="${r.id}" style="padding:3px 6px; border-radius:4px; border:1px solid #cbd5e1; font-size:12px;">
              <option value="none" ${cfg.floor === "none" ? "selected" : ""}>— Aucun —</option>
              <option value="parquet" ${cfg.floor === "parquet" ? "selected" : ""}>Parquet / Stratifié</option>
              <option value="tile" ${cfg.floor === "tile" ? "selected" : ""}>Carrelage (${p.tileW}×${p.tileH})</option>
            </select>
          </td>
          <td style="text-align:center"><input type="checkbox" class="b-room-chk" data-id="${r.id}" data-field="plinthes" ${cfg.plinthes ? "checked" : ""}> <span style="font-size:11px; color:#64748b;">(${m.plinthesM.toFixed(1)}ml)</span></td>
          <td style="text-align:right"><strong>${Math.round(rowTotal).toLocaleString("fr-FR")} €</strong></td>
        </tr>
      `;
    }).join("");

    // Calculs exacts des commandes (cartons, carreaux, pots)
    const grossTileM2 = netTileM2 * tileMult;
    const tileBoxes = netTileM2 > 0 ? Math.ceil(grossTileM2 / Math.max(0.1, p.tileBoxM2)) : 0;
    const oneTileM2 = (p.tileW * p.tileH) / 10000;
    const tileCount = netTileM2 > 0 ? Math.ceil(grossTileM2 / Math.max(0.01, oneTileM2)) : 0;

    const grossParquetM2 = netParquetM2 * parquetMult;
    const parquetBoxes = netParquetM2 > 0 ? Math.ceil(grossParquetM2 / Math.max(0.1, p.parquetBoxM2)) : 0;

    const paintLiters = netPaintM2 > 0 ? (netPaintM2 * p.paintCoats) / Math.max(1, p.paintYield) : 0;
    const paintPots = paintLiters > 0 ? Math.ceil(paintLiters / Math.max(1, p.paintPotLiters)) : 0;

    const plintheLengthUnit = (p.tileFormat === "60x120" || p.tileFormat === "20x120") ? 1.2 : 0.6;
    const plintheCount = netPlinthesMl > 0 ? Math.ceil((netPlinthesMl * 1.05) / plintheLengthUnit) : 0;

    // Cloisons ouvertes
    const demoRows = state.removedPartitions.map((pk) => {
      const [fl, idxStr] = pk.split(":");
      const part = DATA.floors[fl]?.partitions[Number(idxStr)];
      if (!part) return "";
      const lenM = Math.max(part[2], part[3]) / 100;
      const areaM2 = lenM * b.ceilingH;
      const cost = areaM2 * p.demoCloison;
      sumDemo += cost;
      return `
        <tr>
          <td>Cloison #${Number(idxStr) + 1} (${fl.toUpperCase()})</td>
          <td>${lenM.toFixed(2)} m × ${b.ceilingH.toFixed(2)} m</td>
          <td style="text-align:right">${areaM2.toFixed(1)} m²</td>
          <td style="text-align:right"><strong>${Math.round(cost).toLocaleString("fr-FR")} €</strong></td>
        </tr>
      `;
    }).join("");

    // Équipements
    sumEquip += (b.equip.heaters || 0) * p.heater;
    sumEquip += (b.equip.windows || 0) * p.windowStd;
    sumEquip += (b.equip.entryDoor || 0) * p.entryDoor;
    if (b.equip.elecPanel) sumEquip += b.mode === "pro" ? 1400 : 550;
    if (b.equip.vmc) sumEquip += b.mode === "pro" ? 950 : 320;

    // Notes de chantier
    const noteRows = state.annotations.map((ann, i) => {
      const val = Number(b.noteCosts[ann.id] || 0);
      sumNotes += val;
      return `
        <tr>
          <td><strong>#${i + 1}</strong> (${ann.floor.toUpperCase()})</td>
          <td>${ann.text}</td>
          <td style="text-align:right">
            <input type="number" min="0" step="50" class="b-note-cost" data-id="${ann.id}" value="${val}" style="width:90px; padding:4px 6px; text-align:right; border:1px solid #cbd5e1; border-radius:4px;"> €
          </td>
        </tr>
      `;
    }).join("");

    const totalHT = sumPaint + sumFloor + sumDemo + sumEquip + sumNotes;
    const tvaAmount = totalHT * ((b.tvaRate || 0) / 100);
    const totalTTC = totalHT + tvaAmount;
    const totalWithMargin = totalTTC * (1 + (b.contingencyPct || 0) / 100);

    const tileFormatOpts = Object.entries(TILE_FORMATS).map(([k, v]) =>
      `<option value="${k}" ${p.tileFormat === k ? "selected" : ""}>${v.label}</option>`
    ).join("");

    container.innerHTML = `
      <div class="data-view" style="max-width:1160px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:2px solid #0f172a; padding-bottom:10px; margin-bottom:16px;">
          <div>
            <h2 style="border:none; margin:0; padding:0;">💶 Chiffrage Détaillé &amp; Matériaux — Maison Nelly Fernandez</h2>
            <span style="font-size:12px; color:#475569;">Choisissez vos formats exacts (ex. carrelage 60×120 cm), vos prix d'achat et le coût de pose éventuel.</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" id="b-select-all-paint" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">🎨 Tout peindre</button>
            <button class="btn btn-primary" id="b-print-artisans">📋 Imprimer Fiche Artisans</button>
          </div>
        </div>

        <!-- Paramètres & Synthèse Budget -->
        <div style="display:grid; grid-template-columns: 1.35fr 1fr; gap:16px; margin-bottom:18px;">
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:14px;">
            <h3 style="font-size:13.5px; margin-bottom:10px;">⚙️ Paramètres du chantier</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12.5px;">
              <label>Mode de travaux :
                <select id="b-mode" style="width:100%; padding:5px; margin-top:3px; border-radius:4px; border:1px solid #cbd5e1;">
                  <option value="pro" ${b.mode === "pro" ? "selected" : ""}>Artisan (Fourniture + Pose)</option>
                  <option value="diy" ${b.mode === "diy" ? "selected" : ""}>Faire soi-même (Matériaux)</option>
                </select>
              </label>
              <label>Hauteur sous plafond (m) :
                <input type="number" id="b-ceil-h" min="2.0" max="3.5" step="0.05" value="${b.ceilingH}" style="width:100%; padding:5px; margin-top:3px; border-radius:4px; border:1px solid #cbd5e1;">
              </label>
              <label>TVA (%) :
                <select id="b-tva" style="width:100%; padding:5px; margin-top:3px; border-radius:4px; border:1px solid #cbd5e1;">
                  <option value="10" ${b.tvaRate === 10 ? "selected" : ""}>10 % (Rénovation artisan)</option>
                  <option value="5.5" ${b.tvaRate === 5.5 ? "selected" : ""}>5,5 % (Énergie / Isolation)</option>
                  <option value="20" ${b.tvaRate === 20 ? "selected" : ""}>20 % (Matériaux / Standard)</option>
                  <option value="0" ${b.tvaRate === 0 ? "selected" : ""}>0 % (Affichage HT)</option>
                </select>
              </label>
              <label>Marge d'imprévus (%) :
                <input type="number" id="b-margin" min="0" max="30" step="5" value="${b.contingencyPct}" style="width:100%; padding:5px; margin-top:3px; border-radius:4px; border:1px solid #cbd5e1;">
              </label>
            </div>
          </div>

          <div style="background:#0f172a; color:#f8fafc; border-radius:8px; padding:14px 18px; display:flex; flex-direction:column; justify-content:space-between;">
            <div>
              <div style="font-size:11px; text-transform:uppercase; color:#94a3b8; letter-spacing:0.06em;">Budget Estimatif Global</div>
              <div style="font-size:28px; font-weight:800; color:#38bdf8; margin:4px 0;">${Math.round(totalTTC).toLocaleString("fr-FR")} € <span style="font-size:13px; font-weight:600; color:#cbd5e1;">TTC</span></div>
              <div style="font-size:12px; color:#cbd5e1;">Dont HT : ${Math.round(totalHT).toLocaleString("fr-FR")} € • TVA : ${Math.round(tvaAmount).toLocaleString("fr-FR")} €</div>
            </div>
            <div style="margin-top:10px; padding-top:8px; border-top:1px solid #334155; font-size:12px; color:#fbbf24;">
              Avec marge imprévus (+${b.contingencyPct}%) : <strong>${Math.round(totalWithMargin).toLocaleString("fr-FR")} € TTC</strong>
            </div>
          </div>
        </div>

        <!-- Détail Matériaux, Formats & Pose -->
        <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:14px; margin-bottom:18px;">
          <h3 style="font-size:13.5px; margin-bottom:10px;">🧱 Détail des matériaux achetés &amp; tarifs de pose</h3>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:14px; font-size:12px;">
            <!-- Carte Carrelage -->
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:10px 12px;">
              <div style="font-weight:700; margin-bottom:8px; color:#0f172a;">🟫 Carrelage (Format, Chutes &amp; Pose)</div>
              <label style="display:block; margin-bottom:6px;">Format des carreaux :
                <select id="b-tile-format" style="width:100%; padding:4px; margin-top:2px; border:1px solid #cbd5e1; border-radius:4px;">${tileFormatOpts}</select>
              </label>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:6px;">
                <label>Larg. (cm)<input type="number" class="b-price" data-key="tileW" value="${p.tileW}" style="width:100%; padding:4px;"></label>
                <label>Long. (cm)<input type="number" class="b-price" data-key="tileH" value="${p.tileH}" style="width:100%; padding:4px;"></label>
                <label>m² / carton<input type="number" step="0.01" class="b-price" data-key="tileBoxM2" value="${p.tileBoxM2}" style="width:100%; padding:4px;"></label>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                <label>Achat €/m²<input type="number" class="b-price" data-key="tileMat" value="${p.tileMat}" style="width:100%; padding:4px;"></label>
                <label>Chutes %<input type="number" class="b-price" data-key="tileWaste" value="${p.tileWaste}" style="width:100%; padding:4px;"></label>
                <label>Pose+colle €/m²<input type="number" class="b-price" data-key="tileLabor" value="${p.tileLabor}" style="width:100%; padding:4px;"></label>
              </div>
              <div style="margin-top:6px; color:#0284c7; font-weight:600;">Coût réel tout compris : ${tileTotalPerM2.toFixed(1)} €/m²</div>
            </div>

            <!-- Carte Parquet / Plinthes -->
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:10px 12px;">
              <div style="font-weight:700; margin-bottom:8px; color:#0f172a;">🪵 Parquet / Stratifié &amp; Plinthes</div>
              <div style="display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:6px;">
                <label>Achat parquet €/m²<input type="number" class="b-price" data-key="parquetMat" value="${p.parquetMat}" style="width:100%; padding:4px;"></label>
                <label>Pose parquet €/m²<input type="number" class="b-price" data-key="parquetLabor" value="${p.parquetLabor}" style="width:100%; padding:4px;"></label>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                <label>m² / botte<input type="number" step="0.01" class="b-price" data-key="parquetBoxM2" value="${p.parquetBoxM2}" style="width:100%; padding:4px;"></label>
                <label>Chutes %<input type="number" class="b-price" data-key="parquetWaste" value="${p.parquetWaste}" style="width:100%; padding:4px;"></label>
                <label>Plinthes €/ml<input type="number" class="b-price" data-key="plinthe" value="${p.plinthe}" style="width:100%; padding:4px;"></label>
              </div>
              <div style="margin-top:6px; color:#0284c7; font-weight:600;">Parquet tout compris : ${parquetTotalPerM2.toFixed(1)} €/m²</div>
            </div>

            <!-- Carte Peinture -->
            <div style="background:#fff; border:1px solid #cbd5e1; border-radius:6px; padding:10px 12px;">
              <div style="font-weight:700; margin-bottom:8px; color:#0f172a;">🎨 Peinture (Pots, Couches &amp; Pose)</div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:6px;">
                <label>Prix pot (€)<input type="number" class="b-price" data-key="paintPotPrice" value="${p.paintPotPrice}" style="width:100%; padding:4px;"></label>
                <label>Litres / pot<input type="number" class="b-price" data-key="paintPotLiters" value="${p.paintPotLiters}" style="width:100%; padding:4px;"></label>
                <label>Rend. m²/L<input type="number" class="b-price" data-key="paintYield" value="${p.paintYield}" style="width:100%; padding:4px;"></label>
              </div>
              <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px;">
                <label>Couches<input type="number" min="1" max="4" class="b-price" data-key="paintCoats" value="${p.paintCoats}" style="width:100%; padding:4px;"></label>
                <label>Pose €/m²<input type="number" class="b-price" data-key="paintLabor" value="${p.paintLabor}" style="width:100%; padding:4px;"></label>
                <label>Cloison €/m²<input type="number" class="b-price" data-key="demoCloison" value="${p.demoCloison}" style="width:100%; padding:4px;"></label>
              </div>
              <div style="margin-top:6px; color:#0284c7; font-weight:600;">Peinture tout compris : ${paintTotalPerM2.toFixed(1)} €/m²</div>
            </div>
          </div>
        </div>

        <!-- Récapitulatif quantités à commander -->
        ${(netTileM2 > 0 || netParquetM2 > 0 || netPaintM2 > 0 || netPlinthesMl > 0) ? `
          <div style="background:#ecfdf5; border:1px solid #6ee7b7; border-radius:8px; padding:12px 16px; margin-bottom:18px; font-size:12.5px; color:#065f46;">
            <strong>🛒 Liste de courses / Quantités à commander (chutes incluses) :</strong>
            <div style="display:flex; flex-wrap:wrap; gap:16px; margin-top:6px;">
              ${netTileM2 > 0 ? `<span>🟫 <strong>Carrelage ${p.tileW}×${p.tileH} cm :</strong> ${netTileM2.toFixed(1)} m² nets → <strong>${grossTileM2.toFixed(1)} m²</strong> (${tileBoxes} cartons / ~${tileCount} carreaux)</span>` : ""}
              ${netParquetM2 > 0 ? `<span>🪵 <strong>Parquet :</strong> ${netParquetM2.toFixed(1)} m² nets → <strong>${grossParquetM2.toFixed(1)} m²</strong> (${parquetBoxes} bottes)</span>` : ""}
              ${netPaintM2 > 0 ? `<span>🎨 <strong>Peinture (${p.paintCoats} couches) :</strong> ${netPaintM2.toFixed(1)} m² → <strong>${paintLiters.toFixed(1)} L</strong> (${paintPots} pot(s) de ${p.paintPotLiters} L)</span>` : ""}
              ${netPlinthesMl > 0 ? `<span>📏 <strong>Plinthes :</strong> ${netPlinthesMl.toFixed(1)} ml → <strong>${plintheCount} plinthes</strong> de ${plintheLengthUnit} m</span>` : ""}
            </div>
          </div>
        ` : ""}

        <!-- Tableau par pièce -->
        <h3 style="font-size:14px; margin-bottom:8px;">1. Peinture, Sols &amp; Plinthes par pièce</h3>
        <table class="spec-table" style="margin-bottom:20px;">
          <thead>
            <tr>
              <th>Pièce</th>
              <th style="text-align:right">Sol</th>
              <th style="text-align:right">Murs</th>
              <th style="text-align:center">Peint. Murs</th>
              <th style="text-align:center">Peint. Plafond</th>
              <th>Nouveau Sol</th>
              <th style="text-align:center">Plinthes</th>
              <th style="text-align:right">Estim. HT</th>
            </tr>
          </thead>
          <tbody>${roomRowsHtml}</tbody>
        </table>

        <div class="tables-grid">
          <div>
            <h3 style="font-size:14px; margin-bottom:8px;">2. Chauffage, Menuiseries &amp; Réseaux</h3>
            <table class="spec-table">
              <tbody>
                <tr>
                  <td>Radiateurs / Convecteurs (5 sur le plan) — <input type="number" class="b-price" data-key="heater" value="${p.heater}" style="width:55px; padding:2px;"> €/u</td>
                  <td style="text-align:right"><input type="number" id="b-eq-heaters" min="0" max="10" value="${b.equip.heaters}" style="width:58px; padding:3px; text-align:right;"> u</td>
                </tr>
                <tr>
                  <td>Fenêtres double vitrage — <input type="number" class="b-price" data-key="windowStd" value="${p.windowStd}" style="width:55px; padding:2px;"> €/u</td>
                  <td style="text-align:right"><input type="number" id="b-eq-windows" min="0" max="10" value="${b.equip.windows}" style="width:58px; padding:3px; text-align:right;"> u</td>
                </tr>
                <tr>
                  <td>Porte d'entrée sécurisée (L8) — <input type="number" class="b-price" data-key="entryDoor" value="${p.entryDoor}" style="width:60px; padding:2px;"> €/u</td>
                  <td style="text-align:right"><input type="number" id="b-eq-door" min="0" max="2" value="${b.equip.entryDoor}" style="width:58px; padding:3px; text-align:right;"> u</td>
                </tr>
                <tr>
                  <td>Mise aux normes Tableau Électrique</td>
                  <td style="text-align:right"><input type="checkbox" id="b-eq-elec" ${b.equip.elecPanel ? "checked" : ""}></td>
                </tr>
                <tr>
                  <td>Installation / Remplacement VMC</td>
                  <td style="text-align:right"><input type="checkbox" id="b-eq-vmc" ${b.equip.vmc ? "checked" : ""}></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 style="font-size:14px; margin-bottom:8px;">3. Cloisons à ouvrir &amp; Notes de chantier</h3>
            ${demoRows ? `
              <table class="spec-table" style="margin-bottom:10px;">
                <thead><tr><th>Cloison (via 🔨 Cloisons)</th><th>Dim.</th><th style="text-align:right">Surf.</th><th style="text-align:right">Estim. HT</th></tr></thead>
                <tbody>${demoRows}</tbody>
              </table>
            ` : `<p style="font-size:12px; color:#64748b; margin-bottom:10px;">Aucune cloison ouverte. Activez « 🔨 Cloisons » sur le plan 2D pour en sélectionner.</p>`}

            ${noteRows ? `
              <table class="spec-table">
                <thead><tr><th>Repère</th><th>Note (via 📌 Annoter)</th><th style="text-align:right">Budget HT</th></tr></thead>
                <tbody>${noteRows}</tbody>
              </table>
            ` : `<p style="font-size:12px; color:#64748b;">Aucune note posée. Utilisez « 📌 Annoter » sur le plan 2D pour lister des travaux précis.</p>`}
          </div>
        </div>
      </div>
    `;

    const rerender = () => {
      saveBudgetState(b);
      window.renderBudgetView(container, state, DATA, computeRoomMetrics, renderAnnotationsSidebar);
    };

    document.getElementById("b-mode").addEventListener("change", (e) => {
      b.mode = e.target.value;
      b.prices = { ...DEFAULT_PRICES[b.mode] };
      b.tvaRate = b.mode === "pro" ? 10 : 20;
      rerender();
    });
    document.getElementById("b-ceil-h").addEventListener("change", (e) => {
      b.ceilingH = Math.max(2.0, Math.min(3.5, Number(e.target.value) || 2.5));
      rerender();
    });
    document.getElementById("b-tva").addEventListener("change", (e) => {
      b.tvaRate = Number(e.target.value);
      rerender();
    });
    document.getElementById("b-margin").addEventListener("change", (e) => {
      b.contingencyPct = Number(e.target.value) || 0;
      rerender();
    });

    document.getElementById("b-tile-format").addEventListener("change", (e) => {
      const fmt = e.target.value;
      const spec = TILE_FORMATS[fmt];
      b.prices.tileFormat = fmt;
      if (spec && fmt !== "custom") {
        b.prices.tileW = spec.w;
        b.prices.tileH = spec.h;
        b.prices.tileWaste = spec.waste;
        b.prices.tileBoxM2 = spec.boxM2;
      }
      rerender();
    });

    container.querySelectorAll(".b-price").forEach((inp) => {
      inp.addEventListener("change", () => {
        const key = inp.dataset.key;
        b.prices[key] = Math.max(0, Number(inp.value) || 0);
        if (key === "tileW" || key === "tileH") b.prices.tileFormat = "custom";
        rerender();
      });
    });

    container.querySelectorAll(".b-room-chk").forEach((chk) => {
      chk.addEventListener("change", () => {
        b.rooms[chk.dataset.id][chk.dataset.field] = chk.checked;
        rerender();
      });
    });

    container.querySelectorAll(".b-room-floor").forEach((sel) => {
      sel.addEventListener("change", () => {
        b.rooms[sel.dataset.id].floor = sel.value;
        rerender();
      });
    });

    document.getElementById("b-eq-heaters").addEventListener("change", (e) => { b.equip.heaters = Number(e.target.value) || 0; rerender(); });
    document.getElementById("b-eq-windows").addEventListener("change", (e) => { b.equip.windows = Number(e.target.value) || 0; rerender(); });
    document.getElementById("b-eq-door").addEventListener("change", (e) => { b.equip.entryDoor = Number(e.target.value) || 0; rerender(); });
    document.getElementById("b-eq-elec").addEventListener("change", (e) => { b.equip.elecPanel = e.target.checked; rerender(); });
    document.getElementById("b-eq-vmc").addEventListener("change", (e) => { b.equip.vmc = e.target.checked; rerender(); });

    container.querySelectorAll(".b-note-cost").forEach((inp) => {
      inp.addEventListener("change", () => {
        b.noteCosts[inp.dataset.id] = Math.max(0, Number(inp.value) || 0);
        rerender();
      });
    });

    document.getElementById("b-select-all-paint").addEventListener("click", () => {
      const anyOff = allRooms.some((r) => !b.rooms[r.id].paintWall);
      allRooms.forEach((r) => {
        b.rooms[r.id].paintWall = anyOff;
        b.rooms[r.id].paintCeil = anyOff;
      });
      rerender();
    });

    document.getElementById("b-print-artisans").addEventListener("click", () => {
      window.print();
    });
  };
})();
