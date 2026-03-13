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
  }
})();