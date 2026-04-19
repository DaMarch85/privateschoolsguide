(function () {
  const OPENFREEMAP_BRIGHT_STYLE = 'https://tiles.openfreemap.org/styles/bright';
  const OSM_FALLBACK_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const SEARCH_RESULTS_STORAGE_KEY = 'psg-search-results-v1';
  const VALID_SECTIONS = ['overview', 'fees', 'academics', 'about'];

  let map = null;
  let markerLayer = null;
  let mapRetryTimer = null;
  let resultsSheetOpen = false;

  function isMobileViewport() {
    return window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  }

  function getRoot() {
    return document.querySelector('[data-mobile-school-profile]');
  }

  function getTopbar() {
    const root = getRoot();
    return root ? root.querySelector('[data-mobile-school-topbar]') : null;
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
      ? '<p><a href="' + escapeHtml(buildSchoolUrl(point.path, getCurrentSection())) + '">Open school</a></p>'
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

  function getSectionControls() {
    const root = getRoot();
    return root ? Array.from(root.querySelectorAll('[data-mobile-school-section-control]')) : [];
  }

  function getCurrentSectionFromUrl() {
    const params = new URLSearchParams(window.location.search || '');
    const section = String(params.get('section') || 'overview').toLowerCase();
    return VALID_SECTIONS.includes(section) ? section : 'overview';
  }

  function getCurrentSection() {
    const checked = getSectionControls().find(function (control) {
      return control.checked;
    });
    return checked ? checked.value : 'overview';
  }

  function setCheckedSection(section) {
    const nextSection = VALID_SECTIONS.includes(section) ? section : 'overview';
    const controls = getSectionControls();
    const target = controls.find(function (control) {
      return control.value === nextSection;
    });
    if (!target) return;
    target.checked = true;
  }

  function syncSectionUrl(section) {
    if (!window.history || typeof window.history.replaceState !== 'function') return;
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('section', section || 'overview');
    window.history.replaceState({}, '', nextUrl.pathname + nextUrl.search + nextUrl.hash);
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

  function syncStickyOffset() {
    const root = getRoot();
    const topbar = getTopbar();
    if (!root || !topbar) return;
    root.style.setProperty('--mobile-school-sticky-offset', topbar.offsetHeight + 'px');
  }

  function bindSectionNav() {
    const root = getRoot();
    if (!root) return;

    const initialSection = getCurrentSectionFromUrl();
    setCheckedSection(initialSection);

    getSectionControls().forEach(function (control) {
      control.addEventListener('change', function () {
        if (!control.checked) return;
        syncSectionUrl(control.value);
        if (control.value === 'overview') ensureMapRendered();
      });
    });

    syncSectionUrl(getCurrentSection());
  }

  function bindSearchResultsNavigation() {
    const root = getRoot();
    if (!root) return null;

    const nav = root.querySelector('[data-mobile-school-results-nav]');
    const resultsRow = root.querySelector('[data-mobile-school-results-list-row]');
    const prevButton = root.querySelector('[data-mobile-school-prev]');
    const nextButton = root.querySelector('[data-mobile-school-next]');
    const label = root.querySelector('[data-mobile-school-results-label]');
    if (!nav || !resultsRow || !prevButton || !nextButton || !label) return null;

    const context = getCurrentSearchResultsContext();
    if (!context) {
      nav.hidden = true;
      resultsRow.hidden = true;
      syncStickyOffset();
      return null;
    }

    const currentSection = getCurrentSection();
    const previousItem = context.index > 0 ? context.items[context.index - 1] : null;
    const nextItem = context.index < context.count - 1 ? context.items[context.index + 1] : null;

    nav.hidden = false;
    resultsRow.hidden = false;
    label.textContent = 'School ' + (context.index + 1) + ' of ' + context.count;
    prevButton.disabled = !previousItem;
    nextButton.disabled = !nextItem;

    prevButton.onclick = previousItem
      ? function () {
          window.location.href = buildSchoolUrl(previousItem.path || previousItem.href, getCurrentSection());
        }
      : null;

    nextButton.onclick = nextItem
      ? function () {
          window.location.href = buildSchoolUrl(nextItem.path || nextItem.href, getCurrentSection());
        }
      : null;

    syncStickyOffset();
    return context;
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

  function bindFeeSwitches() {
    const root = getRoot();
    if (!root) return;

    root.querySelectorAll('[data-mobile-fee-target]').forEach(function (button) {
      button.addEventListener('click', function () {
        const target = button.getAttribute('data-mobile-fee-target');
        if (!target) return;

        root.querySelectorAll('[data-mobile-fee-target]').forEach(function (candidate) {
          const active = candidate.getAttribute('data-mobile-fee-target') === target;
          candidate.classList.toggle('is-active', active);
          candidate.setAttribute('aria-pressed', active ? 'true' : 'false');
        });

        root.querySelectorAll('[data-mobile-fee-pane]').forEach(function (pane) {
          const active = pane.getAttribute('data-mobile-fee-pane') === target;
          pane.hidden = !active;
          pane.classList.toggle('is-active', active);
        });
      });
    });
  }

  function bindMapNavigation(marker, targetPath) {
    if (!marker || !targetPath) return;
    marker.on('click', function () {
      window.location.href = buildSchoolUrl(targetPath, getCurrentSection());
    });
  }

  function renderMap() {
    const target = document.getElementById('mobile-school-map');
    if (!target) return;
    if (getCurrentSection() !== 'overview') return;

    const currentPoint = getCurrentMapData();
    if (!currentPoint) return;

    if (!window.L) return;

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
          window.location.href = buildSchoolUrl(point.path || point.href, getCurrentSection());
        }, { once: true });
      });
    });

    map.setView([currentPoint.lat, currentPoint.lng], currentPoint.zoom || 13);
    window.requestAnimationFrame(function () {
      map.invalidateSize();
    });
  }

  function ensureMapRendered() {
    if (mapRetryTimer) {
      window.clearTimeout(mapRetryTimer);
      mapRetryTimer = null;
    }

    function retry(attempt) {
      if (!isMobileViewport()) return;
      if (getCurrentSection() !== 'overview') return;
      if (window.L) {
        renderMap();
        return;
      }
      if (attempt >= 30) return;
      mapRetryTimer = window.setTimeout(function () {
        retry(attempt + 1);
      }, 200);
    }

    retry(0);
  }

  function setResultsSheetOpen(open) {
    const root = getRoot();
    if (!root) return;
    const sheet = root.querySelector('[data-mobile-results-sheet]');
    if (!sheet) return;
    resultsSheetOpen = Boolean(open);
    sheet.hidden = !resultsSheetOpen;
    document.documentElement.classList.toggle('is-mobile-results-sheet-open', resultsSheetOpen);
    document.body.classList.toggle('is-mobile-results-sheet-open', resultsSheetOpen);
  }

  function populateResultsSheet(context) {
    const root = getRoot();
    if (!root) return;
    const summary = root.querySelector('[data-mobile-results-summary]');
    const list = root.querySelector('[data-mobile-results-list]');
    if (!summary || !list) return;

    if (!context || !context.items.length) {
      summary.textContent = 'No saved search results found.';
      list.innerHTML = '';
      return;
    }

    summary.textContent = context.count + ' schools in this search.';

    const fragment = document.createDocumentFragment();
    context.items.forEach(function (item, index) {
      const link = document.createElement('a');
      const isCurrent = index === context.index;
      link.className = 'mobile-results-sheet__item' + (isCurrent ? ' is-current' : '');
      link.href = buildSchoolUrl(item.path || item.href, getCurrentSection());
      link.innerHTML =
        '<span class="mobile-results-sheet__item-index">' + (index + 1) + '</span>' +
        '<span class="mobile-results-sheet__item-copy">' +
          '<strong>' + escapeHtml(item.name) + '</strong>' +
          (item.note ? '<small>' + escapeHtml(item.note) + '</small>' : '') +
        '</span>';
      fragment.appendChild(link);
    });

    list.innerHTML = '';
    list.appendChild(fragment);
  }

  function bindResultsSheet(context) {
    const root = getRoot();
    if (!root) return;
    const openButtons = Array.from(root.querySelectorAll('[data-mobile-results-open]'));
    const closeButtons = Array.from(root.querySelectorAll('[data-mobile-results-close]'));
    if (!openButtons.length) return;

    if (!context) {
      openButtons.forEach(function (button) {
        button.hidden = true;
      });
      return;
    }

    populateResultsSheet(context);

    openButtons.forEach(function (button) {
      button.hidden = false;
      button.addEventListener('click', function () {
        populateResultsSheet(context);
        setResultsSheetOpen(true);
      });
    });

    closeButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        setResultsSheetOpen(false);
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && resultsSheetOpen) setResultsSheetOpen(false);
    });
  }

  function init() {
    if (!isMobileViewport()) return;
    if (!getRoot()) return;

    bindSectionNav();
    bindFeeSwitches();
    const context = bindSearchResultsNavigation();
    bindResultsSheet(context);
    initHeroSlideshow();
    bindSubjectToggles();
    syncStickyOffset();
    ensureMapRendered();

    window.addEventListener('resize', function () {
      syncStickyOffset();
      if (getCurrentSection() === 'overview') ensureMapRendered();
    });

    window.addEventListener('orientationchange', function () {
      syncStickyOffset();
      if (getCurrentSection() === 'overview') ensureMapRendered();
    });

    window.addEventListener('load', function () {
      syncStickyOffset();
      if (getCurrentSection() === 'overview') ensureMapRendered();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
