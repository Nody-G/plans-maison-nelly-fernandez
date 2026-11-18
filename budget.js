/**
 * Module Chiffrage & Travaux — Maison Nelly Fernandez (Pélissanne)
 * Calcul automatique des métrés, coûts (Fourniture seule vs Artisan) et Fiche Artisans.
 */
(() => {
  const DEFAULT_PRICES = {
    diy: {
      paintWall: 7,     // €/m² (sous-couche + 2 couches)
      paintCeil: 8,     // €/m²
      floorParquet: 24, // €/m² (stratifié/parquet + sous-couche)
      floorTile: 32,    // €/m² (carrelage + colle/joints)
      plinthe: 6,       // €/ml
      demoCloison: 12,  // €/m² (sac gravats + enduit reprise)
      heater: 260,      // €/u (radiateur inertie)
      windowStd: 480,   // €/u (fenêtre PVC double vitrage fourniture)
      entryDoor: 1100   // €/u
    },
    pro: {
      paintWall: 32,    // €/m² (fourniture + pose)
      paintCeil: 36,    // €/m²
      floorParquet: 58, // €/m²
      floorTile: 85,    // €/m²
      plinthe: 16,      // €/ml
      demoCloison: 55,  // €/m² (dépose + évacuation + reprise)
      heater: 450,      // €/u (fourniture + pose)
      windowStd: 950,   // €/u (pose comprise)
      entryDoor: 2200   // €/u
    }
  };

  function loadBudgetState() {
    try {
      const raw = localStorage.getItem("nelly_budget_v1");
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return {
      mode: "pro", // 'diy' | 'pro'
      ceilingH: 2.5,
      tvaRate: 10,
      contingencyPct: 10,
      prices: { ...DEFAULT_PRICES.pro },
      rooms: {}, // { [roomId]: { paintWall: bool, paintCeil: bool, floor: 'none'|'parquet'|'tile', plinthes: bool } }
      equip: {
        heaters: 0,
        windows: 0,
        entryDoor: 0,
        elecPanel: false,
        vmc: false
      },
      noteCosts: {} // { [noteId]: number }
    };
  }

  function saveBudgetState(b) {
    try {
      localStorage.setItem("nelly_budget_v1", JSON.stringify(b));
    } catch (_) {}
  }

  window.renderBudgetView = function (container, state, DATA, computeRoomMetrics, renderAnnotationsSidebar) {
    const b = loadBudgetState();
    // Synchroniser la hauteur sous plafond globale
    state.ceilingH = b.ceilingH || 2.5;

    const allRooms = [
      ...DATA.floors.rdc.rooms.map((r) => ({ ...r, floorName: "RDC" })),
      ...DATA.floors.etage.rooms.map((r) => ({ ...r, floorName: "Étage" }))
    ];

    // Initialiser les pièces par défaut si vide
    allRooms.forEach((r) => {
      if (!b.rooms[r.id]) {
        b.rooms[r.id] = { paintWall: false, paintCeil: false, floor: "none", plinthes: false };
      }
    });

    // Calcul des totaux
    let sumPaint = 0;
    let sumFloor = 0;
    let sumDemo = 0;
    let sumEquip = 0;
    let sumNotes = 0;

    const roomRowsHtml = allRooms.map((r) => {
      const cfg = b.rooms[r.id];
      const m = computeRoomMetrics(r, b.ceilingH);
      let rowTotal = 0;
      if (cfg.paintWall) rowTotal += m.wallPaintM2 * b.prices.paintWall;
      if (cfg.paintCeil) rowTotal += r.surface * b.prices.paintCeil;
      sumPaint += (cfg.paintWall ? m.wallPaintM2 * b.prices.paintWall : 0) + (cfg.paintCeil ? r.surface * b.prices.paintCeil : 0);

      if (cfg.floor === "parquet") {
        const c = r.surface * b.prices.floorParquet;
        rowTotal += c;
        sumFloor += c;
      } else if (cfg.floor === "tile") {
        const c = r.surface * b.prices.floorTile;
        rowTotal += c;
        sumFloor += c;
      }
      if (cfg.plinthes) {
        const c = m.plinthesM * b.prices.plinthe;
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
              <option value="tile" ${cfg.floor === "tile" ? "selected" : ""}>Carrelage</option>
            </select>
          </td>
          <td style="text-align:center"><input type="checkbox" class="b-room-chk" data-id="${r.id}" data-field="plinthes" ${cfg.plinthes ? "checked" : ""}> <span style="font-size:11px; color:#64748b;">(${m.plinthesM.toFixed(1)}ml)</span></td>
          <td style="text-align:right"><strong>${Math.round(rowTotal).toLocaleString("fr-FR")} €</strong></td>
        </tr>
      `;
    }).join("");

    // Cloisons ouvertes (synchronisées avec 🔨 Cloisons)
    const demoRows = state.removedPartitions.map((pk) => {
      const [fl, idxStr] = pk.split(":");
      const part = DATA.floors[fl]?.partitions[Number(idxStr)];
      if (!part) return "";
      const lenM = Math.max(part[2], part[3]) / 100;
      const areaM2 = lenM * b.ceilingH;
      const cost = areaM2 * b.prices.demoCloison;
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
    sumEquip += (b.equip.heaters || 0) * b.prices.heater;
    sumEquip += (b.equip.windows || 0) * b.prices.windowStd;
    sumEquip += (b.equip.entryDoor || 0) * b.prices.entryDoor;
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

    container.innerHTML = `
      <div class="data-view" style="max-width:1120px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; border-bottom:2px solid #0f172a; padding-bottom:10px; margin-bottom:16px;">
          <div>
            <h2 style="border:none; margin:0; padding:0;">💶 Chiffrage &amp; Préparation Travaux — Maison Nelly Fernandez</h2>
            <span style="font-size:12px; color:#475569;">Cochez les travaux souhaités par pièce : les quantités sont calculées automatiquement d'après le plan.</span>
          </div>
          <div style="display:flex; gap:8px;">
            <button class="btn" id="b-select-all-paint" style="background:#f1f5f9; color:#0f172a; border-color:#cbd5e1;">🎨 Tout peindre</button>
            <button class="btn btn-primary" id="b-print-artisans">📋 Imprimer Fiche Artisans</button>
          </div>
        </div>

        <!-- Paramètres globaux & Synthèse Budget -->
        <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:18px; margin-bottom:20px;">
          <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:14px;">
            <h3 style="font-size:13.5px; margin-bottom:10px;">⚙️ Paramètres du chantier</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; font-size:12.5px;">
              <label>Mode de travaux :
                <select id="b-mode" style="width:100%; padding:5px; margin-top:3px; border-radius:4px; border:1px solid #cbd5e1;">
                  <option value="pro" ${b.mode === "pro" ? "selected" : ""}>Par un artisan (Fourniture + Pose)</option>
                  <option value="diy" ${b.mode === "diy" ? "selected" : ""}>Faire soi-même (Matériaux seuls)</option>
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

        <!-- Prix unitaires rapides -->
        <details style="margin-bottom:16px; background:#f8fafc; border:1px solid #cbd5e1; border-radius:6px; padding:10px 14px;">
          <summary style="cursor:pointer; font-weight:700; font-size:13px;">💶 Ajuster vos prix unitaires (€/m², €/ml, €/unité)</summary>
          <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:10px; margin-top:10px; font-size:12px;">
            <label>Peinture murs (€/m²)<input type="number" class="b-price" data-key="paintWall" value="${b.prices.paintWall}" style="width:100%; padding:4px;"></label>
            <label>Peinture plafond (€/m²)<input type="number" class="b-price" data-key="paintCeil" value="${b.prices.paintCeil}" style="width:100%; padding:4px;"></label>
            <label>Parquet/Strat. (€/m²)<input type="number" class="b-price" data-key="floorParquet" value="${b.prices.floorParquet}" style="width:100%; padding:4px;"></label>
            <label>Carrelage (€/m²)<input type="number" class="b-price" data-key="floorTile" value="${b.prices.floorTile}" style="width:100%; padding:4px;"></label>
            <label>Plinthes (€/ml)<input type="number" class="b-price" data-key="plinthe" value="${b.prices.plinthe}" style="width:100%; padding:4px;"></label>
            <label>Dépose cloison (€/m²)<input type="number" class="b-price" data-key="demoCloison" value="${b.prices.demoCloison}" style="width:100%; padding:4px;"></label>
            <label>Radiateur (€/u)<input type="number" class="b-price" data-key="heater" value="${b.prices.heater}" style="width:100%; padding:4px;"></label>
            <label>Fenêtre 2v (€/u)<input type="number" class="b-price" data-key="windowStd" value="${b.prices.windowStd}" style="width:100%; padding:4px;"></label>
          </div>
        </details>

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
          <!-- Équipements & Menuiseries -->
          <div>
            <h3 style="font-size:14px; margin-bottom:8px;">2. Chauffage, Menuiseries &amp; Réseaux</h3>
            <table class="spec-table">
              <tbody>
                <tr>
                  <td>Radiateurs / Convecteurs (5 sur le plan)</td>
                  <td style="text-align:right"><input type="number" id="b-eq-heaters" min="0" max="10" value="${b.equip.heaters}" style="width:58px; padding:3px; text-align:right;"> u</td>
                </tr>
                <tr>
                  <td>Fenêtres double vitrage (L5 / L7 / Cuisine)</td>
                  <td style="text-align:right"><input type="number" id="b-eq-windows" min="0" max="10" value="${b.equip.windows}" style="width:58px; padding:3px; text-align:right;"> u</td>
                </tr>
                <tr>
                  <td>Porte d'entrée sécurisée (L8)</td>
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

          <!-- Cloisons ouvertes & Notes de chantier -->
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

    container.querySelectorAll(".b-price").forEach((inp) => {
      inp.addEventListener("change", () => {
        b.prices[inp.dataset.key] = Math.max(0, Number(inp.value) || 0);
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
