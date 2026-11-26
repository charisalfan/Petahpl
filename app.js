// ============================================================
//  Globals
// ============================================================
let map;
let geojsonLayer;
let allFeatures = [];
let selectedLayer = null;
let manifestFilesCache = [];

// ============================================================
//  Init map
// ============================================================
map = L.map('map').setView([-2.5, 118], 5);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// ============================================================
//  Load data
// ============================================================
fetch('data/index.json')
  .then(res => {
    if (!res.ok) throw new Error('data/index.json -> HTTP ' + res.status);
    return res.json();
  })
  .then(manifest => {
    manifestFilesCache = manifest.files || [];
    // allSettled so one missing file doesn't blank the whole map
    return Promise.allSettled(
      manifestFilesCache.map((url, idx) =>
        fetch(url)
          .then(res => {
            if (!res.ok) throw new Error(url + ' -> HTTP ' + res.status);
            return res.json();
          })
          .then(data => ({ idx, url, data }))
          .catch(err => ({ idx, url, error: err }))
      )
    );
  })
  .then(results => {
    const collections = [];
    results.forEach(r => {
      if (r.status === 'fulfilled' && !r.value.error) {
        collections.push(r.value.data);
      } else {
        const err = r.status === 'fulfilled' ? r.value.error : r.reason;
        console.warn('Skipping file:', err && err.message ? err.message : err);
      }
    });

    if (collections.length === 0) {
      throw new Error('No GeoJSON files could be loaded. Check data/index.json and the files it references.');
    }

    allFeatures = collections.flatMap((data, fileIdx) =>
      (data.features || []).map((f, i) => {
        f.properties = f.properties || {};
        f.properties._uid = f.properties.id || `f${fileIdx}-${i}`;
        f.properties._sourceFile = manifestFilesCache[fileIdx] || '';
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

    console.log(`Loaded ${allFeatures.length} features from ${collections.length} file(s).`);
    if (geojsonLayer.getBounds().isValid()) {
      console.log('Bounds:', geojsonLayer.getBounds());
    } else {
      console.warn('GeoJSON layer has invalid bounds — geometry may be empty or malformed.');
    }
  })
  .catch(err => {
    console.error('Failed to load map data:', err);
    const details = document.getElementById('details');
    if (details) {
      details.innerHTML =
        '<p class="placeholder">⚠️ Error loading data: ' +
        escapeHtml(err.message) +
        '</p>';
    }
  });

// ============================================================
//  Interaction: select a feature
// ============================================================
function selectFeature(feature, layer) {
  if (selectedLayer && selectedLayer.setStyle) {
    selectedLayer.setStyle({ weight: 2 });
  }
  selectedLayer = layer;
  if (layer.setStyle) layer.setStyle({ weight: 4 });

  const p = feature.properties || {};
  const details = document.getElementById('details');
  if (!details) return;

  details.innerHTML = `
    <div class="meta-block">
      <div class="meta-label">UID</div>
      <div class="meta-value">${escapeHtml(p._uid || '—')}</div>
    </div>
    ${p.title ? `<div class="meta-block">
      <div class="meta-label">Title</div>
      <div class="meta-value">${escapeHtml(p.title)}</div>
    </div>` : ''}
    <div class="meta-block">
      <div class="meta-label">Geometry</div>
      <div class="meta-value">${feature.geometry ? feature.geometry.type : 'none'}</div>
    </div>
    <div class="meta-block">
      <div class="meta-label">Source file</div>
      <div class="meta-value">${escapeHtml(p._sourceFile || '—')}</div>
    </div>
  `;
}

// ============================================================
//  Render the searchable list in the side panel
// ============================================================
function renderList(filterText = '') {
  const results = document.getElementById('results');
  if (!results) return;

  const q = filterText.trim().toLowerCase();
  const matches = allFeatures.filter(f => {
    if (!q) return true;
    const p = f.properties || {};
    return [p._uid, p.title, p._sourceFile]
      .filter(Boolean)
      .some(v => String(v).toLowerCase().includes(q));
  });

  results.innerHTML = matches
    .map(f => {
      const p = f.properties || {};
      const label = p.title || p._uid;
      return `<div class="result-item" data-uid="${escapeHtml(p._uid)}">${escapeHtml(label)}</div>`;
    })
    .join('');

  results.querySelectorAll('.result-item').forEach(el => {
    el.addEventListener('click', () => {
      const uid = el.getAttribute('data-uid');
      const feature = allFeatures.find(f => f.properties._uid === uid);
      if (!feature) return;

      let targetLayer = null;
      geojsonLayer.eachLayer(l => {
        if (l.feature && l.feature.properties._uid === uid) targetLayer = l;
      });
      if (!targetLayer) return;

      const b = targetLayer.getBounds ? targetLayer.getBounds() : null;
      if (b && b.isValid()) map.fitBounds(b, { padding: [20, 20] });
      selectFeature(feature, targetLayer);
    });
  });
}

// ============================================================
//  Search box wiring
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const search = document.getElementById('search');
  if (search) {
    search.addEventListener('input', e => renderList(e.target.value));
  }
});

// ============================================================
//  Tiny XSS-safe helper
// ============================================================
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
