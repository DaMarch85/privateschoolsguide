(function(){
  const mapTarget = document.getElementById('bath-location-map');
  if (mapTarget && window.L) {
    const schools = [
      {name:'King Edward’s School',slug:'/bath/schools/king-edwards-school/',lat:51.386488,lng:-2.343663,type:'allthrough',note:'All-through school · Co-ed · Day · Ages 3–18'},
      {name:'Kingswood School',slug:'/bath/schools/kingswood-school/',lat:51.398883,lng:-2.370005,type:'senior',note:'Senior school · Co-ed · Day & boarding · Ages 11–19'},
      {name:'Kingswood Preparatory School',slug:'/bath/schools/kingswood-preparatory-school/',lat:51.397143,lng:-2.373238,type:'junior',note:'Prep school · Co-ed · Day · Ages 9 months–11'},
      {name:'Prior Park College',slug:'/bath/schools/prior-park-college/',lat:51.364523,lng:-2.343082,type:'senior',note:'Senior school · Co-ed · Day & boarding · Ages 11–18'},
      {name:'Paragon School',slug:'/bath/schools/paragon-school/',lat:51.370494,lng:-2.355122,type:'junior',note:'Prep school · Co-ed · Day · Ages 3–11'},
      {name:'Monkton Combe School',slug:'/bath/schools/monkton-combe-school/',lat:51.357305,lng:-2.326354,type:'allthrough',note:'All-through school · Co-ed · Day & boarding · Ages 2–19'},
      {name:'Royal High School Bath, GDST',slug:'/bath/schools/royal-high-school-bath-gdst/',lat:51.397185,lng:-2.365419,type:'allthrough',note:'All-through school · Girls · Day & boarding · Ages 3–18'},
      {name:'Bath Academy',slug:'/bath/schools/bath-academy/',lat:51.383903,lng:-2.363978,type:'senior',note:'Senior school · Co-ed · Day & boarding · Ages 14–19'},
      {name:'Downside School',slug:'/bath/schools/downside-school/',lat:51.253899,lng:-2.495195,type:'senior',note:'Senior school · Bath-area · Co-ed · Day & boarding · Ages 11–18'}
    ];
    const map = window.L.map(mapTarget,{zoomControl:true,scrollWheelZoom:false});
    window.L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    function icon(type){
      return window.L.divIcon({className:'school-map-icon',html:`<span class="school-map-marker ${type}"></span>`,iconSize:[16,16],iconAnchor:[8,8],popupAnchor:[0,-8]});
    }
    const markers = schools.map((school)=>{
      const marker = window.L.marker([school.lat,school.lng],{icon:icon(school.type)});
      marker.bindPopup(`<div class="map-popup"><h3 class="map-popup-title">${school.name}</h3><p class="map-popup-meta">${school.note}</p><a class="map-popup-link" href="${school.slug}">View school</a></div>`);
      marker.addTo(map);
      return marker;
    });
    const group = window.L.featureGroup(markers);
    map.fitBounds(group.getBounds(),{padding:[28,28],maxZoom:11});
  }

  const feeSwitch = document.querySelector('[data-fees-switch]');
  if (feeSwitch) {
    const buttons = Array.from(feeSwitch.querySelectorAll('[data-fees-view]'));
    const tables = Array.from(document.querySelectorAll('[data-fees-table]'));

    buttons.forEach((button) => {
      button.addEventListener('click', () => {
        const view = button.getAttribute('data-fees-view');
        buttons.forEach((btn) => btn.classList.toggle('is-active', btn === button));
        tables.forEach((table) => {
          table.hidden = table.getAttribute('data-fees-table') !== view;
        });
      });
    });

    const tableElements = tables
      .map((wrap) => wrap.querySelector('.fees-matrix'))
      .filter(Boolean);

    if (tableElements.length) {
      const schoolKeys = [];
      const columnCellsByKey = new Map();
      const hiddenKeys = new Set();

      function normaliseSchoolKey(text) {
        return String(text || '')
          .replace(/\s+/g, ' ')
          .replace(/\bGDST\b/gi, 'GDST')
          .trim();
      }

      function collectColumns(table) {
        const rows = Array.from(table.querySelectorAll('tr'));
        const headerCells = Array.from(table.querySelectorAll('thead th'));

        headerCells.forEach((cell, index) => {
          if (index === 0) return;
          const schoolName = normaliseSchoolKey(cell.textContent);
          cell.dataset.schoolKey = schoolName;

          if (!schoolKeys.includes(schoolName)) {
            schoolKeys.push(schoolName);
            columnCellsByKey.set(schoolName, []);
          }

          const cells = rows
            .map((row) => row.children[index])
            .filter(Boolean);

          cells.forEach((entry) => {
            entry.dataset.schoolKey = schoolName;
            columnCellsByKey.get(schoolName).push(entry);
          });
        });
      }

      tableElements.forEach(collectColumns);

      const visibilityBar = document.createElement('div');
      visibilityBar.className = 'fees-visibility-bar';
      visibilityBar.innerHTML = `
        <div class="fees-visibility-head">
          <p class="fees-visibility-label">School columns</p>
          <button type="button" class="fees-show-all">Show all schools</button>
        </div>
        <div class="fees-visibility-pills" aria-live="polite"></div>
      `;
      const firstWrap = tables[0];
      firstWrap.parentElement.insertBefore(visibilityBar, firstWrap);

      const pillsHost = visibilityBar.querySelector('.fees-visibility-pills');
      const showAllButton = visibilityBar.querySelector('.fees-show-all');

      function setHeaderToggleState() {
        document.querySelectorAll('.fees-column-toggle').forEach((button) => {
          const key = button.dataset.schoolKey;
          const isHidden = hiddenKeys.has(key);
          button.classList.toggle('is-hidden', isHidden);
          button.setAttribute('aria-pressed', isHidden ? 'true' : 'false');
          button.textContent = isHidden ? 'Show' : 'Hide';
        });
      }

      function renderPills() {
        pillsHost.innerHTML = '';
        schoolKeys.forEach((key) => {
          const pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'fees-visibility-pill';
          pill.dataset.schoolKey = key;
          const isHidden = hiddenKeys.has(key);
          pill.classList.toggle('is-hidden', isHidden);
          pill.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
          pill.textContent = isHidden ? `Show ${key}` : key;
          pill.addEventListener('click', () => {
            if (isHidden) hiddenKeys.delete(key);
            else hiddenKeys.add(key);
            applyColumnVisibility();
          });
          pillsHost.appendChild(pill);
        });

        visibilityBar.classList.toggle('has-hidden-schools', hiddenKeys.size > 0);
      }

      function applyColumnVisibility() {
        schoolKeys.forEach((key) => {
          const shouldHide = hiddenKeys.has(key);
          (columnCellsByKey.get(key) || []).forEach((cell) => {
            cell.hidden = shouldHide;
          });
        });

        setHeaderToggleState();
        renderPills();
      }

      function attachHeaderButtons() {
        tableElements.forEach((table) => {
          const headerCells = Array.from(table.querySelectorAll('thead th'));
          headerCells.forEach((cell, index) => {
            if (index === 0 || cell.dataset.toggleReady === 'true') return;
            cell.dataset.toggleReady = 'true';

            const schoolKey = cell.dataset.schoolKey || normaliseSchoolKey(cell.textContent);
            const headerNameHtml = cell.innerHTML;
            cell.innerHTML = `
              <span class="fees-school-name">${headerNameHtml}</span>
              <button type="button" class="fees-column-toggle" data-school-key="${schoolKey}" aria-pressed="false">Hide</button>
            `;

            const button = cell.querySelector('.fees-column-toggle');
            if (button) {
              button.addEventListener('click', () => {
                if (hiddenKeys.has(schoolKey)) hiddenKeys.delete(schoolKey);
                else hiddenKeys.add(schoolKey);
                applyColumnVisibility();
              });
            }
          });
        });
      }

      attachHeaderButtons();

      if (showAllButton) {
        showAllButton.addEventListener('click', () => {
          hiddenKeys.clear();
          applyColumnVisibility();
        });
      }

      applyColumnVisibility();
    }
  }
})();