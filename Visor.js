/**
 * VISOR.JS · Lógica del Geovisor Santa Elena (vereda Piedras Blancas)
 *
 * Secciones, en orden:
 *   1. Clases de cobertura y categorías del POT 2014
 *   2. Geometrías de demostración (coberturas, predios y vías)
 *   3. Mapa Leaflet y mapas base
 *   4. Capas (POT, catastro) y leyendas
 *   5. Coberturas y cortinilla multitemporal
 *   6. Ficha normativa POT (clic en el mapa)
 *   7. Estadísticas (Chart.js)
 *   8. Análisis espacial (medición, polígonos, buffer)
 *   9. Búsqueda, vistas, geolocalización y exportación
 *  10. Panel lateral y pestañas
 *
 * Librerías (CDN): Leaflet, Leaflet.draw, MiniMap, Turf.js, Chart.js, html2canvas.
 * El POT y los límites se cargan desde GeoJSON locales; las coberturas, predios y vías siguen siendo demostrativos.
 */

/* Diagnóstico: avisa si faltan librerías (sin internet, CDN bloqueado) o si ocurre un error */
(function () {
  const aviso = (m) => {
    const d = document.createElement("div");
    d.style.cssText =
      "position:fixed;z-index:9999;top:60px;left:50%;transform:translateX(-50%);max-width:90%;background:#fde8e8;border:1px solid #ce1126;border-radius:4px;padding:10px 16px;font:14px system-ui";
    d.textContent = m;
    document.body.appendChild(d);
  };
  window.addEventListener("error", (e) => aviso("Error en el geovisor: " + e.message));
  const falta = [
    ["L", "Leaflet"],
    ["turf", "Turf.js"],
    ["Chart", "Chart.js"],
    ["html2canvas", "html2canvas"],
  ]
    .filter(([v]) => typeof window[v] === "undefined")
    .map((x) => x[1]);
  if (falta.length) {
    aviso(
      "No se cargaron estas librerías: " +
        falta.join(", ") +
        ". Revisa tu conexión a internet o si algo bloquea cdnjs.cloudflare.com.",
    );
  }
})();
const $= (s) => document.querySelector(s),$$ = (s) => [...document.querySelectorAll(s)];
const fmt = (n, d = 1) => n.toLocaleString("es-CO", { maximumFractionDigits: d });
const toast = (m) => {
  const t = $("#toast");
  t.textContent = m;
  t.style.display = "block";
  setTimeout(() => (t.style.display = "none"), 2800);
};

/* ---------- Clases y normativa ---------- */
const CL = {
  denso: ["Bosque denso", "#1e6b3a"],
  frag: ["Bosque fragmentado", "#8fbf6a"],
  pasto: ["Pastos / agrícola", "#e2c15d"],
  cons: ["Construido / residencial rural", "#c8553d"],
  agua: ["Cuerpos de agua (embalse)", "#3f8fd2"],
};
// Las categorías se leen de la capa oficial POT 2014 al cargar el GeoJSON recortado.
const POT = {};
const ZN = {};
let potFeatures = [];
const POT_COLORS = ["#2563eb", "#0f766e", "#9333ea", "#d97706", "#db2777", "#475569"];
const safeText = (value) => String(value ?? "Sin dato").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '\"': "&quot;" })[c]);

/* ---------- Geometrías de demostración (lon, lat). Reemplazar por GeoJSON reales ---------- */
const Vp = turf.polygon([
  [
    [-75.512, 6.272],
    [-75.498, 6.266],
    [-75.482, 6.27],
    [-75.474, 6.284],
    [-75.478, 6.3],
    [-75.492, 6.306],
    [-75.508, 6.299],
    [-75.516, 6.285],
    [-75.512, 6.272],
  ],
]);
const rect = (a, b, c, d) => turf.bboxPolygon([a, b, c, d]);
const sq = (x, y, r) => rect(x - r / 111, y - r / 111, x + r / 111, y + r / 111);
const cl = (g) => g && turf.intersect(g, Vp);
const df = (a, ...bs) => {
  for (const b of bs) if (a && b) a = turf.difference(a, b);
  return a;
};
const un = (a, b) => (a ? turf.union(a, b) : b);
const BLT = [
  [-75.503, 6.277, 2015],
  [-75.498, 6.274, 2015],
  [-75.491, 6.296, 2015],
  [-75.506, 6.281, 2020],
  [-75.486, 6.293, 2020],
  [-75.481, 6.281, 2020],
  [-75.501, 6.272, 2020],
  [-75.495, 6.289, 2024],
  [-75.505, 6.287, 2024],
  [-75.488, 6.3, 2024],
  [-75.48, 6.288, 2024],
];
const PAS = [
  [-75.51, 6.292, 0.5],
  [-75.482, 6.275, 0.45],
];
const DATA = {};
function cover(y) {
  const t = (y - 2015) / 9;
  let b = null,
    p = null;
  BLT.forEach(([x, yy, f]) => {
    if (f <= y) b = un(b, sq(x, yy, 0.12 + 0.01 * (y - f)));
  });
  PAS.forEach(
    ([x, yy, r]) =>
      (p = un(
        p,
        turf.buffer(turf.point([x, yy]), r * (1 + 0.2 * t), { units: "kilometers", steps: 8 }),
      )),
  );
  if (y >= 2020) p = un(p, turf.buffer(turf.point([-75.5, 6.298]), 0.35, { units: "kilometers" }));
  if (y >= 2024) p = un(p, turf.buffer(turf.point([-75.486, 6.27]), 0.3, { units: "kilometers" }));
  const w = cl(turf.buffer(turf.point([-75.489, 6.2845]), 0.35, { units: "kilometers", steps: 8 }));
  b = df(cl(b), w);
  p = df(cl(p), w, b);
  const fr = df(cl(turf.buffer(b, 0.25, { units: "kilometers" })), b, w, p);
  return { denso: df(Vp, b, w, p, fr), frag: fr, pasto: p, cons: b, agua: w };
}
[2015, 2020, 2024].forEach((y) => {
  DATA[y] = cover(y);
});
const EMBALSE = cl(
  turf.buffer(turf.point([-75.489, 6.2845]), 0.35, { units: "kilometers", steps: 8 }),
);
/* Predios: malla catastral sintética recortada a la vereda y sin el embalse */
const PRE = (() => {
  const lots = [];
  let n = 0;
  for (let lon = -75.516; lon < -75.474; lon += 0.003)
    for (let lat = 6.266; lat < 6.306; lat += 0.0025) {
      const g = df(cl(rect(lon + 0.00025, lat + 0.00025, lon + 0.00275, lat + 0.00225)), EMBALSE);
      if (g && turf.area(g) > 5000) {
        n++;
        const cod = "05001-PB-" + String(n).padStart(4, "0");
        lots.push({ ...g, properties: { cod, n: "Predio " + cod } });
      }
    }
  return turf.featureCollection(lots);
})();
const VIA = turf.featureCollection([
  turf.lineString(
    [
      [-75.514, 6.283],
      [-75.5, 6.285],
      [-75.489, 6.2905],
      [-75.478, 6.296],
    ],
    { n: "Camino veredal 1" },
  ),
  turf.lineString(
    [
      [-75.5, 6.285],
      [-75.501, 6.272],
      [-75.499, 6.267],
    ],
    { n: "Camino veredal 2" },
  ),
]);
const COR = turf.polygon([
  [
    [-75.55, 6.22],
    [-75.43, 6.225],
    [-75.425, 6.33],
    [-75.55, 6.325],
    [-75.55, 6.22],
  ],
]);
// Coordenada de referencia del Parque Arví; el valor anterior apuntaba fuera del parque.
const PL = { "Parque Arví": [6.26556, -75.49694], "Embalse Piedras Blancas": [6.2845, -75.489] };
PRE.features.forEach((f) => {
  const c = turf.centroid(f).geometry.coordinates;
  PL[f.properties.n] = [c[1], c[0]];
});
$("#dl").innerHTML = Object.keys(PL)
  .map((n) => `<option value="${n}">`)
  .join("");

