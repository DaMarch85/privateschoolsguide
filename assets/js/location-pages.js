(function () {
  function parseMapData() {
    const dataNode = document.getElementById('location-map-data');
    if (!dataNode) return [];
    try {
      return JSON.parse(dataNode.textContent || '[]');
    } catch (err) {
      return [];
    }
  }

  function icon(type) {
    return window.L.divIcon({
      className: 'school-map-icon',
      html: '<span class="school-map-marker ' + type + '"></span>',
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8]
    });
  }

  function initLocationMap() {
    const mapTarget = document.getElementById('location-directory-map');
    const schools = parseMapData();

    if (!mapTarget || !window.L || !schools.length) return false;
    if (mapTarget.dataset.initialized === 'true') return true;
    mapTarget.dataset.initialized = 'true';

    const map = window.L.map(mapTarget, {
      zoomControl: true,
      scrollWheelZoom: false
    });

    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    const markers = schools.map(function (school) {
      const marker = window.L.marker([school.lat, school.lng], {
        icon: icon(school.type)
      });

      marker.bindPopup(
        '<div class="map-popup">' +
          '<h3 class="map-popup-title">' + school.name + '</h3>' +
          '<p class="map-popup-meta">' + school.note + '</p>' +
          '<a class="map-popup-link" href="' + school.slug + '">View school</a>' +
        '</div>'
      );

      marker.addTo(map);
      return marker;
    });

    const group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds(), { padding: [28, 28], maxZoom: 11 });
    setTimeout(function () { map.invalidateSize(); }, 80);
    return true;
  }

  function boot() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        setTimeout(initLocationMap, 0);
      }, { once: true });
    } else {
      setTimeout(initLocationMap, 0);
    }
  }

  boot();
  window.addEventListener('pageshow', initLocationMap);
})();
