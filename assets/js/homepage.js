
document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('location-search');
  const locationList = document.getElementById('location-list');
  if (searchInput && locationList) {
    const links = Array.from(locationList.querySelectorAll('li'));
    searchInput.addEventListener('input', function () {
      const q = this.value.trim().toLowerCase();
      links.forEach(li => {
        const text = li.textContent.trim().toLowerCase();
        li.style.display = !q || text.includes(q) ? '' : 'none';
      });
    });
  }

  const mapEl = document.getElementById('home-map');
  if (mapEl && window.L) {
    const map = L.map(mapEl, { scrollWheelZoom: false, zoomControl: true }).setView([51.381, -2.372], 11.8);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const schools = [
      { name: 'Bath Academy', lat: 51.3788, lng: -2.3594, type: 'Sixth form college', href: '/bath/schools/bath-academy/' },
      { name: 'King Edward’s School', lat: 51.3656, lng: -2.3794, type: 'Day school', href: '/bath/schools/king-edwards-school/' },
      { name: 'Kingswood Preparatory School', lat: 51.3958, lng: -2.3827, type: 'Prep school', href: '/bath/schools/kingswood-preparatory-school/' },
      { name: 'Kingswood School', lat: 51.3982, lng: -2.3846, type: 'Day & boarding', href: '/bath/schools/kingswood-school/' },
      { name: 'Monkton Combe School', lat: 51.3494, lng: -2.3391, type: 'Day & boarding', href: '/bath/schools/monkton-combe-school/' },
      { name: 'Paragon School', lat: 51.3928, lng: -2.3669, type: 'Prep school', href: '/bath/schools/paragon-school/' },
      { name: 'Prior Park College', lat: 51.3674, lng: -2.3456, type: 'Day & boarding', href: '/bath/schools/prior-park-college/' },
      { name: 'Royal High School Bath', lat: 51.3874, lng: -2.3803, type: 'Day school', href: '/bath/schools/royal-high-school-bath/' },
      { name: 'Downside School', lat: 51.2518, lng: -2.4713, type: 'Bath area', href: '/bath/schools/downside-school/', area: true }
    ];

    schools.forEach(school => {
      const icon = L.divIcon({
        className: '',
        html: '<div class="custom-marker' + (school.area ? ' area' : '') + '"></div>',
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      L.marker([school.lat, school.lng], { icon })
        .addTo(map)
        .bindPopup(
          '<div class="map-popup">' +
          '<p class="map-popup-title"><a href="' + school.href + '">' + school.name + '</a></p>' +
          '<p class="map-popup-meta">' + school.type + '</p>' +
          '</div>'
        );
    });
  }
});