/* ---------- Mapa ---------- */
const map = L.map("map").fitBounds(L.geoJSON(Vp).getBounds());
// La comparación histórica se dibuja sobre el mapa base y debajo de las capas temáticas.
["izq", "der"].forEach((n) => (map.createPane(n).style.zIndex = 225));
map.createPane("potp").style.zIndex = 390;
const cc = "&copy; OpenStreetMap &copy; CARTO",
  es = "Esri";
const BM = {
  "Carto Positron (claro)": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    { attribution: cc, maxZoom: 19 },
  ),
  "Satélite Esri + nombres": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { attribution: es, maxZoom: 19 },
  ),
  "Relieve sombreado Esri": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
    { attribution: es, maxZoom: 23 },
  ),
  "Topográfico Esri": L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    { attribution: es, maxZoom: 19 },
  ),
  "OpenTopoMap (relieve)": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenTopoMap",
    maxZoom: 17,
  }),
  "Carto Dark Matter (oscuro)": L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    { attribution: cc, maxZoom: 19 },
  ),
};
map.createPane("baseLabels").style.zIndex = 650;
const satelliteLabels = L.tileLayer(
  "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
  { attribution: es, maxZoom: 19, pane: "baseLabels" },
);
const defaultBaseName = Object.keys(BM).find((name) => name.includes("Satélite Esri"));
let base = BM[defaultBaseName].addTo(map);
satelliteLabels.addTo(map);
/* Si el fondo falla, cambia solo a Esri Topo */
let tileErrs = 0;
Object.values(BM).forEach((l) =>
  l.on("tileerror", () => {
    if (base !== l || ++tileErrs < 4) return;
    toast("El mapa base no cargó; se cambió a Esri Topo. Abre el proyecto con Live Server.");
    map.removeLayer(base);
    map.removeLayer(satelliteLabels);
    base = BM["Topográfico Esri"].addTo(map);
    $('[name=bm][value="Topográfico Esri"]').checked = true;
  }),
);
L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
let importedLayer;
let miniImportedLayer;
let miniReferenceLayers = {};
const miniBaseLayer = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  { minZoom: 0, maxZoom: 13, attribution: es },
);
const miniLayers = L.layerGroup([miniBaseLayer]);
$("#geojsonFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  const status = $("#userLayerStatus");
  try {
    const data = JSON.parse(await file.text());
    if (!["FeatureCollection", "Feature", "GeometryCollection", "Polygon", "MultiPolygon", "LineString", "MultiLineString", "Point", "MultiPoint"].includes(data.type)) {
      throw new Error("El archivo no contiene GeoJSON válido.");
    }
    const nextLayer = L.geoJSON(data, {
      style: { color: "#e34a33", weight: 2, fillColor: "#fdbb84", fillOpacity: 0.35 },
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 6, color: "#9e2f20", fillColor: "#fdbb84", fillOpacity: 0.85 }),
    });
    if (!nextLayer.getLayers().length) throw new Error("El archivo no contiene elementos geográficos.");
    if (importedLayer) map.removeLayer(importedLayer);
    importedLayer = nextLayer.addTo(map);
    status.dataset.layerName = file.name;
    if (miniImportedLayer) miniLayers.removeLayer(miniImportedLayer);
    miniImportedLayer = L.geoJSON(data, {
      style: { color: "#e34a33", weight: 2, fillColor: "#fdbb84", fillOpacity: 0.55 },
      pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 5, color: "#9e2f20", fillColor: "#fdbb84", fillOpacity: 0.9 }),
    });
    miniLayers.addLayer(miniImportedLayer);
    const bounds = importedLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom: 16 });
    status.textContent = `Capa cargada: ${file.name} (${importedLayer.getLayers().length} elementos).`;
    renderProjectLegend();
  } catch (error) {
    status.textContent = error instanceof SyntaxError ? "No se pudo leer el archivo. Expórtalo como GeoJSON en UTF-8." : error.message;
  }
});
new L.Control.MiniMap(
  miniLayers,
  {
    toggleDisplay: true,
    zoomLevelOffset: -4,
    zoomAnimation: true,
    aimingRectOptions: { color: "#1d4e89", weight: 1.5, opacity: 0.95, fill: false },
    shadowRectOptions: {
      color: "#1d4e89",
      weight: 1,
      opacity: 0.2,
      fillColor: "#1d4e89",
      fillOpacity: 0.14,
    },
    position: "bottomright",
    width: 180,
    height: 135,
  },
).addTo(map);
map.on(
  "mousemove",
  (e) =>
    ($("#coords").textContent = `Lat ${e.latlng.lat.toFixed(5)} · Lon ${e.latlng.lng.toFixed(5)}`),
);

