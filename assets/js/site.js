(function () {
  const SHORTLIST_STORAGE_KEY = 'psg-shortlist-school-ids-v1';
  const SEARCH_STATE_STORAGE_KEY = 'psg-search-state-v1';

  function normalizeId(value) {
    const id = String(value == null ? '' : value).trim();
    return id || null;
  }

  function cleanString(value) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return text || '';
  }

  function normalizeStringArray(value) {
    if (!Array.isArray(value)) return [];
    const seen = new Set();
    return value
      .map(function (entry) { return cleanString(entry); })
      .filter(function (entry) {
        if (!entry || seen.has(entry)) return false;
        seen.add(entry);
        return true;
      });
  }

  function safeJsonParse(raw, fallback) {
    try {
      return JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function getSessionStorage() {
    try {
      return window.sessionStorage;
    } catch (error) {
      return null;
    }
  }

  function readShortlistStorage() {
    try {
      const raw = window.localStorage.getItem(SHORTLIST_STORAGE_KEY);
      if (!raw) return [];
      const parsed = safeJsonParse(raw, []);
      if (!Array.isArray(parsed)) return [];
      const seen = new Set();
      return parsed
        .map(normalizeId)
        .filter(function (id) {
          if (!id || seen.has(id)) return false;
          seen.add(id);
          return true;
        });
    } catch (error) {
      return [];
    }
  }

  function writeShortlistStorage(ids) {
    try {
      window.localStorage.setItem(SHORTLIST_STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
      // ignore storage write failures
    }
  }

  function getShortlistIds() {
    return readShortlistStorage();
  }

  function hasShortlistId(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    return readShortlistStorage().includes(normalized);
  }

  function normalizeSearchState(value) {
    if (!value || typeof value !== 'object') return null;

    const mode = value.mode === 'url' ? 'url' : 'form';
    const locationLabel = cleanString(value.locationLabel || value.locationQuery || value.resolvedLocationLabel);
    const restoreUrl = cleanString(value.restoreUrl) || (mode === 'form' ? '/?restoreSearch=1' : '/');

    if (mode === 'url') {
      return {
        mode: 'url',
        restoreUrl: restoreUrl,
        locationLabel: locationLabel
      };
    }

    const radiusMiles = Number(value.radiusMiles);
    const feeMin = Number(value.feeMin);
    const feeMax = Number(value.feeMax);
    const dayFeeMin = Number(value.dayFeeMin ?? value.feeMin);
    const dayFeeMax = Number(value.dayFeeMax ?? value.feeMax);
    const boardingFeeMin = Number(value.boardingFeeMin);
    const boardingFeeMax = Number(value.boardingFeeMax);
    const alevelMin = Number(value.alevelMin);
    const alevelMax = Number(value.alevelMax);
    const centeredMapZoom = Number(value.centeredMapZoom);
    const mapCenterLat = Number(value.mapCenterLat);
    const mapCenterLng = Number(value.mapCenterLng);
    const mapZoom = Number(value.mapZoom);

    return {
      mode: 'form',
      restoreUrl: restoreUrl,
      locationLabel: locationLabel,
      locationQuery: cleanString(value.locationQuery),
      radiusMiles: Number.isFinite(radiusMiles) && radiusMiles > 0 ? radiusMiles : 10,
      genders: normalizeStringArray(value.genders),
      ageRanges: normalizeStringArray(value.ageRanges),
      boarding: normalizeStringArray(value.boarding),
      religions: normalizeStringArray(value.religions),
      sixthFormOnly: Boolean(value.sixthFormOnly),
      nurseryOnly: Boolean(value.nurseryOnly),
      bursariesOnly: Boolean(value.bursariesOnly),
      scholarshipsOnly: Boolean(value.scholarshipsOnly),
      feeMode: value.feeMode === 'boarding' ? 'boarding' : 'day',
      feeMin: Number.isFinite(feeMin) ? feeMin : null,
      feeMax: Number.isFinite(feeMax) ? feeMax : null,
      dayFeeMin: Number.isFinite(dayFeeMin) ? dayFeeMin : null,
      dayFeeMax: Number.isFinite(dayFeeMax) ? dayFeeMax : null,
      boardingFeeMin: Number.isFinite(boardingFeeMin) ? boardingFeeMin : null,
      boardingFeeMax: Number.isFinite(boardingFeeMax) ? boardingFeeMax : null,
      alevelMin: Number.isFinite(alevelMin) ? alevelMin : null,
      alevelMax: Number.isFinite(alevelMax) ? alevelMax : null,
      sortMode: cleanString(value.sortMode) || 'dayFeesDesc',
      resolvedLocationLabel: cleanString(value.resolvedLocationLabel),
      centeredMap: Boolean(value.centeredMap),
      centeredMapZoom: Number.isFinite(centeredMapZoom) && centeredMapZoom > 0 ? centeredMapZoom : null,
      mapCenterLat: Number.isFinite(mapCenterLat) ? mapCenterLat : null,
      mapCenterLng: Number.isFinite(mapCenterLng) ? mapCenterLng : null,
      mapZoom: Number.isFinite(mapZoom) && mapZoom > 0 ? mapZoom : null
    };
  }

  function readSearchState() {
    const storage = getSessionStorage();
    if (!storage) return null;
    const raw = storage.getItem(SEARCH_STATE_STORAGE_KEY);
    if (!raw) return null;
    return normalizeSearchState(safeJsonParse(raw, null));
  }

  function writeSearchState(state) {
    const storage = getSessionStorage();
    if (!storage) return null;
    const normalized = normalizeSearchState(state);
    if (!normalized) return null;
    try {
      storage.setItem(SEARCH_STATE_STORAGE_KEY, JSON.stringify(normalized));
    } catch (error) {
      return null;
    }
    return normalized;
  }

  function clearSearchState() {
    const storage = getSessionStorage();
    if (!storage) return;
    try {
      storage.removeItem(SEARCH_STATE_STORAGE_KEY);
    } catch (error) {
      // ignore storage failures
    }
  }

  function getRestoreHrefForLink(link) {
    const savedState = readSearchState();
    if (savedState && savedState.restoreUrl) return savedState.restoreUrl;
    if (link) {
      const href = cleanString(link.getAttribute('href'));
      if (href) return href;
    }
    return '/';
  }

  function updateRestoreLinks(root) {
    const savedState = readSearchState();
    const scope = root || document;
    scope.querySelectorAll('[data-restore-search-link]').forEach(function (link) {
      if (!(link instanceof HTMLAnchorElement)) return;
      link.setAttribute('href', getRestoreHrefForLink(link));
      if (link.hasAttribute('data-restore-search-dynamic-label')) {
        link.textContent = savedState && savedState.locationLabel
          ? '← Back to ' + savedState.locationLabel
          : '← Back to search';
      }
    });
  }

  function updateShortlistCount(root) {
    const ids = readShortlistStorage();
    const count = ids.length;
    (root || document).querySelectorAll('[data-shortlist-count]').forEach(function (node) {
      node.textContent = String(count);
    });
  }

  function updateShortlistButtons(root) {
    const ids = new Set(readShortlistStorage());
    (root || document).querySelectorAll('[data-shortlist-button]').forEach(function (button) {
      const id = normalizeId(button.getAttribute('data-shortlist-school-id') || button.dataset.shortlistSchoolId);
      if (!id) return;
      const active = ids.has(id);
      const addLabel = button.getAttribute('data-shortlist-add-label') || 'Add to shortlist';
      const removeLabel = button.getAttribute('data-shortlist-remove-label') || 'Remove from shortlist';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.textContent = active ? removeLabel : addLabel;
      button.setAttribute('title', active ? removeLabel : addLabel);
    });
  }

  function refreshUi(root) {
    updateShortlistCount(root || document);
    updateShortlistButtons(root || document);
    updateRestoreLinks(root || document);
  }

  function persistShortlistAndNotify(ids) {
    const nextIds = Array.isArray(ids) ? ids.map(normalizeId).filter(Boolean) : [];
    writeShortlistStorage(nextIds);
    refreshUi(document);
    window.dispatchEvent(
      new CustomEvent('psg:shortlist-change', {
        detail: {
          ids: nextIds.slice(),
          count: nextIds.length
        }
      })
    );
  }

  function addShortlistId(id) {
    const normalized = normalizeId(id);
    if (!normalized) return getShortlistIds();
    const ids = readShortlistStorage();
    if (!ids.includes(normalized)) ids.unshift(normalized);
    persistShortlistAndNotify(ids);
    return ids;
  }

  function removeShortlistId(id) {
    const normalized = normalizeId(id);
    if (!normalized) return getShortlistIds();
    const ids = readShortlistStorage().filter(function (entry) {
      return entry !== normalized;
    });
    persistShortlistAndNotify(ids);
    return ids;
  }

  function toggleShortlistId(id) {
    if (hasShortlistId(id)) {
      removeShortlistId(id);
      return false;
    }
    addShortlistId(id);
    return true;
  }

  function applyInitialSearchState() {
    const initialState = normalizeSearchState(window.PSGInitialSearchState || null);
    if (!initialState) return;
    writeSearchState(initialState);
    updateRestoreLinks(document);
  }

  window.PSGShortlist = {
    getAll: getShortlistIds,
    has: hasShortlistId,
    add: addShortlistId,
    remove: removeShortlistId,
    toggle: toggleShortlistId,
    getCount: function () {
      return readShortlistStorage().length;
    },
    refreshUi: refreshUi
  };

  window.PSGSearchState = {
    get: readSearchState,
    save: writeSearchState,
    clear: clearSearchState,
    getRestoreHref: getRestoreHrefForLink,
    refreshUi: updateRestoreLinks
  };

  document.addEventListener('click', function (event) {
    const restoreLink = event.target && event.target.closest ? event.target.closest('[data-restore-search-link]') : null;
    if (restoreLink instanceof HTMLAnchorElement) {
      const href = getRestoreHrefForLink(restoreLink);
      if (href) {
        event.preventDefault();
        window.location.href = href;
        return;
      }
    }

    const button = event.target && event.target.closest ? event.target.closest('[data-shortlist-button]') : null;
    if (!button) return;
    event.preventDefault();
    const id = button.getAttribute('data-shortlist-school-id') || button.dataset.shortlistSchoolId;
    if (!normalizeId(id)) return;
    toggleShortlistId(id);
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== SHORTLIST_STORAGE_KEY) return;
    refreshUi(document);
    window.dispatchEvent(
      new CustomEvent('psg:shortlist-change', {
        detail: {
          ids: readShortlistStorage(),
          count: readShortlistStorage().length
        }
      })
    );
  });

  function initSiteUtilities() {
    applyInitialSearchState();
    refreshUi(document);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSiteUtilities, { once: true });
  } else {
    initSiteUtilities();
  }
})();
