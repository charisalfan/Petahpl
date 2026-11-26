// --- Globals ---
let map, geojsonLayer;
let allFeatures = [];
let selectedLayer = null;

// --- Init map ---
map = L.map('map').setView([-2.5, 118], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// --- Load data ---
Promise.all([
  fetch('data/index.json').then(res => {
    if (!res.ok) throw new Error('index.json: ' + res.status);
    return res.json();
  })
])
  .then(([manifest]) => {
    const urls = manifest.files || [];
    return Promise.all(
      urls.map(url =>
        fetch(url).then(res => {
          if (!res.ok) throw new Error(url + ': ' + res.status);
          return res.json();
        })
      )
    );
  })
  .then(collections => {
    allFeatures = collections.flatMap((data, fileIdx) =>
      (data.features || []).map((f, i) => {
        f.properties = f.properties || {};
        f.properties._uid = f.properties.id || `f${fileIdx}-${i}`;
        return f;
      })
    );

    geojsonLayer = L.geoJSON(
      { type: 'FeatureCollection', features: allFeatures },
      {
        style: { color: '#eab308', weight: 2, fillOpacity: 0.15 },
        onEachFeature: (feature, layer) => {
          layer.on('click', () => selectFeature(feature, layer));
        }
      }
    ).addTo(map);

    if (geojsonLayer.getBounds().isValid()) {
      map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
    }
    renderList();
  })
  .catch(err => {
    console.error('Data load failed:', err);
    const details = document.getElementById('details');
    if (details) details.innerHTML =
      '<p class="placeholder">Error loading map data: ' + err.message + '</p>';
  });

// --- Stubs (fill these in) ---
function selectFeature(feature, layer) {
  if (selectedLayer) selectedLayer.setStyle({ weight: 2 });
  selectedLayer = layer;
  layer.setStyle({ weight: 4 });
  const details = document.getElementById('details');
  if (details) {
    const p = feature.properties;
    details.innerHTML = `
      <div class="meta-block">
        <div class="meta-label">ID</div>
        <div class="meta-value">${p._uid}</div>
      </div>
      <div class="meta-block">
        <div class="meta-label">Title</div>
        <div class="meta-value">${p.title || '—'}</div>
      </div>`;
  }
}

function renderList() {
  const results = document.getElementById('results');
  if (!results) return;
  results.innerHTML = allFeatures.map(f =>
    `<div class="result-item" data-uid="${f.properties._uid}">${f.properties.title || f.properties._uid}</div>`
  ).join('');
}