/* ---------- Capas ---------- */
const at = (ll) => {
  const p = turf.point([ll.lng, ll.lat]);
  const feature = potFeatures.find((f) => turf.booleanPointInPolygon(p, f));
  const z = feature?.properties?._potKey ?? null;
  const cv = (y) => {
    const k = Object.keys(DATA[y]).find(
      (k) => DATA[y][k] && turf.booleanPointInPolygon(p, DATA[y][k]),
    );
    return k ? CL[k][0] : "—";
  };
  return { z, feature, c15: cv(2015), c24: cv(2024) };
};
const predio = (f) => {
  const c = turf.centroid(f).geometry.coordinates,
    r = at({ lat: c[1], lng: c[0] }),
    a = turf.area(f);
  const per = turf.length(turf.polygonToLine(f), { units: "meters" });
  return `<b>Predio ${f.properties.cod}</b><br>Área: ${fmt(a / 1e4, 2)} ha (${fmt(a, 0)} m²)<br>Perímetro: ${fmt(per, 0)} m<br>Zona POT: ${r.z ? POT[r.z].s : "—"}<br>Cobertura 2015: ${r.c15}<br>Cobertura 2024: ${r.c24}`;
};
const PRE_STYLE = { color: "#b00020", weight: 1, fillOpacity: 0.05 };
let selectedPotBounds = null;
let potZoomButton = null;
const G = {
  ver: L.geoJSON(Vp, { style: { color: "#e2a400", weight: 2.4, fill: false }, interactive: false }),
  cor: L.geoJSON(COR, {
    style: { color: "#6b3fa0", weight: 2, dashArray: "8 5", fill: false },
    interactive: false,
  }),
  cons: L.geoJSON(null, {
    renderer: L.canvas({ padding: 0.5 }),
    style: { color: "#7f1d1d", weight: 0.35, fillColor: "#ef573f", fillOpacity: 0.58 },
    onEachFeature: (f, layer) => {
      const p = f.properties || {};
      const safe = (value) =>
        String(value ?? "Sin dato").replace(/[&<>"]/g, (c) =>
          c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
        );
      const area = Number(p.area_const);
      layer.bindPopup(
        `<b>Construcción</b><br>CBML: ${safe(p.cbml)}<br>Tipo: ${safe(p.tipo_const)}<br>Área: ${Number.isFinite(area) ? fmt(area, 1) + " m²" : "Sin dato"}<br>Pisos: ${safe(p.numero_pis)}`,
      );
    },
  }),
  pre: L.geoJSON(PRE, {
    style: PRE_STYLE,
    bubblingMouseEvents: false,
    onEachFeature: (f, l) => {
      l.bindPopup(() => predio(f));
      l.bindTooltip(f.properties.cod, { sticky: true });
      l.on("mouseover", () => l.setStyle({ weight: 2.5, fillOpacity: 0.3 }));
      l.on("mouseout", () => l.setStyle(PRE_STYLE));
    },
  }),
  via: L.geoJSON(VIA, {
    style: { color: "#7a5b3a", weight: 2, dashArray: "2 4" },
    interactive: false,
  }),
  pot: L.geoJSON(
    null,
    {
      pane: "potp",
      onEachFeature: (f, layer) => {
        const p = f.properties || {};
        const detail = `<b>${safeText(p.areagralus)}</b><br>${safeText(p.subcategor)}<br>Código de uso: ${safeText(p.cod_cat_us)} · subcategoría: ${safeText(p.cod_subcat)}<br>Fuente: POT Medellín 2014`;
        const content = document.createElement("div");
        const description = document.createElement("div");
        description.innerHTML = detail;
        const zoomButton = document.createElement("button");
        zoomButton.type = "button";
        zoomButton.className = "btn pri pot-zoom-button";
        zoomButton.textContent = "Acercar a este polígono";
        zoomButton.addEventListener("click", () => {
          const bounds = layer.getBounds();
          if (bounds.isValid()) map.fitBounds(bounds.pad(0.12), { maxZoom: 17, padding: [24, 24] });
          map.closePopup();
        });
        content.append(description, zoomButton);
        layer.bindPopup(content, { maxWidth: 320 });
        layer.on("click", () => {
          selectedPotBounds = layer.getBounds();
          if (potZoomButton) {
            potZoomButton.disabled = false;
            potZoomButton.title = "Acercar al polígono POT seleccionado";
            potZoomButton.setAttribute("aria-label", "Acercar al polígono POT seleccionado");
          }
        });
      },
      style: (f) => ({
        color: POT[f.properties?._potKey]?.c || "#475569",
        fillColor: POT[f.properties?._potKey]?.c || "#475569",
        fillOpacity: 0.2,
        weight: 1.1,
      }),
    },
  ),
};
const potZoomControl = L.control({ position: "topleft" });
potZoomControl.onAdd = () => {
  const button = L.DomUtil.create("button", "leaflet-bar pot-zoom-control");
  button.type = "button";
  button.textContent = "⌖";
  button.title = "Primero selecciona un polígono POT";
  button.setAttribute("aria-label", "Primero selecciona un polígono POT");
  button.disabled = true;
  potZoomButton = button;
  L.DomEvent.disableClickPropagation(button);
  L.DomEvent.on(button, "click", (event) => {
    L.DomEvent.preventDefault(event);
    if (selectedPotBounds?.isValid()) {
      map.fitBounds(selectedPotBounds.pad(0.12), { maxZoom: 17, padding: [24, 24] });
      map.closePopup();
    }
  });
  return button;
};
potZoomControl.addTo(map);
const projectLegend = L.control({ position: "topright" });
projectLegend.onAdd = () => {
  const container = L.DomUtil.create("section", "project-legend leaflet-control");
  container.setAttribute("aria-label", "Leyenda del mapa");
  container.innerHTML = '<b class="project-legend-title">Leyenda del mapa</b><div class="project-legend-items"></div>';
  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);
  return container;
};
projectLegend.addTo(map);
const renderProjectLegend = () => {
  const items = [];
  const addItem = (label, swatch, color) => items.push(`<div class="project-legend-item"><i class="project-legend-swatch ${swatch}"${color ? ` style="--legend-color:${color}"` : ""}></i><span>${safeText(label)}</span></div>`);
  if (map.hasLayer(G.pot)) Object.values(POT).forEach((zone) => addItem(zone.s, "is-pot", zone.c));
  if (map.hasLayer(G.ver)) addItem("Límite veredal Piedras Blancas", "is-vereda");
  if (map.hasLayer(G.cor)) addItem("Corregimiento Santa Elena", "is-corregimiento");
  if (map.hasLayer(G.cons)) addItem("Construcciones registradas", "is-construccion");
  if (map.hasLayer(G.pre)) addItem("Predios (demostración)", "is-predio");
  if (map.hasLayer(G.via)) addItem("Vías (demostración)", "is-via");
  if (importedLayer && map.hasLayer(importedLayer)) {
    addItem($("#userLayerStatus").dataset.layerName || "Capa GeoJSON", "is-imported");
  }
  const content = projectLegend.getContainer()?.querySelector(".project-legend-items");
  if (content) content.innerHTML = items.length ? items.join("") : '<span class="project-legend-empty">Sin capas temáticas activas</span>';
};
const chk = (el, arr) => {
  $(el).innerHTML = arr
    .map(
      ([k, t, on]) =>
        `<label><input type="checkbox" data-k="${k}" ${on ? "checked" : ""}> ${t}</label>`,
    )
    .join("");
  $$(el + " input").forEach((i) => {
    const f = () => {
      const key = i.dataset.k;
      if (i.checked) G[key].addTo(map);
      else map.removeLayer(G[key]);
      renderProjectLegend();
      const miniLayer = miniReferenceLayers[key];
      if (miniLayer) {
        if (i.checked) miniLayers.addLayer(miniLayer);
        else miniLayers.removeLayer(miniLayer);
      }
    };
    i.onchange = f;
    f();
  });
};
chk("#k1", [["pot", "Zonificación POT 2014 · Piedras Blancas", 1]]);
chk("#k2", [
  ["ver", "Límite veredal Piedras Blancas · DATA", 1],
  ["cor", "Corregimiento Santa Elena · DATA", 0],
  ["cons", "Construcciones registradas · 5.266", 1],
  ["pre", "Predios (demostración)", 0],
  ["via", "Vías (demostración)", 0],
]);
const loadLocalGeoJSON = async (filename) => {
  const response = await fetch(`./DATA/${filename}`);
  if (!response.ok) throw new Error(`${filename}: HTTP ${response.status}`);
  const data = await response.json();
  if (data.type !== "FeatureCollection" || !Array.isArray(data.features))
    throw new Error(`${filename}: formato GeoJSON no válido`);
  return data;
};
Promise.all([
  loadLocalGeoJSON("corregimiento_santa_elena.geojson"),
  loadLocalGeoJSON("piedras_blancas.geojson"),
  loadLocalGeoJSON("construcciones_piedras_blancas.geojson"),
  loadLocalGeoJSON("pot_piedras_blancas.geojson"),
])
  .then(([corregimiento, vereda, construcciones, pot]) => {
    G.cor.clearLayers().addData(corregimiento);
    G.ver.clearLayers().addData(vereda);
    G.cons.addData(construcciones);
    constructionFeatures = construcciones.features || [];
    renderConstructionSummary(constructionFeatures);
    if ($$(".tab")[3]?.classList.contains("on")) charts();
    potFeatures = pot.features || [];
    potFeatures.forEach((feature) => {
      const p = feature.properties || {};
      const key = String(p.cod_cat_us ?? p.areagralus ?? "sin-clasificar");
      p._potKey = key;
      if (!POT[key]) {
        const label = p.areagralus || "Uso general sin nombre";
        POT[key] = { s: label, c: POT_COLORS[Object.keys(POT).length % POT_COLORS.length] };
        ZN[key] = [];
      }
      ZN[key].push(feature);
    });
    G.pot.addData(pot);
    $("#lgP").innerHTML = Object.values(POT)
      .map((zone) => `<div><i style="background:${zone.c}"></i>${safeText(zone.s)}</div>`)
      .join("");
    renderProjectLegend();
    miniReferenceLayers = {
      cor: L.geoJSON(corregimiento, { style: { color: "#6b3fa0", weight: 1, fill: false } }),
      ver: L.geoJSON(vereda, { style: { color: "#e6a700", weight: 1.5, fill: false } }),
      cons: L.geoJSON(construcciones, {
        renderer: L.canvas(),
        style: { color: "#7f1d1d", weight: 0.25, fillColor: "#ef573f", fillOpacity: 0.7 },
      }),
      pot: L.geoJSON(G.pot.toGeoJSON(), {
        style: (feature) => ({
          color: POT[feature.properties?._potKey]?.c || "#475569",
          fillColor: POT[feature.properties?._potKey]?.c || "#475569",
          fillOpacity: 0.28,
          weight: 0.8,
        }),
      }),
      pre: L.geoJSON(PRE, { style: PRE_STYLE }),
      via: L.geoJSON(VIA, { style: { color: "#7a5b3a", weight: 1, dashArray: "2 3" } }),
    };
    Object.entries(miniReferenceLayers).forEach(([key, layer]) => {
      if (map.hasLayer(G[key])) miniLayers.addLayer(layer);
    });
    const area = construcciones.features.reduce(
      (total, feature) => total + (Number(feature.properties?.area_const) || 0),
      0,
    );
    const potAreaHa = potFeatures.reduce((total, feature) => total + turf.area(feature) / 10000, 0);
    const veredaAreaHa = vereda.features.reduce((total, feature) => total + turf.area(feature) / 10000, 0);
    $("#realDataStatus").textContent = `${construcciones.features.length.toLocaleString("es-CO")} construcciones registradas · ${fmt(area / 10000, 2)} ha construidas. POT 2014: ${potFeatures.length} polígonos en ${fmt(potAreaHa, 2)} ha de ${fmt(veredaAreaHa, 0)} ha de la vereda.`;
    $("#demo").textContent = "Límites y construcciones · DATA";
    const center = turf.centroid(vereda.features[0]).geometry.coordinates;
    PL["Piedras Blancas"] = [center[1], center[0]];
    $("#dl").innerHTML = Object.keys(PL).map((name) => `<option value="${name}">`).join("");
    map.fitBounds(G.ver.getBounds().pad(0.08));
  })
  .catch((error) => {
    $("#realDataStatus").textContent = "No se pudieron cargar las capas DATA. Abre el proyecto con Live Server para servir estos GeoJSON.";
    $("#constructionAnalysisStatus").textContent = "No se pudo cargar el análisis. Verifica que DATA/construcciones_piedras_blancas.geojson esté disponible.";
    console.error("Error al cargar capas de DATA:", error);
  });
