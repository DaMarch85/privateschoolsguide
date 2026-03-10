
const searchInput = document.getElementById('location-search');
const locationItems = Array.from(document.querySelectorAll('[data-location-item]'));

function filterLocations() {
  if (!searchInput || !locationItems.length) return;
  const query = searchInput.value.trim().toLowerCase();

  let firstVisible = null;

  locationItems.forEach((link) => {
    const match = link.dataset.name.toLowerCase().includes(query);
    link.parentElement.hidden = !match;
    if (match && !firstVisible) firstVisible = link;
  });

  searchInput.dataset.firstVisibleHref = firstVisible ? firstVisible.getAttribute('href') : '';
}

if (searchInput) {
  searchInput.addEventListener('input', filterLocations);
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const href = searchInput.dataset.firstVisibleHref;
      if (href) {
        event.preventDefault();
        window.location.href = href;
      }
    }
  });
  filterLocations();
}

const homeMapTarget = document.getElementById('homepage-map');
if (homeMapTarget && window.L) {
  const map = window.L.map(homeMapTarget, {
    zoomControl: true,
    scrollWheelZoom: false
  });

  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);

  const schools = [
    { name: 'King Edward’s School', slug: '/bath/schools/king-edwards-school/', lat: 51.386488, lng: -2.343663, type: 'day', note: 'Co-educational · Day · Ages 3–18' },
    { name: 'Kingswood School', slug: '/bath/schools/kingswood-school/', lat: 51.398883, lng: -2.370005, type: 'boarding', note: 'Co-educational · Day & Boarding · Ages 11–19' },
    { name: 'Kingswood Preparatory School', slug: '/bath/schools/kingswood-preparatory-school/', lat: 51.397143, lng: -2.373238, type: 'day', note: 'Co-educational · Day · Ages 3–11' },
    { name: 'Prior Park College', slug: '/bath/schools/prior-park-college/', lat: 51.364523, lng: -2.343082, type: 'boarding', note: 'Co-educational · Day & Boarding · Ages 11–18' },
    { name: 'Paragon School', slug: '/bath/schools/paragon-school/', lat: 51.370494, lng: -2.355122, type: 'day', note: 'Co-educational · Day · Ages 3–11' },
    { name: 'Monkton Combe School', slug: '/bath/schools/monkton-combe-school/', lat: 51.357305, lng: -2.326354, type: 'boarding', note: 'Co-educational · Day & Boarding · Ages 2–19' },
    { name: 'Royal High School Bath', slug: '/bath/schools/royal-high-school-bath-gdst/', lat: 51.397185, lng: -2.365419, type: 'boarding', note: 'Girls · Day & Boarding · Senior campus pin' },
    { name: 'Bath Academy', slug: '/bath/schools/bath-academy/', lat: 51.383903, lng: -2.363978, type: 'boarding', note: 'Co-educational college · Bath city-centre pin' },
    { name: 'Downside School', slug: '/bath/schools/downside-school/', lat: 51.253899, lng: -2.495195, type: 'area', note: 'Bath-area school · Near Radstock' }
  ];

  const markers = schools.map((school) => {
    const icon = window.L.divIcon({
      className: 'school-map-icon',
      html: `<span class="school-map-marker ${school.type}"></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -8]
    });

    const marker = window.L.marker([school.lat, school.lng], { icon });
    marker.bindPopup(`
      <div class="map-popup">
        <h3 class="map-popup-title">${school.name}</h3>
        <p class="map-popup-meta">${school.note}</p>
        <a class="map-popup-link" href="${school.slug}">Open school page</a>
      </div>
    `);
    marker.addTo(map);
    return marker;
  });

  const group = window.L.featureGroup(markers);
  map.fitBounds(group.getBounds(), { padding: [24, 24], maxZoom: 12 });
}
