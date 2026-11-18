/**
 * Données géométriques et techniques exactes — Maison Nelly Fernandez (Pélissanne)
 * Modèle d'origine : "SOPHIE" — Solution Parpaing — Chauffage Électrique (5P + 1.N.)
 * Unité de base : 1 unité = 1 cm
 * Enveloppe extérieure : 660 cm (X) × 900 cm (Y)
 * Murs extérieurs : 30 cm | Cloisons intérieures : 6 cm (et 10 cm pour gaine/placard WC RDC)
 */

window.HOUSE_DATA = {
  meta: {
    title: "Maison Nelly Fernandez",
    location: "Pélissanne",
    model: "SOPHIE — Plan de cellule (T.C.E.)",
    structure: "Solution Parpaing — Chauffage Électrique",
    totalSurface: 95.78,
    widthCm: 660,
    depthCm: 900,
    wallExtCm: 30,
    wallIntCm: 6
  },

  // Nomenclature des menuiseries relevées sur les plans d'origine
  joinery: [
    { code: "L1", type: "Châssis / Fenêtre haute", widthCm: 40, vent: "A (Vent. WC)", location: "RDC — Toilettes-WC" },
    { code: "L5", type: "Fenêtre 2 vantaux", widthCm: 120, vent: "E (30 m³/h)", location: "Étage — Chambres 1, 2 & 3" },
    { code: "L7", type: "Fenêtre 2 vantaux", widthCm: 140, vent: "F (30 m³/h)", location: "RDC — Séjour & Chambre 4" },
    { code: "L8", type: "Porte d'entrée", widthCm: 85, vent: "G", location: "RDC — Hall d'entrée" },
    { code: "L14", type: "Châssis / Fenêtre haute", widthCm: 40, vent: "A", location: "Étage — Bains & W.C." },
    { code: "E (Cuis.)", type: "Fenêtre Cuisine 2 vantaux", widthCm: 120, vent: "E", location: "RDC — Cuisine" }
  ],

  floors: {
    rdc: {
      id: "rdc",
      name: "Rez-de-Chaussée",
      shortName: "RDC",
      surfaceTotal: 49.20,
      // Pièces (x, y, w, h en cm, coordonnées intérieures)
      rooms: [
        {
          id: "rdc-wc",
          name: "Toilettes - WC",
          category: "water",
          surface: 2.27,
          // Forme en L autour du petit placard 0.43 m²
          poly: [
            [30, 30], [175, 30], [175, 166], [105, 166], [105, 226], [30, 226]
          ],
          labelPos: [92, 118],
          dimsText: "1,45 m × 1,96 m (L)",
          notes: "Lavabo en partie haute sous châssis L1 (40 cm), cuvette WC en partie basse gauche."
        },
        {
          id: "rdc-placard",
          name: "Placard",
          category: "storage",
          surface: 0.43,
          rect: [105, 166, 70, 60],
          labelPos: [140, 196],
          dimsText: "0,70 m × 0,60 m",
          notes: "Rangement intégré ouvrant sur le Hall."
        },
        {
          id: "rdc-hall",
          name: "Hall",
          category: "circulation",
          surface: 9.05,
          poly: [
            [185, 30], [285, 30], [285, 504], [30, 504], [30, 226], [185, 226]
          ],
          labelPos: [232, 310],
          dimsText: "Sas 1,00 m + Dégagement + Escalier Ø 1,80 m",
          notes: "Entrée principale (porte L8 de 85 cm), escalier hélicoïdal vers l'étage."
        },
        {
          id: "rdc-cuisine",
          name: "Cuisine",
          category: "day",
          surface: 9.12,
          rect: [291, 30, 339, 269],
          labelPos: [460, 165],
          dimsText: "3,39 m × 2,69 m",
          notes: "Fenêtre 120 cm (E), évier 2 bacs, prises 20A et 32A."
        },
        {
          id: "rdc-ch4",
          name: "Chambre 4",
          category: "night",
          surface: 9.18,
          rect: [30, 510, 255, 360],
          labelPos: [157, 685],
          dimsText: "2,55 m × 3,60 m",
          notes: "Porte-fenêtre L7 (140 cm) au sud, convecteur électrique."
        },
        {
          id: "rdc-sejour",
          name: "Séjour",
          category: "day",
          surface: 19.15,
          rect: [291, 305, 339, 565],
          labelPos: [460, 595],
          dimsText: "3,39 m × 5,65 m",
          notes: "Porte-fenêtre L7 (140 cm) au sud, convecteur électrique, double exposition."
        }
      ],
      // Cloisons intérieures [x, y, w, h]
      partitions: [
        // Séparation Toilettes-WC / Hall (ép. 10 cm en haut)
        [175, 30, 10, 196],
        // Séparation WC / Placard 0.43 m² (ép. 6 cm)
        [99, 166, 6, 60],
        // Bas du WC et Placard (ép. 6 cm)
        [30, 226, 155, 6],
        // Séparation Hall / Cuisine & Séjour (ép. 6 cm)
        [285, 30, 6, 474],
        // Séparation Cuisine / Séjour (ép. 6 cm)
        [291, 299, 339, 6],
        // Séparation Hall / Chambre 4 (ép. 6 cm)
        [30, 504, 255, 6],
        // Séparation Chambre 4 / Séjour (ép. 6 cm)
        [285, 510, 6, 360]
      ],
      // Ouvertures dans murs extérieurs : { side: 'top'|'bottom', x, w, code, vent, type }
      extOpenings: [
        { side: "top", x: 71, w: 40, code: "L1", vent: "A", type: "window-high", label: "Vent. WC" },
        { side: "top", x: 197, w: 85, code: "L8", vent: "G", type: "entry-door", swing: "in-right" },
        { side: "top", x: 429, w: 120, code: "", vent: "E", type: "window", label: "Cuisine" },
        { side: "bottom", x: 100, w: 140, code: "L7", vent: "F", type: "window", label: "30 m³" },
        { side: "bottom", x: 420, w: 140, code: "L7", vent: "F", type: "window", label: "30 m³" }
      ],
      // Portes intérieures : { x, y, w, orient: 'v'|'h', swing: 'tl'|'tr'|'bl'|'br'|'lt'|'lb'|'rt'|'rb' }
      intDoors: [
        // Porte WC (sur cloison x=175, ouvrant dans WC vers le haut/gauche)
        { x: 175, y: 120, w: 70, orient: "v", dir: "left-up" },
        // Porte Placard 0.43 (sur cloison x=175, ouvrant vers le Hall)
        { x: 175, y: 172, w: 50, orient: "v", dir: "right-down" },
        // Porte Cuisine (sur cloison x=285, ouvrant dans la cuisine vers le haut)
        { x: 285, y: 205, w: 80, orient: "v", dir: "right-up" },
        // Porte Séjour (sur cloison x=285, ouvrant dans le séjour vers le haut)
        { x: 285, y: 315, w: 80, orient: "v", dir: "right-down" },
        // Porte Chambre 4 (sur cloison y=504, ouvrant dans Ch.4 vers la gauche)
        { x: 195, y: 504, w: 80, orient: "h", dir: "down-left" }
      ],
      // Escalier hélicoïdal
      stair: {
        cx: 120,
        cy: 414,
        radius: 90,
        direction: "up"
      },
      // Équipements sanitaires / cuisine
      fixtures: [
        { type: "sink-wc", x: 110, y: 34, w: 52, h: 36 },
        { type: "toilet", x: 36, y: 155, w: 40, h: 56, dir: "right" },
        { type: "kitchen-sink", x: 424, y: 34, w: 128, h: 56 }
      ],
      // Électricité & chauffage
      electrical: [
        { type: "heater", x: 34, y: 630, orient: "v", label: "C" },
        { type: "heater", x: 626, y: 600, orient: "v", label: "CO" },
        { type: "light", x: 460, y: 145, label: "PL" },
        { type: "light", x: 235, y: 265, label: "PL" },
        { type: "light", x: 460, y: 575, label: "PL" },
        { type: "light", x: 157, y: 675, label: "PL" },
        { type: "outlet", x: 405, y: 36, label: "T 20A" },
        { type: "outlet", x: 565, y: 36, label: "32A" },
        { type: "outlet", x: 390, y: 295, label: "T" },
        { type: "outlet", x: 622, y: 270, label: "T" },
        { type: "panel", x: 276, y: 120, orient: "v", label: "Tab." }
      ],
      // Chaînes de cotes
      dimensions: {
        topOuter: [71, 40, 86, 85, 147, 120, 111],
        topInner: [30, 145, 10, 100, 6, 339, 30],
        bottomInner: [30, 255, 6, 339, 30],
        bottomOuter: [100, 140, 180, 140, 100],
        left: [30, 130, 6, 60, 98, 180, 6, 360, 30],
        right: [30, 269, 6, 565, 30]
      }
    },

    etage: {
      id: "etage",
      name: "Étage",
      shortName: "Étage",
      surfaceTotal: 46.58,
      rooms: [
        {
          id: "et-bains",
          name: "Bains",
          category: "water",
          surface: 3.71,
          rect: [30, 30, 160, 225],
          labelPos: [110, 145],
          dimsText: "1,60 m × 2,25 m",
          notes: "2 châssis hauts L14 (40 cm), baignoire, lavabo, bidet."
        },
        {
          id: "et-wc",
          name: "W.C.",
          category: "water",
          surface: 1.12,
          rect: [196, 30, 85, 130],
          labelPos: [238, 95],
          dimsText: "0,85 m × 1,30 m",
          notes: "Châssis haut A (40 cm), cuvette WC."
        },
        {
          id: "et-placard-ch3",
          name: "Placard",
          category: "storage",
          surface: 0.85,
          rect: [287, 30, 85, 100],
          labelPos: [329, 80],
          dimsText: "0,85 m × 1,00 m",
          notes: "Rangement / gaine technique intégré côté Chambre 3."
        },
        {
          id: "et-ch3",
          name: "Chambre 3",
          category: "night",
          surface: 9.35,
          poly: [
            [372, 30], [630, 30], [630, 328], [287, 328], [287, 130], [372, 130]
          ],
          labelPos: [475, 195],
          dimsText: "3,43 m × 2,98 m (hors placard)",
          notes: "Fenêtre L5 (120 cm) au nord, convecteur électrique."
        },
        {
          id: "et-rang-g",
          name: "Rangement",
          category: "storage",
          surface: 0.94,
          rect: [30, 261, 160, 57],
          labelPos: [110, 290],
          dimsText: "1,60 m × 0,57 m",
          notes: "Placard de dégagement côté ouest."
        },
        {
          id: "et-degagement",
          name: "Dégagement",
          category: "circulation",
          surface: 5.32,
          poly: [
            [196, 166], [281, 166], [281, 334], [399, 334], [399, 504], [190, 504], [190, 324], [30, 324], [30, 504], [190, 504], [190, 324], [196, 324]
          ],
          // Polygone propre incluant la zone palier + trémie escalier
          cleanPoly: [
            [196, 166], [281, 166], [281, 334], [399, 334], [399, 504], [30, 504], [30, 324], [196, 324]
          ],
          labelPos: [295, 425],
          dimsText: "Palier central + trémie escalier",
          notes: "Distribue les 3 chambres, la salle de bains, les WC et les 2 rangements."
        },
        {
          id: "et-rang-d",
          name: "Rangement",
          category: "storage",
          surface: 3.82,
          rect: [405, 334, 225, 170],
          labelPos: [517, 425],
          dimsText: "2,25 m × 1,70 m",
          notes: "Grand dressing / rangement indépendant ouvrant sur le dégagement."
        },
        {
          id: "et-ch2",
          name: "Chambre 2",
          category: "night",
          surface: 10.19,
          rect: [30, 510, 283, 360],
          labelPos: [171, 690],
          dimsText: "2,83 m × 3,60 m",
          notes: "Fenêtre L5 (120 cm) au sud, convecteur électrique."
        },
        {
          id: "et-ch1",
          name: "Chambre 1",
          category: "night",
          surface: 11.20,
          rect: [319, 510, 311, 360],
          labelPos: [474, 690],
          dimsText: "3,11 m × 3,60 m",
          notes: "Fenêtre L5 (120 cm) au sud, convecteur électrique."
        }
      ],
      partitions: [
        // Entre Bains et WC / Dégagement (ép. 6 cm)
        [190, 30, 6, 294],
        // Entre Bains et Rangement gauche (ép. 6 cm)
        [30, 255, 160, 6],
        // Entre Rangement gauche et Escalier (ép. 6 cm)
        [30, 318, 160, 6],
        // Bas du WC (ép. 6 cm)
        [196, 160, 85, 6],
        // Entre WC et Chambre 3 / Placard (ép. 6 cm)
        [281, 30, 6, 304],
        // Placard Ch.3 (ép. 6 cm)
        [287, 130, 85, 6],
        [372, 30, 6, 106],
        // Entre Chambre 3 et Dégagement / Rangement droit (ép. 6 cm)
        [287, 328, 343, 6],
        // Entre Dégagement et Rangement droit (ép. 6 cm)
        [399, 334, 6, 170],
        // Séparation Nord / Sud (ép. 6 cm)
        [30, 504, 600, 6],
        // Séparation Chambre 2 / Chambre 1 (ép. 6 cm)
        [313, 510, 6, 360]
      ],
      extOpenings: [
        { side: "top", x: 71, w: 40, code: "L14", vent: "A", type: "window-high" },
        { side: "top", x: 135, w: 40, code: "L14", vent: "A", type: "window-high" },
        { side: "top", x: 220, w: 40, code: "", vent: "A", type: "window-high" },
        { side: "top", x: 429, w: 120, code: "L5", vent: "E", type: "window", label: "30 m³" },
        { side: "bottom", x: 110, w: 120, code: "L5", vent: "E", type: "window", label: "30 m³" },
        { side: "bottom", x: 430, w: 120, code: "L5", vent: "E", type: "window", label: "30 m³" }
      ],
      intDoors: [
        // Porte Bains
        { x: 190, y: 175, w: 70, orient: "v", dir: "left-up" },
        // Porte WC
        { x: 205, y: 160, w: 65, orient: "h", dir: "up-right" },
        // Porte Rangement gauche
        { x: 190, y: 266, w: 48, orient: "v", dir: "right-down" },
        // Porte Chambre 3
        { x: 281, y: 245, w: 80, orient: "v", dir: "right-up" },
        // Porte Rangement droit
        { x: 399, y: 380, w: 75, orient: "v", dir: "right-down" },
        // Porte Chambre 2
        { x: 225, y: 504, w: 80, orient: "h", dir: "down-left" },
        // Porte Chambre 1
        { x: 325, y: 504, w: 80, orient: "h", dir: "down-right" }
      ],
      stair: {
        cx: 110,
        cy: 414,
        radius: 85,
        direction: "arrival"
      },
      fixtures: [
        { type: "bathtub", x: 34, y: 34, w: 152, h: 72 },
        { type: "sink-bath", x: 34, y: 120, w: 44, h: 52 },
        { type: "bidet", x: 34, y: 190, w: 38, h: 48 },
        { type: "toilet-down", x: 222, y: 34, w: 38, h: 56 }
      ],
      electrical: [
        { type: "heater", x: 34, y: 690, orient: "v", label: "C" },
        { type: "heater", x: 626, y: 690, orient: "v", label: "C" },
        { type: "heater", x: 626, y: 180, orient: "v", label: "C" },
        { type: "light", x: 110, y: 140, label: "PL" },
        { type: "light", x: 238, y: 100, label: "PL" },
        { type: "light", x: 475, y: 185, label: "PL" },
        { type: "light", x: 295, y: 415, label: "PL" },
        { type: "light", x: 171, y: 685, label: "PL" },
        { type: "light", x: 474, y: 685, label: "PL" },
        { type: "outlet", x: 270, y: 515, label: "T" },
        { type: "outlet", x: 340, y: 515, label: "T" }
      ],
      dimensions: {
        topOuter: [71, 40, 24, 40, 45, 40, 169, 120, 111],
        topInner: [30, 160, 6, 85, 6, 343, 30],
        bottomInner: [30, 283, 6, 311, 30],
        bottomOuter: [110, 120, 200, 120, 110],
        left: [30, 225, 6, 57, 6, 180, 6, 360, 30],
        right: [30, 298, 6, 170, 6, 360, 30]
      }
    }
  }
};