$("#bm").innerHTML = Object.keys(BM)
  .map(
    (k, i) =>
      `<label><input type="radio" name="bm" value="${k}" ${k === defaultBaseName ? "checked" : ""}> ${k}</label>`,
  )
  .join("");
$$("[name=bm]").forEach(
  (r) =>
    (r.onchange = () => {
      map.removeLayer(base);
      base = BM[r.value];
      if (!sw.on) base.addTo(map).bringToBack();
      if (r.value === defaultBaseName) satelliteLabels.addTo(map);
      else map.removeLayer(satelliteLabels);
    }),
);
$("#lgP").innerHTML = "<p class=\"nt\">Cargando categorías POT…</p>";

/* ---------- Coberturas y cortinilla ---------- */
let lay = [];
const sw = { on: false, o: "v", f: 0.5, l: null, r: null };
let waybackItems = [];
const waybackFallback = {
  l: { requested: null, attempts: new Map() },
  r: { requested: null, attempts: new Map() },
};
const waybackTileUrl = (item, coords) => item.itemURL
  .replace("{level}", String(coords.z))
  .replace("{row}", String(coords.y))
  .replace("{col}", String(coords.x));
const canLoadWaybackTile = (item, coords) => new Promise((resolve) => {
  const image = new Image();
  let finished = false;
  const done = (loaded) => {
    if (finished) return;
    finished = true;
    clearTimeout(timeout);
    resolve(loaded);
  };
  const timeout = setTimeout(() => done(false), 2500);
  image.onload = () => done(true);
  image.onerror = () => done(false);
  image.src = waybackTileUrl(item, coords);
});
const nearbyWaybackItems = (releaseNum) => {
  const selected = waybackItems.find((item) => item.releaseNum === Number(releaseNum));
  if (!selected) return [];
  const selectedTime = Date.parse(selected.releaseDateLabel);
  const nearby = waybackItems
    .filter((item) => item.releaseNum !== selected.releaseNum)
    .sort((a, b) => Math.abs(Date.parse(a.releaseDateLabel) - selectedTime) - Math.abs(Date.parse(b.releaseDateLabel) - selectedTime))
    .slice(0, 4);
  const yearly = [];
  for (let year = 2014; year <= new Date().getFullYear(); year += 2) {
    const target = Date.parse(String(year) + "-07-01");
    const closest = waybackItems.reduce((best, item) =>
      Math.abs(Date.parse(item.releaseDateLabel) - target) < Math.abs(Date.parse(best.releaseDateLabel) - target) ? item : best,
    waybackItems[0]);
    yearly.push(closest);
  }
  return [...new Map([...nearby, ...yearly, waybackItems[waybackItems.length - 1]]
    .filter((item) => item.releaseNum !== selected.releaseNum)
    .map((item) => [item.releaseNum, item])).values()]
    .sort((a, b) => Math.abs(Date.parse(a.releaseDateLabel) - selectedTime) - Math.abs(Date.parse(b.releaseDateLabel) - selectedTime));
};
const findWaybackFallback = async (releaseNum, coords, side, layer) => {
  const state = waybackFallback[side];
  const tileKey = String(coords.z) + "/" + coords.x + "/" + coords.y;
  let tried = state.attempts.get(tileKey);
  if (!tried) {
    tried = new Set();
    state.attempts.set(tileKey, tried);
  }
  if (tried.has(Number(releaseNum))) return;
  tried.add(Number(releaseNum));
  const original = waybackItems.find((item) => item.releaseNum === Number(releaseNum));
  if (!original || !(await canLoadWaybackTile(original, coords)) || !map.hasLayer(layer)) {
    if (!original || !map.hasLayer(layer)) return;
    const candidates = nearbyWaybackItems(state.requested ?? releaseNum)
      .filter((candidate) => !tried.has(candidate.releaseNum));
    candidates.forEach((candidate) => tried.add(candidate.releaseNum));
    const available = await Promise.all(candidates.map(async (candidate) =>
      (await canLoadWaybackTile(candidate, coords)) ? candidate : null));
    const fallback = available.find(Boolean);
    if (fallback && map.hasLayer(layer)) {
      sw[side] = fallback.releaseNum;
      state.requested = fallback.releaseNum;
      $(side === "l" ? "#yl" : "#yr").value = String(fallback.releaseNum);
      $("#waybackStatus").textContent = "La versión " + original.releaseDateLabel + " no tiene imagen disponible en esta zona y nivel de zoom. Se muestra la versión cercana " + fallback.releaseDateLabel + ".";
      paint();
      return;
    }
    $("#waybackStatus").textContent = "No hay mosaicos disponibles para " + original.releaseDateLabel + " ni para versiones cercanas en esta zona y nivel de zoom.";
  } else if (map.hasLayer(layer)) {
    layer.redraw();
  }
};
const waybackTile = (releaseNum, pane) => {
  const item = waybackItems.find((entry) => entry.releaseNum === Number(releaseNum));
  if (!item?.itemURL) return null;
  const url = item.itemURL
    .replace("{level}", "{z}")
    .replace("{row}", "{y}")
    .replace("{col}", "{x}");
  const layer = L.tileLayer(url, {
    pane,
    attribution: "Esri, World Imagery Wayback",
    maxZoom: 19,
    crossOrigin: true,
  });
  const side = pane === "izq" ? "l" : "r";
  layer.on("tileerror", (event) => {
    layer._waybackTileErrors = (layer._waybackTileErrors || 0) + 1;
    if (layer._waybackTileErrors < 2 || layer._waybackFallbackBusy || !event.coords) return;
    layer._waybackFallbackBusy = true;
    findWaybackFallback(releaseNum, event.coords, side, layer)
      .finally(() => { layer._waybackFallbackBusy = false; });
  });
  return layer;
};
function paint() {
  lay.forEach((l) => map.removeLayer(l));
  lay = [];
  if (sw.on && waybackItems.length) {
    // Oculta el mosaico base actual para que nunca se mezcle con el histórico.
    if (map.hasLayer(base)) map.removeLayer(base);
    lay = [waybackTile(sw.l, "izq"), waybackTile(sw.r, "der")].filter(Boolean);
  } else {
    if (!map.hasLayer(base)) base.addTo(map).bringToBack();
  }
  lay.forEach((l) => l.addTo(map));
  clip();
}
function clip() {
  const c = $("#cort"),
    b = $("#ban");
  c.style.display = b.style.display = sw.on ? "block" : "none";
  if (!sw.on) return;
  const s = map.getSize(),
    nw = map.containerPointToLayerPoint([0, 0]),
    se = map.containerPointToLayerPoint(s);
  let a, z;
  if (sw.o === "v") {
    const x = nw.x + s.x * sw.f;
    a = `rect(${nw.y}px,${x}px,${se.y}px,${nw.x}px)`;
    z = `rect(${nw.y}px,${se.x}px,${se.y}px,${x}px)`;
    c.style.left = sw.f * 100 + "%";
    c.style.top = "";
  } else {
    const y = nw.y + s.y * sw.f;
    a = `rect(${nw.y}px,${se.x}px,${y}px,${nw.x}px)`;
    z = `rect(${y}px,${se.x}px,${se.y}px,${nw.x}px)`;
    c.style.top = sw.f * 100 + "%";
    c.style.left = "";
  }
  map.getPane("izq").style.clip = a;
  map.getPane("der").style.clip = z;
  c.className = sw.o;
  const label = (release) =>
    waybackItems.find((item) => item.releaseNum === Number(release))?.releaseDateLabel || "—";
  b.textContent = `${label(sw.l)} (${sw.o === "v" ? "izquierda" : "arriba"}) · ${label(sw.r)} (${sw.o === "v" ? "derecha" : "abajo"})`;
  c.setAttribute("aria-orientation", sw.o === "v" ? "horizontal" : "vertical");
  c.setAttribute("aria-valuenow", String(Math.round(sw.f * 100)));
  c.setAttribute(
    "aria-valuetext",
    `${Math.round(sw.f * 100)} por ciento; ${label(sw.l)} a la izquierda o arriba y ${label(sw.r)} a la derecha o abajo`,
  );
}
map.on("move zoom resize", clip);
const refreshWaybackLink = () => {
  const bounds = map.getBounds();
  const extent = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
    .map((value) => value.toFixed(5))
    .join(",");
  const center = map.getCenter();
  const view = [center.lng.toFixed(5), center.lat.toFixed(5), map.getZoom()].join(",");
  $("#waybackLink").href = `https://livingatlas.arcgis.com/wayback/?ext=${encodeURIComponent(extent)}&mapCenter=${encodeURIComponent(view)}&localChangesOnly=true`;
};
map.on("moveend zoomend", refreshWaybackLink);
refreshWaybackLink();
const loadWaybackCatalog = async () => {
  const response = await fetch("https://s3-us-west-2.amazonaws.com/config.maptiles.arcgis.com/waybackconfig.json");
  if (!response.ok) throw new Error("No se pudo consultar el catálogo histórico de Esri.");
  const catalog = await response.json();
  waybackItems = Object.entries(catalog)
    .filter(([key, item]) => /^\d+$/.test(key) && item?.itemURL && item?.itemTitle)
    .map(([key, item]) => {
      const date = item.itemTitle.match(/\d{4}-\d{2}-\d{2}/)?.[0];
      return date ? { ...item, releaseNum: Number(key), releaseDateLabel: date } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.releaseDateLabel.localeCompare(b.releaseDateLabel));
  if (waybackItems.length < 2) throw new Error("Esri no devolvió suficientes fechas históricas.");
  const options = waybackItems
    .map((item) => `<option value="${item.releaseNum}">${item.releaseDateLabel}</option>`)
    .join("");
  ["yl", "yr"].forEach((id) => {
    $("#" + id).innerHTML = options;
    $("#" + id).onchange = (e) => {
      const side = id === "yl" ? "l" : "r";
      sw[side] = Number(e.target.value);
      waybackFallback[side].requested = sw[side];
      waybackFallback[side].attempts.clear();
      paint();
    };
  });
  const mid2020 = new Date("2020-07-01").getTime();
  const release2020 = waybackItems.reduce((closest, item) =>
    Math.abs(Date.parse(item.releaseDateLabel) - mid2020) <
    Math.abs(Date.parse(closest.releaseDateLabel) - mid2020)
      ? item
      : closest,
  );
  sw.l = release2020.releaseNum;
  sw.r = waybackItems[waybackItems.length - 1].releaseNum;
  waybackFallback.l.requested = sw.l;
  waybackFallback.r.requested = sw.r;
  $("#yl").value = String(sw.l);
  $("#yr").value = String(sw.r);
  $("#sw").disabled = false;
  $("#waybackStatus").textContent = `${waybackItems.length} versiones disponibles. Inicia comparando ${release2020.releaseDateLabel} con ${waybackItems[waybackItems.length - 1].releaseDateLabel}; puedes cambiar cualquiera de las dos fechas.`;
  paint();
};
loadWaybackCatalog().catch((error) => {
  $("#waybackStatus").textContent = "No se pudieron cargar las imágenes históricas de Esri. Revisa la conexión y vuelve a intentarlo.";
  $("#sw").disabled = true;
  console.error("Error al cargar el archivo Wayback de Esri:", error);
});
$("#sw").onchange = (e) => {
  sw.on = e.target.checked;
  paint();
};
$$("[name=o]").forEach(
  (r) =>
    (r.onchange = () => {
      sw.o = r.value;
      sw.f = 0.5;
      paint();
    }),
);
let drag = false;
let dragOffset = 0;
const cort = $("#cort");
L.DomEvent.disableClickPropagation(cort);
L.DomEvent.disableScrollPropagation(cort);
const moveDivider = (e) => {
  const r = $("#map").getBoundingClientRect();
  const origin = sw.o === "v" ? r.left : r.top;
  const size = sw.o === "v" ? r.width : r.height;
  const pointer = sw.o === "v" ? e.clientX : e.clientY;
  sw.f = Math.min(
    0.98,
    Math.max(0.02, (pointer - origin - dragOffset) / size),
  );
  clip();
};
cort.onpointerdown = (e) => {
  if (!sw.on) return;
  e.preventDefault();
  e.stopPropagation();
  const r = $("#map").getBoundingClientRect();
  const origin = sw.o === "v" ? r.left : r.top;
  const size = sw.o === "v" ? r.width : r.height;
  const pointer = sw.o === "v" ? e.clientX : e.clientY;
  const divider = origin + sw.f * size;
  // Al tomar el mando circular conserva el punto de agarre; al tocar la guía, salta a ese punto.
  dragOffset = Math.abs(pointer - divider) <= 26 ? pointer - divider : 0;
  drag = true;
  cort.setPointerCapture(e.pointerId);
  if (!dragOffset) moveDivider(e);
};
cort.onpointermove = (e) => {
  if (!drag) return;
  e.preventDefault();
  e.stopPropagation();
  moveDivider(e);
};
const stopDividerDrag = (e) => {
  e.stopPropagation();
  drag = false;
};
cort.onpointerup = stopDividerDrag;
cort.onpointercancel = stopDividerDrag;
cort.onkeydown = (e) => {
  const step = e.shiftKey ? 0.1 : 0.02;
  let next = sw.f;
  if (sw.o === "v" && e.key === "ArrowLeft") next -= step;
  else if (sw.o === "v" && e.key === "ArrowRight") next += step;
  else if (sw.o === "h" && e.key === "ArrowUp") next -= step;
  else if (sw.o === "h" && e.key === "ArrowDown") next += step;
  else return;
  e.preventDefault();
  e.stopPropagation();
  sw.f = Math.min(0.98, Math.max(0.02, next));
  clip();
};
paint();

/* ---------- Ficha POT ---------- */
const row = (a, b) => `<tr><th>${a}</th><td>${b}</td></tr>`;
function ficha(ll) {
  const r = at(ll);
  if (!r.z)
    return `<p>Este punto no tiene una categoría en la capa de usos generales POT 2014 recortada a Piedras Blancas. La fuente no cubre toda la vereda.</p>`;
  const z = POT[r.z];
  const p = r.feature.properties || {};
  return `<h3 style="color:${z.c}">${safeText(p.areagralus)}</h3><table class="ft">${row("Corregimiento", "Santa Elena")}${row("Vereda", "Piedras Blancas")}${row("Uso general POT", safeText(p.areagralus))}${row("Subcategoría", safeText(p.subcategor))}${row("Código de uso", safeText(p.cod_cat_us))}${row("Código de subcategoría", safeText(p.cod_subcat))}</table><p class="nt">Fuente: capa Usos Generales del POT de Medellín (2014), recortada al límite veredal de Piedras Blancas. Las categorías describen esta capa y no sustituyen la consulta normativa vigente.</p>`;
}
let drawing = false;
map.on("click", (e) => {
  if (drawing) return;
  const r = at(e.latlng);
  $("#ficha").innerHTML = ficha(e.latlng);
  L.popup({ maxWidth: 300 })
    .setLatLng(e.latlng)
    .setContent(
      `<b>${r.z ? safeText(POT[r.z].s) : "Sin categoría POT en esta fuente"}</b><br>Corregimiento Santa Elena · Vereda Piedras Blancas<br><a href="#" onclick="tab(2);return false">Ver ficha completa</a>`,
    )
    .openOn(map);
});

/* ---------- Análisis de las construcciones DATA ---------- */
let floorChart, typeChart, areaChart;
let constructionFeatures = [];
const renderConstructionSummary = (features) => {
  const areas = features
    .map((feature) => Number(feature.properties?.area_const))
    .filter((area) => Number.isFinite(area) && area > 0)
    .sort((a, b) => a - b);
  const totalArea = areas.reduce((total, area) => total + area, 0);
  const averageArea = areas.length ? totalArea / areas.length : 0;
  const middle = Math.floor(areas.length / 2);
  const medianArea = areas.length
    ? areas.length % 2 ? areas[middle] : (areas[middle - 1] + areas[middle]) / 2
    : 0;
  const card = (value, label, detail) =>
    '<div class="k"><b>' + value + '</b><span>' + label + '</span><em>' + detail + '</em></div>';
  $("#kp").innerHTML = [
    card(fmt(features.length, 0), "Construcciones registradas", "Elementos en la capa DATA"),
    card(fmt(totalArea / 10000, 2) + " ha", "Área construida total", fmt(areas.length, 0) + " construcciones con área válida"),
    card(fmt(averageArea, 1) + " m²", "Área promedio", "Por construcción registrada"),
    card(fmt(medianArea, 1) + " m²", "Área mediana", "La mitad tiene esta área o menos"),
  ].join("");
  $("#constructionAnalysisStatus").textContent =
    "Resumen de " + fmt(features.length, 0) + " construcciones del archivo DATA de Piedras Blancas. Es una fotografía del catastro disponible; no representa crecimiento por años.";
};
function charts() {
  if (!constructionFeatures.length || floorChart) return;
  const textColor = document.body.dataset.theme === "dark" ? "#e6edf7" : "#1b2a41";
  const gridColor = document.body.dataset.theme === "dark" ? "#334154" : "#d9dee5";
  const chartOptions = {
    responsive: true,
    plugins: { legend: { labels: { color: textColor } } },
    scales: {
      x: { ticks: { color: textColor }, grid: { color: gridColor } },
      y: { ticks: { color: textColor }, grid: { color: gridColor } },
    },
  };
  const floors = { "1 piso": 0, "2 pisos": 0, "3 o más pisos": 0, "Sin dato o 0": 0 };
  const types = new Map();
  const areas = { "Menos de 50 m²": 0, "50–99 m²": 0, "100–199 m²": 0, "200 m² o más": 0, "Sin área": 0 };
  constructionFeatures.forEach((feature) => {
    const properties = feature.properties || {};
    const storeys = Number(properties.numero_pis);
    if (storeys === 1) floors["1 piso"]++;
    else if (storeys === 2) floors["2 pisos"]++;
    else if (storeys >= 3) floors["3 o más pisos"]++;
    else floors["Sin dato o 0"]++;
    const type = String(properties.tipo_const || "Sin código");
    types.set(type, (types.get(type) || 0) + 1);
    const area = Number(properties.area_const);
    if (!Number.isFinite(area) || area <= 0) areas["Sin área"]++;
    else if (area < 50) areas["Menos de 50 m²"]++;
    else if (area < 100) areas["50–99 m²"]++;
    else if (area < 200) areas["100–199 m²"]++;
    else areas["200 m² o más"]++;
  });
  floorChart = new Chart($("#cb"), {
    type: "bar",
    data: {
      labels: Object.keys(floors),
      datasets: [{ label: "Construcciones", data: Object.values(floors), backgroundColor: "#3979b9" }],
    },
    options: { ...chartOptions, indexAxis: "y", plugins: { legend: { display: false } } },
  });
  const typeRows = [...types.entries()].sort((a, b) => b[1] - a[1]);
  typeChart = new Chart($("#cd"), {
    type: "bar",
    data: {
      labels: typeRows.map(([code]) => "Código " + code),
      datasets: [{ label: "Construcciones", data: typeRows.map(([, count]) => count), backgroundColor: "#2d8b83" }],
    },
    options: { ...chartOptions, indexAxis: "y", plugins: { legend: { display: false } } },
  });
  areaChart = new Chart($("#ca"), {
    type: "bar",
    data: {
      labels: Object.keys(areas),
      datasets: [{ label: "Construcciones", data: Object.values(areas), backgroundColor: "#d49b35" }],
    },
    options: { ...chartOptions, plugins: { legend: { display: false } } },
  });
}

/* ---------- Análisis espacial ---------- */
const dr = L.featureGroup().addTo(map);
let tool = null,
  last = null;
const inter = (a, b) => {
  try {
    const i = turf.intersect(a, b);
    return i ? turf.area(i) / 1e4 : 0;
  } catch (e) {
    return 0;
  }
};
function repArea(g) {
  const a = turf.area(g);
  let h = `<b>Área:</b> ${fmt(a, 0)} m² · ${fmt(a / 1e4, 2)} ha<h3>Zonificación POT que impacta</h3><div class="lg">`;
  for (const k in ZN) {
    const v = ZN[k].reduce((total, feature) => total + inter(g, feature), 0);
    if (v > 0)
      h += `<div><i style="background:${POT[k].c}"></i>${POT[k].s}: ${fmt(v, 2)} ha (${fmt(((v * 1e4) / a) * 100, 0)} %)</div>`;
  }
  h += '</div><h3>Cobertura 2024 dentro de la zona</h3><div class="lg">';
  for (const k in CL) {
    const v = DATA[2024][k] ? inter(g, DATA[2024][k]) : 0;
    if (v > 0) h += `<div><i style="background:${CL[k][1]}"></i>${CL[k][0]}: ${fmt(v, 2)} ha</div>`;
  }
  return h + "</div>";
}
function start(t) {
  if (tool) tool.disable();
  tab(4);
  tool =
    t === "l"
      ? new L.Draw.Polyline(map, { shapeOptions: { color: "#ce1126" } })
      : new L.Draw.Polygon(map, { showArea: false, shapeOptions: { color: "#ce1126", weight: 2 } });
  tool.enable();
}
map.on("draw:drawstart", () => (drawing = true));
map.on("draw:drawstop", () => setTimeout(() => (drawing = false), 60));
map.on("draw:created", (e) => {
  dr.addLayer(e.layer);
  last = e.layer;
  const g = e.layer.toGeoJSON();
  if (g.geometry.type === "LineString") {
    const k = turf.length(g, { units: "kilometers" });
    $("#res").innerHTML = `<b>Distancia:</b> ${fmt(k * 1000, 0)} m (${fmt(k, 2)} km)`;
  } else $("#res").innerHTML = repArea(g);
});
$("#dl1").onclick = $("#bm1").onclick = () => start("l");
$("#dp").onclick = () => start("p");
$("#dc").onclick = () => {
  dr.clearLayers();
  last = null;
  $("#res").innerHTML = "";
};
$("#bb").onclick = () => {
  if (!last) return toast("Primero dibuja una línea o un polígono");
  const r = +$("#br").value,
    b = turf.buffer(last.toGeoJSON(), r / 1000, { units: "kilometers" });
  L.geoJSON(b, {
    style: { color: "#ce1126", dashArray: "6 4", weight: 1.5, fillOpacity: 0.1 },
    interactive: false,
  }).addTo(dr);
  $("#res").innerHTML = `<b>Buffer de ${r} m</b><br>` + repArea(b);
};

/* ---------- Búsqueda, vistas, ubicación, exportación ---------- */
const flat = (s) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
$("#q").onkeydown = (e) => {
  if (e.key !== "Enter") return;
  const v = e.target.value.trim(),
    m = v.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  let p;
  if (m) {
    let a = +m[1],
      b = +m[2];
    if (Math.abs(a) > 90) [a, b] = [b, a];
    p = [a, b];
  } else {
    const n = Object.keys(PL).find((n) => flat(n).includes(flat(v)));
    if (n && v) p = PL[n];
  }
  if (!p)
    return toast("No se encontró «" + v + "». Prueba con el nombre de un predio o con «lat, lon».");
  map.flyTo(p, 16);
  L.marker(p).addTo(map).bindPopup(v).openPopup();
};
$("#vw").onchange = (e) => {
  const v = e.target.value;
  if (v === "v") map.fitBounds(G.ver.getBounds());
  else if (v === "a") map.flyTo(PL["Parque Arví"], 14);
  else map.fitBounds(G.cor.getBounds());
};
$("#gps").onclick = () => map.locate({ setView: true, maxZoom: 16 });
map.on("locationfound", (e) =>
  L.circleMarker(e.latlng, { radius: 7, color: "#1d4e89" }).addTo(map).bindPopup("Tu ubicación"),
);
map.on("locationerror", () => toast("No se pudo obtener tu ubicación"));
$("#bpng").onclick = () =>
  html2canvas($("#map"), { useCORS: true })
    .then((c) => {
      const a = document.createElement("a");
      a.download = "geovisor-piedras-blancas.png";
      a.href = c.toDataURL();
      a.click();
    })
    .catch(() => toast("No se pudo exportar el PNG"));
const layoutDialog = $("#layoutDialog");
const renderLayoutContent = () => {
  $("#layoutPreviewTitle").textContent = $("#layoutTitle").value.trim() || "Mapa sin título";
  $("#layoutPreviewSubtitle").textContent = $("#layoutSubtitle").value.trim();
  $("#layoutSourcePreview").textContent = $("#layoutSource").value.trim();
  const paper = $("#layoutPaper");
  paper.classList.toggle("landscape", $("#layoutOrientation").value === "landscape");
  paper.classList.toggle("portrait", $("#layoutOrientation").value === "portrait");
  paper.classList.toggle("hide-legend", !$("#layoutShowLegend").checked);
  paper.classList.toggle("hide-scale", !$("#layoutShowScale").checked);
  paper.classList.toggle("hide-north", !$("#layoutShowNorth").checked);
  $("#layoutLegend").innerHTML = $(".project-legend-items")?.innerHTML || '<span class="project-legend-empty">Sin capas temáticas activas</span>';
  renderLayoutScale();
};
const renderLayoutScale = () => {
  const frame = $(".layout-map-frame");
  if (!frame.clientWidth || !map.getSize().x) return;
  const latitude = map.getCenter().lat * Math.PI / 180;
  const groundResolution = 156543.03392 * Math.cos(latitude) / (2 ** map.getZoom());
  const imageScale = Math.max(frame.clientWidth / map.getSize().x, frame.clientHeight / map.getSize().y);
  const metersPerLayoutPixel = groundResolution / imageScale;
  const scaleDenominator = Math.round(metersPerLayoutPixel / (0.0254 / 96) / 100) * 100;
  const desiredWidth = Math.min(125, frame.clientWidth * 0.34);
  const candidates = [100, 250, 500, 1000, 2000, 5000, 10000, 25000, 50000];
  const distance = candidates.filter((meters) => meters / metersPerLayoutPixel <= desiredWidth).pop() || candidates[0];
  const barWidth = Math.max(16, distance / metersPerLayoutPixel);
  $("#layoutScaleBar").style.width = `${barWidth}px`;
  $("#layoutScaleNumber").textContent = `0 — ${distance >= 1000 ? `${fmt(distance / 1000, 1)} km` : `${fmt(distance, 0)} m`} · aprox. 1:${scaleDenominator.toLocaleString("es-CO")}`;
};
const refreshLayoutMap = async () => {
  const status = $("#layoutStatus");
  status.textContent = "Actualizando la vista del mapa…";
  try {
    const canvas = await html2canvas($("#map"), {
      useCORS: true,
      scale: 2,
      backgroundColor: "#eef2f6",
      onclone: (clonedDocument) => {
        const clonedMap = clonedDocument.querySelector("#map");
        clonedMap?.querySelectorAll(".leaflet-control-container,#gps,#coords,#demo,#cort,#ban,.leaflet-popup-pane").forEach((element) => element.remove());
      },
    });
    $("#layoutMapImage").src = canvas.toDataURL("image/png");
    renderLayoutContent();
    status.textContent = "Mapa actualizado con la vista y las capas activas.";
  } catch (error) {
    console.error("No se pudo actualizar el mapa del layout:", error);
    status.textContent = "No se pudo capturar el mapa. Verifica que el mapa base haya terminado de cargar e inténtalo de nuevo.";
  }
  return Boolean($("#layoutMapImage").getAttribute("src"));
};
$("#openLayout").onclick = () => {
  layoutDialog.showModal();
  renderLayoutContent();
  refreshLayoutMap();
};
$("#closeLayout").onclick = () => layoutDialog.close();
$("#refreshLayout").onclick = refreshLayoutMap;
["#layoutTitle", "#layoutSubtitle", "#layoutSource", "#layoutOrientation", "#layoutShowLegend", "#layoutShowScale", "#layoutShowNorth"].forEach((selector) => {
  $(selector).addEventListener("input", renderLayoutContent);
  $(selector).addEventListener("change", renderLayoutContent);
});
$("#downloadLayout").onclick = async () => {
  const status = $("#layoutStatus");
  if (!$("#layoutMapImage").getAttribute("src") && !(await refreshLayoutMap())) return;
  status.textContent = "Preparando archivo PNG…";
  try {
    const canvas = await html2canvas($("#layoutPaper"), { backgroundColor: "#ffffff", scale: 2, useCORS: true });
    const link = document.createElement("a");
    link.download = "layout-piedras-blancas.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
    status.textContent = "Layout descargado como PNG.";
  } catch (error) {
    console.error("No se pudo exportar el layout:", error);
    status.textContent = "No se pudo crear el PNG. Actualiza el mapa e inténtalo de nuevo.";
  }
};
$("#bpdf").onclick = () => window.print();
$("#bhelp").onclick = () => $("#ay").showModal();

/* ---------- Panel ---------- */
function tab(i) {
  $("aside").classList.remove("c");
  setTimeout(() => map.invalidateSize(), 250);
  $$("nav button").forEach((b, j) => b.classList.toggle("on", i === j));
  $$(".tab").forEach((t, j) => t.classList.toggle("on", i === j));
  if (i !== 1 && sw.on) {
    sw.on = false;
    $("#sw").checked = false;
    paint();
  }
  if (i === 3 && !floorChart) charts();
}
$$("nav button").forEach((b, i) => (b.onclick = () => tab(i)));
$("#tg").onclick = () => {
  $("aside").classList.toggle("c");
  setTimeout(() => map.invalidateSize(), 250);
};
const themeToggle = $("#themeToggle");
const setTheme = (theme) => {
  document.body.dataset.theme = theme;
  themeToggle.textContent = theme === "dark" ? "☀ Claro" : "☾ Oscuro";
  themeToggle.setAttribute("aria-pressed", String(theme === "dark"));
  themeToggle.title = theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
  if (floorChart) {
    floorChart.destroy();
    typeChart.destroy();
    areaChart.destroy();
    floorChart = typeChart = areaChart = null;
    if ($$(".tab")[3]?.classList.contains("on")) charts();
  }
};
try {
  setTheme(localStorage.getItem("geovisor-theme") === "dark" ? "dark" : "light");
} catch {
  setTheme("light");
}
themeToggle.onclick = () => {
  const theme = document.body.dataset.theme === "dark" ? "light" : "dark";
  setTheme(theme);
  try { localStorage.setItem("geovisor-theme", theme); } catch { /* El tema sigue activo durante esta sesión. */ }
};
if (innerWidth < 800) $("aside").classList.add("c");
window.addEventListener("resize", () => setTimeout(() => map.invalidateSize(), 120));
