(function () {
  const STORAGE_KEY = 'psg-shortlist-school-ids-v1';

  function normalizeId(value) {
    const id = String(value == null ? '' : value).trim();
    return id || null;
  }

  function readStorage() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
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

  function writeStorage(ids) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch (error) {
      // ignore storage write failures
    }
  }

  function getIds() {
    return readStorage();
  }

  function hasId(id) {
    const normalized = normalizeId(id);
    if (!normalized) return false;
    return readStorage().includes(normalized);
  }

  function persistAndNotify(ids) {
    const nextIds = Array.isArray(ids) ? ids.map(normalizeId).filter(Boolean) : [];
    writeStorage(nextIds);
    refreshUi(document);
    window.dispatchEvent(
      new CustomEvent('psg:shortlist-change', {
        detail: {
          ids: nextIds.slice(),
          count: nextIds.length,
        },
      })
    );
  }

  function addId(id) {
    const normalized = normalizeId(id);
    if (!normalized) return getIds();
    const ids = readStorage();
    if (!ids.includes(normalized)) ids.unshift(normalized);
    persistAndNotify(ids);
    return ids;
  }

  function removeId(id) {
    const normalized = normalizeId(id);
    if (!normalized) return getIds();
    const ids = readStorage().filter(function (entry) {
      return entry !== normalized;
    });
    persistAndNotify(ids);
    return ids;
  }

  function toggleId(id) {
    if (hasId(id)) {
      removeId(id);
      return false;
    }
    addId(id);
    return true;
  }

  function updateShortlistCount(root) {
    const ids = readStorage();
    const count = ids.length;
    (root || document).querySelectorAll('[data-shortlist-count]').forEach(function (node) {
      node.textContent = String(count);
    });
  }

  function updateShortlistButtons(root) {
    const ids = new Set(readStorage());
    (root || document).querySelectorAll('[data-shortlist-button]').forEach(function (button) {
      const id = normalizeId(button.getAttribute('data-shortlist-school-id') || button.dataset.shortlistSchoolId);
      if (!id) return;
      const active = ids.has(id);
      const addLabel = button.getAttribute('data-shortlist-add-label') || 'Add to shortlist';
      const removeLabel = button.getAttribute('data-shortlist-remove-label') || 'Remove from shortlist';
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
      button.textContent = active ? removeLabel : addLabel;
      if (active) {
        button.setAttribute('title', removeLabel);
      } else {
        button.setAttribute('title', addLabel);
      }
    });
  }

  function refreshUi(root) {
    updateShortlistCount(root || document);
    updateShortlistButtons(root || document);
  }

  window.PSGShortlist = {
    getAll: getIds,
    has: hasId,
    add: addId,
    remove: removeId,
    toggle: toggleId,
    getCount: function () {
      return readStorage().length;
    },
    refreshUi: refreshUi,
  };

  document.addEventListener('click', function (event) {
    const button = event.target && event.target.closest ? event.target.closest('[data-shortlist-button]') : null;
    if (!button) return;
    event.preventDefault();
    const id = button.getAttribute('data-shortlist-school-id') || button.dataset.shortlistSchoolId;
    if (!normalizeId(id)) return;
    toggleId(id);
  });

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY) return;
    refreshUi(document);
    window.dispatchEvent(
      new CustomEvent('psg:shortlist-change', {
        detail: {
          ids: readStorage(),
          count: readStorage().length,
        },
      })
    );
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      refreshUi(document);
    }, { once: true });
  } else {
    refreshUi(document);
  }
})();
