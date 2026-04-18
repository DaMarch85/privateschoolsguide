(function () {
  const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
  const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const SEARCH_RESULTS_STORAGE_KEY = 'psg-search-results-v1';
  const VALID_SECTIONS = ['overview', 'fees', 'academics', 'about'];

  let map = null;
  let markerLayer = null;

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  }

  function getRoot() {
    return document.querySelector('[data-mobile-school-profile]');
  }

  function getCurrentSlug() {
    const body = document.body;
    return body.dataset.schoolSlug || window.location.pathname.replace(/\/$/, '').split('/').pop();
  }

  function normalizePath(path) {
    if (!path) return '';
    try {
      const url = new URL(path, window.location.origin);
      return url.pathname.replace(/\/$/, '') + '/';
    } catch (error) {
      return String(path).replace(/\/$/, '') + '/';
    }
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, function (m) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m];
    });
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function readSearchResultsState() {
    const storage = getSessionStorage();
    if (!storage) return null;
    try {
      const raw = storage.getItem(SEARCH_RESULTS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function createBaseLayer() {
    if (window.L && typeof window.L.maplibreGL === 'function') {
      try {
        return window.L.maplibreGL({ style: OPENFREEMAP_BRIGHT_STYLE });
      } catch (error) {
        console.warn('OpenFreeMap Bright layer failed, falling back to OpenStreetMap raster tiles.', error);
      }
    }

    return window.L.tileLayer(OSM_FALLBACK_URL, {
      maxZoom: 18,
      attribution: '© OpenStreetMap contributors'
    });
  }

  function readJsonScript(id) {
    const element = document.getElementById(id);
    if (!element) return null;
    try {
      return JSON.parse(element.textContent || 'null');
    } catch (error) {
      return null;
    }
  }

  function normalizePoint(data) {
    if (!data) return null;
    const lat = Number(data.lat ?? data.latitude);
    const lng = Number(data.lng ?? data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const href = data.href || data.path || '';
    const path = normalizePath(href || data.path || '');
    return {
      id: data.id ? String(data.id) : '',
      slug: typeof data.slug === 'string' && !data.slug.includes('/') ? data.slug : '',
      name: data.name || 'School',
      href: href || path,
      path: path,
      lat: lat,
      lng: lng,
      latitude: lat,
      longitude: lng,
      note: data.note || '',
      zoom: Number.isFinite(Number(data.zoom)) ? Number(data.zoom) : null
    };
  }

  function getCurrentMapData() {
    return normalizePoint(window.schoolProfileMapData || readJsonScript('school-map-data'));
  }

  function getFallbackNearbyPoints() {
    const raw = window.schoolProfileNearbyMapData || readJsonScript('school-nearby-map-data');
    if (!Array.isArray(raw)) return [];
    return raw.map(normalizePoint).filter(Boolean);
  }

  function popupHtml(point, isCurrent) {
    const linkMarkup = !isCurrent && point.path
      ? '<p><a href="' + escapeHtml(buildSchoolUrl(point.path, getCurrentSectionFromUrl())) + '">Open school</a></p>'
      : '';

    return (
      '<div class="mobile-school-map-popup">' +
        '<h3>' + escapeHtml(point.name) + '</h3>' +
        (point.note ? '<p>' + escapeHtml(point.note) + '</p>' : '') +
        linkMarkup +
      '</div>'
    );
  }

  function getMarkerIcon(kind) {
    if (!window.L) return null;
    const className = kind === 'current'
      ? 'mobile-school-map-pin mobile-school-map-pin--current'
      : 'mobile-school-map-pin';
    const size = kind === 'current' ? 22 : 16;
    return window.L.divIcon({
      className: 'mobile-school-map-icon-wrap',
      html: '<span class="' + className + '"></span>',
      iconSize: [size, size],
      iconAnchor: [Math.round(size / 2), Math.round(size / 2)],
      popupAnchor: [0, -Math.round(size / 2)]
    });
  }

  function getCurrentSectionFromUrl() {
    const params = new URLSearchParams(window.location.search || '');
    const section = String(params.get('section') || 'overview').toLowerCase();
    return VALID_SECTIONS.includes(section) ? section : 'overview';
  }

  function setActiveSection(section, options) {
    const root = getRoot();
    if (!root) return;
    const nextSection = VALID_SECTIONS.includes(section) ? section : 'overview';
    const opts = Object.assign({ updateHistory: true }, options || {});

    root.querySelectorAll('[data-mobile-school-section]').forEach(function (panel) {
      panel.hidden = panel.getAttribute('data-mobile-school-section') !== nextSection;
    });

    root.querySelectorAll('[data-mobile-school-section-target]').forEach(function (button) {
      const active = button.getAttribute('data-mobile-school-section-target') === nextSection;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });

    if (opts.updateHistory && window.history && typeof window.history.replaceState === 'function') {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set('section', nextSection);
      window.history.replaceState({}, '', nextUrl.pathname + nextUrl.search + nextUrl.hash);
    }
  }

  function buildSchoolUrl(path, section) {
    const target = new URL(path || window.location.pathname, window.location.origin);
    target.searchParams.set('section', section || 'overview');
    return target.pathname + target.search + target.hash;
  }

  function normalizeSearchResultItem(item) {
    const normalized = normalizePoint(item);
    if (!normalized) return null;
    if (!normalized.slug && item && typeof item.slug === 'string') normalized.slug = item.slug;
    return normalized;
  }

  function getCurrentSearchResultsContext() {
    const raw = readSearchResultsState();
    if (!raw || !Array.isArray(raw.items) || !raw.items.length) return null;
    const items = raw.items.map(normalizeSearchResultItem).filter(Boolean);
    if (!items.length) return null;

    const currentPath = normalizePath(window.location.pathname);
    const currentSlug = getCurrentSlug();
    const index = items.findIndex(function (item) {
      return (item.path && item.path === currentPath) || (item.slug && item.slug === currentSlug);
    });
    if (index === -1) return null;

    return {
      items: items,
      index: index,
      count: items.length
    };
  }

  function bindSectionNav() {
    const root = getRoot();
    if (!root) return;
    root.querySelectorAll('[data-mobile-school-section-target]').forEach(function (button) {
      button.addEventListener('click', function () {
        const target = button.getAttribute('data-mobile-school-section-target') || 'overview';
        setActiveSection(target);
      });
    });
    setActiveSection(getCurrentSectionFromUrl(), { updateHistory: false });
  }

  function bindSearchResultsNavigation() {
    const root = getRoot();
    if (!root) return;

    const nav = root.querySelector('[data-mobile-school-results-nav]');
    const prevButton = root.querySelector('[data-mobile-school-prev]');
    const nextButton = root.querySelector('[data-mobile-school-next]');
    const label = root.querySelector('[data-mobile-school-results-label]');
    if (!nav || !prevButton || !nextButton || !label) return;

    const context = getCurrentSearchResultsContext();
    if (!context) {
      nav.hidden = true;
      return;
    }

    const currentSection = getCurrentSectionFromUrl();
    const previousItem = context.index > 0 ? context.items[context.index - 1] : null;
    const nextItem = context.index < context.count - 1 ? context.items[context.index + 1] : null;

    nav.hidden = false;
    label.textContent = 'School ' + (context.index + 1) + ' of ' + context.count;
    prevButton.disabled = !previousItem;
    nextButton.disabled = !nextItem;

    prevButton.onclick = previousItem
      ? function () {
          window.location.href = buildSchoolUrl(previousItem.path || previousItem.href, currentSection);
        }
      : null;

    nextButton.onclick = nextItem
      ? function () {
          window.location.href = buildSchoolUrl(nextItem.path || nextItem.href, currentSection);
        }
      : null;
  }

  function initHeroSlideshow() {
    const root = getRoot();
    if (!root) return;
    const slideshow = root.querySelector('[data-mobile-hero-slideshow]');
    if (!slideshow || slideshow.dataset.bound === 'true') return;

    const slides = Array.from(slideshow.querySelectorAll('[data-mobile-hero-slide]'));
    if (slides.length <= 1) return;

    const dots = Array.from(slideshow.querySelectorAll('[data-mobile-hero-dot]'));
    const prevButton = slideshow.querySelector('[data-mobile-hero-prev]');
    const nextButton = slideshow.querySelector('[data-mobile-hero-next]');
    const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let activeIndex = 0;
    let timer = null;

    function renderSlides(nextIndex) {
      activeIndex = (nextIndex + slides.length) % slides.length;
      slides.forEach(function (slide, index) {
        slide.classList.toggle('is-active', index === activeIndex);
      });
      dots.forEach(function (dot, index) {
        const active = index === activeIndex;
        dot.classList.toggle('is-active', active);
        dot.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function stopAutoplay() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function startAutoplay() {
      if (prefersReducedMotion) return;
      stopAutoplay();
      timer = window.setInterval(function () {
        renderSlides(activeIndex + 1);
      }, 5000);
    }

    if (prevButton) {
      prevButton.addEventListener('click', function () {
        renderSlides(activeIndex - 1);
        startAutoplay();
      });
    }

    if (nextButton) {
      nextButton.addEventListener('click', function () {
        renderSlides(activeIndex + 1);
        startAutoplay();
      });
    }

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        const index = Number(dot.getAttribute('data-mobile-hero-index'));
        if (Number.isFinite(index)) {
          renderSlides(index);
          startAutoplay();
        }
      });
    });

    slideshow.addEventListener('mouseenter', stopAutoplay);
    slideshow.addEventListener('mouseleave', startAutoplay);
    slideshow.addEventListener('focusin', stopAutoplay);
    slideshow.addEventListener('focusout', function (event) {
      if (!slideshow.contains(event.relatedTarget)) startAutoplay();
    });

    renderSlides(0);
    startAutoplay();
    slideshow.dataset.bound = 'true';
  }

  function bindSubjectToggles() {
    const root = getRoot();
    if (!root) return;

    root.querySelectorAll('[data-mobile-subject-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        const card = button.closest('.mobile-school-card');
        if (!card) return;
        const extra = card.querySelector('.subject-extra');
        if (!extra) return;
        const action = button.getAttribute('data-mobile-subject-toggle');
        extra.hidden = action !== 'expand';
      });
    });
  }

  function bindMapNavigation(marker, targetPath) {
    if (!marker || !targetPath) return;
    marker.on('click', function () {
      window.location.href = buildSchoolUrl(targetPath, getCurrentSectionFromUrl());
    });
  }

  function renderMap() {
    const target = document.getElementById('mobile-school-map');
    if (!target || !window.L) return;

    const currentPoint = getCurrentMapData();
    if (!currentPoint) return;

    if (!map) {
      map = window.L.map(target, {
        zoomControl: true,
        scrollWheelZoom: false,
        tap: true
      });
      createBaseLayer().addTo(map);
    }

    if (markerLayer) markerLayer.remove();
    markerLayer = window.L.layerGroup().addTo(map);

    const section = getCurrentSectionFromUrl();
    const currentPath = normalizePath(window.location.pathname);
    const context = getCurrentSearchResultsContext();
    const otherPoints = context
      ? context.items.filter(function (item) { return item.path && item.path !== currentPath; })
      : getFallbackNearbyPoints().filter(function (item) { return item.path && item.path !== currentPath; });

    const currentMarker = window.L.marker([currentPoint.lat, currentPoint.lng], {
      icon: getMarkerIcon('current'),
      zIndexOffset: 500
    }).addTo(markerLayer);
    currentMarker.bindPopup(popupHtml(currentPoint, true));

    otherPoints.forEach(function (point) {
      const marker = window.L.marker([point.lat, point.lng], {
        icon: getMarkerIcon('other'),
        zIndexOffset: 320
      }).addTo(markerLayer);
      marker.bindPopup(popupHtml(point, false));
      bindMapNavigation(marker, point.path || point.href);
      marker.on('popupopen', function () {
        const popupEl = marker.getPopup() && marker.getPopup().getElement ? marker.getPopup().getElement() : null;
        if (!popupEl) return;
        const link = popupEl.querySelector('a');
        if (!link) return;
        link.addEventListener('click', function (event) {
          event.preventDefault();
          window.location.href = buildSchoolUrl(point.path || point.href, section);
        }, { once: true });
      });
    });

    map.setView([currentPoint.lat, currentPoint.lng], currentPoint.zoom || 13);
    window.setTimeout(function () {
      map.invalidateSize();
    }, 50);
  }

  function init() {
    if (!isMobileViewport()) return;
    if (!getRoot()) return;

    bindSectionNav();
    bindSearchResultsNavigation();
    initHeroSlideshow();
    bindSubjectToggles();
    renderMap();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
