Promise.all([
  fetch('data/index.json').then(res => res.json())
])
  .then(([manifest]) => {
    const urls = manifest.files || [];
    return Promise.all(
      urls.map(url => fetch(url).then(res => res.json()))
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

    geojsonLayer = L.geoJSON({ type: 'FeatureCollection', features: allFeatures }, {
      style: { color: '#eab308', weight: 2, fillOpacity: 0.15 },
      onEachFeature: (feature, layer) => {
        layer.on('click', () => selectFeature(feature, layer));
      }
    }).addTo(map);

    if (geojsonLayer.getBounds().isValid()) {
      map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });
    }
    renderList();
  });