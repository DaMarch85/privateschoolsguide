(function(){
  const target = document.getElementById('school-page-map');
  const data = window.schoolProfileMapData;
  if (target && data && window.L) {
    const map = window.L.map(target, {zoomControl:true, scrollWheelZoom:false});
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom:18,
      attribution:'&copy; OpenStreetMap contributors'
    }).addTo(map);
    const icon = window.L.divIcon({
      className:'school-map-icon',
      html:'<span class="school-map-marker"></span>',
      iconSize:[16,16],
      iconAnchor:[8,8],
      popupAnchor:[0,-8]
    });
    const marker = window.L.marker([data.lat, data.lng], {icon:icon}).addTo(map);
    marker.bindPopup(`<div class="map-popup"><h3 class="map-popup-title">${data.name}</h3><p class="map-popup-meta">${data.note || ''}</p><a class="map-popup-link" href="${data.slug}">View school</a></div>`);
    map.setView([data.lat, data.lng], data.zoom || 13);
  }

  document.querySelectorAll('.subjects-details').forEach((details) => {
    const tile = details.closest('.tile-expandable');
    const sync = () => tile && tile.classList.toggle('is-expanded', details.open);
    details.addEventListener('toggle', sync);
    sync();
  });

  document.querySelectorAll('[data-fee-switch]').forEach((switcher) => {
    const tile = switcher.closest('.school-feature-tile');
    if (!tile) return;
    const buttons = switcher.querySelectorAll('[data-fee-target]');
    const panes = tile.querySelectorAll('[data-fee-pane]');
    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const targetPane = button.getAttribute('data-fee-target');
        buttons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
        panes.forEach((pane) => pane.classList.toggle('is-active', pane.getAttribute('data-fee-pane') === targetPane));
      });
    });
  });
})();
