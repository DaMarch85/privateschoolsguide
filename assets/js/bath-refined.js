
const menuToggle = document.querySelector('.menu-toggle');
const nav = document.getElementById('main-nav');
if (menuToggle && nav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = nav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  });
}

const filterButton = document.getElementById('filter-button');
const schoolGrid = document.getElementById('school-grid');
const status = document.getElementById('filter-status');

function applyFilters() {
  if (!schoolGrid) return;
  const format = document.getElementById('format-filter').value;
  const age = document.getElementById('age-filter').value;
  const gender = document.getElementById('gender-filter').value;
  const cards = [...schoolGrid.querySelectorAll('.school-card')];

  let visible = 0;
  cards.forEach(card => {
    const matchFormat = !format || card.dataset.format === format || (format === 'boarding' && card.dataset.format === 'boarding');
    const matchAge = !age || card.dataset.age === age;
    const matchGender = !gender || card.dataset.gender === gender;
    const show = matchFormat && matchAge && matchGender;
    card.style.display = show ? '' : 'none';
    if (show) visible += 1;
  });

  if (status) {
    status.classList.add('is-visible');
    status.textContent = visible
      ? `Showing ${visible} highlighted school${visible === 1 ? '' : 's'}. Use Map or the full directory to broaden the search.`
      : 'No highlighted school matches those filters. Use Map or the full Bath directory to widen the search.';
  }
}

if (filterButton) filterButton.addEventListener('click', applyFilters);

const toggleButtons = [...document.querySelectorAll('.view-toggle-button')];
const listView = document.getElementById('school-list-view');
const mapView = document.getElementById('school-map-view');

let bathMap;
let bathMapReady = false;

const schools = [
  {
    name: 'King Edward’s School',
    slug: '/bath/schools/king-edwards-school/',
    lat: 51.386488,
    lng: -2.343663,
    type: 'day',
    note: 'Co-educational · Day · Ages 3–18'
  },
  {
    name: 'Kingswood School',
    slug: '/bath/schools/kingswood-school/',
    lat: 51.398883,
    lng: -2.370005,
    type: 'boarding',
    note: 'Co-educational · Day & Boarding · Ages 11–19'
  },
  {
    name: 'Kingswood Preparatory School',
    slug: '/bath/schools/kingswood-preparatory-school/',
    lat: 51.397143,
    lng: -2.373238,
    type: 'day',
    note: 'Co-educational · Day · Ages 3–11'
  },
  {
    name: 'Prior Park College',
    slug: '/bath/schools/prior-park-college/',
    lat: 51.364523,
    lng: -2.343082,
    type: 'boarding',
    note: 'Co-educational · Day & Boarding · Ages 11–18'
  },
  {
    name: 'Paragon School',
    slug: '/bath/schools/paragon-school/',
    lat: 51.370494,
    lng: -2.355122,
    type: 'day',
    note: 'Co-educational · Day · Ages 3–11'
  },
  {
    name: 'Monkton Combe School',
    slug: '/bath/schools/monkton-combe-school/',
    lat: 51.357305,
    lng: -2.326354,
    type: 'boarding',
    note: 'Co-educational · Day & Boarding · Ages 2–19'
  },
  {
    name: 'Royal High School Bath',
    slug: '/bath/schools/royal-high-school-bath-gdst/',
    lat: 51.397185,
    lng: -2.365419,
    type: 'boarding',
    note: 'Girls · Day & Boarding · Senior campus pin'
  },
  {
    name: 'Bath Academy',
    slug: '/bath/schools/bath-academy/',
    lat: 51.383903,
    lng: -2.363978,
    type: 'boarding',
    note: 'Co-educational college · Bath city-centre pin'
  },
  {
    name: 'Downside School',
    slug: '/bath/schools/downside-school/',
    lat: 51.253899,
    lng: -2.495195,
    type: 'area',
    note: 'Bath-area school · Near Radstock'
  }
];

function buildMarker(type) {
  if (!window.L) return null;
  return window.L.divIcon({
    className: 'school-map-icon',
    html: `<span class="school-map-marker ${type}"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8]
  });
}

function initMap() {
  if (bathMapReady || !window.L) return;
  const target = document.getElementById('bath-map');
  if (!target) return;

  bathMap = window.L.map(target, {
    zoomControl: true,
    scrollWheelZoom: false
  });

  window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(bathMap);

  const markers = [];
  schools.forEach((school) => {
    const marker = window.L.marker([school.lat, school.lng], {
      icon: buildMarker(school.type)
    });

    marker.bindPopup(`
      <div class="map-popup">
        <h3 class="map-popup-title">${school.name}</h3>
        <p class="map-popup-meta">${school.note}</p>
        <a class="map-popup-link" href="${school.slug}">View school</a>
      </div>
    `);

    marker.addTo(bathMap);
    markers.push(marker);
  });

  const group = window.L.featureGroup(markers);
  bathMap.fitBounds(group.getBounds(), {
    padding: [28, 28],
    maxZoom: 12
  });

  bathMapReady = true;
}

function setView(view) {
  toggleButtons.forEach((button) => {
    const active = button.dataset.view === view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
  });

  if (view === 'map') {
    listView.hidden = true;
    mapView.hidden = false;
    initMap();
    window.setTimeout(() => {
      if (bathMap) bathMap.invalidateSize();
    }, 80);
  } else {
    mapView.hidden = true;
    listView.hidden = false;
  }
}

toggleButtons.forEach((button) => {
  button.addEventListener('click', () => setView(button.dataset.view));
});
