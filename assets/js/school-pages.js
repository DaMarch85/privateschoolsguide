
(function () {
  const body = document.body;
  const currentSlug =
    body.dataset.schoolSlug ||
    window.location.pathname.replace(/\/$/, "").split("/").pop();
  const locationSlug =
    body.dataset.locationSlug ||
    window.location.pathname.split("/").filter(Boolean)[0] ||
    "bath";
  const locationName = (() => {
    const backLinkText = document.querySelector(".school-back-link")?.textContent || "";
    const cleaned = backLinkText.replace(/^\s*←?\s*Back to\s+/i, "").trim();
    if (cleaned) return cleaned;
    return locationSlug
      .split("-")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");
  })();

  const mapTarget = document.getElementById("school-page-map");
  const mapTitle = document.querySelector(".school-map-panel .location-map-head h2");
  const mapCaption = document.querySelector(".school-map-panel .map-caption");
  const sideCompareLinks = Array.from(
    document.querySelectorAll(".school-compare-links a")
  );
  const main = document.querySelector(".school-profile-main");
  const baseGrid = main ? main.querySelector(".school-feature-grid") : null;

  let compareMount = null;
  let map = null;
  let markerLayer = null;
  const cache = new Map();

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, (m) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[m]
    );
  }

  function roundPercentString(text) {
    return String(text || "").replace(/(\d+(?:\.\d+)?)%/g, (_, num) => {
      const value = Number.parseFloat(num);
      return `${Math.round(value)}%`;
    });
  }

  function normalizePercentages(scope) {
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const original = node.nodeValue || "";
      const updated = roundPercentString(original);
      if (updated !== original) node.nodeValue = updated;
    });
  }

  function normalizeMapData(raw) {
    if (!raw || typeof raw !== "object") return null;
    const lat = Number(raw.lat ?? raw.latitude);
    const lng = Number(raw.lng ?? raw.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      ...raw,
      lat,
      lng,
    };
  }

  function extractMapData(doc) {
    if (doc === document && window.schoolProfileMapData) {
      const currentPageMap = normalizeMapData(window.schoolProfileMapData);
      if (currentPageMap) return currentPageMap;
    }

    const jsonScript = doc.getElementById("school-map-data");
    if (jsonScript) {
      try {
        const parsed = JSON.parse(jsonScript.textContent || "null");
        const mapData = normalizeMapData(parsed);
        if (mapData) return mapData;
      } catch (err) {}
    }

    const script = Array.from(doc.querySelectorAll("script")).find((node) =>
      node.textContent.includes("window.schoolProfileMapData")
    );
    if (!script) return null;
    const match = script.textContent.match(
      /window\.schoolProfileMapData\s*=\s*(null|\{[\s\S]*?\});?/
    );
    if (!match || match[1] === "null") return null;
    try {
      return normalizeMapData(JSON.parse(match[1]));
    } catch (err) {
      return null;
    }
  }

  function extractSchoolData(doc, slugHint) {
    const titleEl = doc.querySelector("#school-page-title");
    const subheadEl = doc.querySelector(".school-profile-subhead");
    const grid = doc.querySelector(".school-feature-grid");
    const caption = doc.querySelector(".map-caption");
    const canonical = doc.querySelector('link[rel="canonical"]');
    let path = `/${locationSlug}/schools/${slugHint}/`;
    if (canonical) {
      try {
        path = new URL(canonical.getAttribute("href")).pathname;
      } catch (err) {}
    }
    return {
      slug: slugHint,
      path,
      name: titleEl ? titleEl.textContent.trim() : slugHint,
      subhead: subheadEl ? subheadEl.textContent.trim() : "",
      tiles: grid ? Array.from(grid.children).map((node) => node.outerHTML) : [],
      mapData: extractMapData(doc),
      address: caption ? caption.textContent.trim() : "",
    };
  }

  const currentData = extractSchoolData(document, currentSlug);
  cache.set(currentSlug, currentData);

  function getTileTitleFromHtml(tileHtml) {
    const wrap = document.createElement("div");
    wrap.innerHTML = tileHtml.trim();
    const title = wrap.querySelector("h2");
    return title ? title.textContent.trim() : "";
  }

  function buildTileMap(data) {
    const result = new Map();
    (data.tiles || []).forEach((tileHtml) => {
      const title = getTileTitleFromHtml(tileHtml);
      if (title) result.set(title, tileHtml);
    });
    return result;
  }

  function buildTileOrder(primaryData, secondaryData) {
    const order = [];
    const seen = new Set();
    const pushTitle = (title) => {
      if (title && !seen.has(title)) {
        seen.add(title);
        order.push(title);
      }
    };
    (primaryData.tiles || []).forEach((tileHtml) =>
      pushTitle(getTileTitleFromHtml(tileHtml))
    );
    (secondaryData.tiles || []).forEach((tileHtml) =>
      pushTitle(getTileTitleFromHtml(tileHtml))
    );
    return order;
  }

  function tileElementFromHtml(tileHtml) {
    const wrap = document.createElement("div");
    wrap.innerHTML = tileHtml.trim();
    return wrap.firstElementChild || null;
  }

  function createPlaceholderTile(title) {
    const tile = document.createElement("article");
    tile.className = "school-feature-tile school-feature-tile--placeholder";
    tile.setAttribute("aria-hidden", "true");
    tile.setAttribute("data-missing-tile", title || "");
    return tile;
  }

  function getMarkerIcon(kind) {
    if (!window.L) return null;
    const markerClass =
      kind === "secondary"
        ? "school-map-marker school-map-marker--secondary"
        : "school-map-marker school-map-marker--primary";
    return window.L.divIcon({
      className: "school-map-icon-wrap",
      html: `<span class="${markerClass}"></span>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8],
      popupAnchor: [0, -8],
    });
  }

  function popupHtml(data) {
    const note = data.mapData && data.mapData.note ? data.mapData.note : "";
    return `
      <div class="school-map-popup">
        <h3>${escapeHtml(data.name)}</h3>
        ${note ? `<p>${escapeHtml(note)}</p>` : ""}
        <p><a href="${escapeHtml(data.path)}">View school</a></p>
      </div>
    `;
  }

  function renderMap(primary, secondary) {
    if (!mapTarget || !window.L || !primary || !primary.mapData) return;

    if (!map) {
      map = window.L.map(mapTarget, { zoomControl: true, scrollWheelZoom: false });
      window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
    }

    if (markerLayer) markerLayer.remove();
    markerLayer = window.L.layerGroup().addTo(map);

    const bounds = [];
    const addMarker = (data, kind) => {
      if (!data || !data.mapData) return;
      const latLng = [data.mapData.lat, data.mapData.lng];
      bounds.push(latLng);
      const marker = window.L.marker(latLng, { icon: getMarkerIcon(kind) }).addTo(
        markerLayer
      );
      marker.bindPopup(popupHtml(data));
    };

    addMarker(primary, "primary");
    if (secondary) addMarker(secondary, "secondary");

    if (bounds.length === 1) {
      map.setView(bounds[0], primary.mapData.zoom || 13);
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [40, 40] });
    }

    if (mapTitle) mapTitle.textContent = secondary ? "School locations" : "School location";
    if (mapCaption) {
      mapCaption.textContent = secondary
        ? `${primary.name} and ${secondary.name} in ${locationName}`
        : primary.address || locationName;
    }

    const existingLegend = document.querySelector(".school-map-legend");
    if (existingLegend) existingLegend.remove();

    if (secondary && mapTarget.parentElement) {
      const legend = document.createElement("div");
      legend.className = "school-map-legend";
      legend.innerHTML = `
        <span class="school-map-legend-item">
          <i class="school-map-dot school-map-dot--primary"></i>
          ${escapeHtml(primary.name)}
        </span>
        <span class="school-map-legend-item">
          <i class="school-map-dot school-map-dot--secondary"></i>
          ${escapeHtml(secondary.name)}
        </span>
      `;
      mapTarget.parentElement.appendChild(legend);
    }

    setTimeout(() => map.invalidateSize(), 60);
  }

  function findTileByHeading(scope, headingText) {
    const tiles = Array.from(scope.querySelectorAll(".school-feature-tile"));
    return (
      tiles.find((tile) => {
        const h = tile.querySelector("h2");
        return h && h.textContent.trim().toLowerCase() === headingText.toLowerCase();
      }) || null
    );
  }

  function wireSubjectToggle(tile) {
    if (!tile || tile.dataset.subjectFixBound === "true") return;
    tile.dataset.subjectFixBound = "true";

    const opener = tile.querySelector('[data-subject-toggle="expand"]');
    const closer = tile.querySelector('[data-subject-toggle="collapse"]');
    const extra = tile.querySelector(".subject-extra, [data-subject-extra]");

    if (!opener || !closer || !extra) return;

    const sync = (expanded) => {
      extra.hidden = !expanded;
      opener.hidden = expanded;
      opener.style.display = expanded ? "none" : "";
      closer.hidden = !expanded;
      closer.style.display = expanded ? "" : "none";
      tile.classList.toggle("is-expanded", expanded);
    };

    opener.addEventListener("click", () => sync(true));
    closer.addEventListener("click", () => sync(false));

    const isExpanded =
      !extra.hidden &&
      (closer.style.display !== "none" || !closer.hidden);
    sync(Boolean(isExpanded));
  }

  function feeRowCandidates(tile) {
    const directRows = Array.from(tile.querySelectorAll(".fee-year-row"));
    if (directRows.length) return directRows;

    const selectors = [
      "[data-fee-pane] li",
      "[data-fee-pane] tr",
      "li",
      "tr",
    ];
    const all = Array.from(tile.querySelectorAll(selectors.join(",")));
    const seen = new Set();
    return all.filter((el) => {
      if (seen.has(el)) return false;
      seen.add(el);
      const text = (el.textContent || "").replace(/\s+/g, " ").trim();
      return /^(Reception|Year\s+[0-9]{1,2})\b/i.test(text);
    });
  }

  function ensureFeeSwitchSpacer(tile, shouldShow) {
    if (!tile) return;
    let spacer = tile.querySelector(".fee-switch-spacer");
    if (tile.querySelector("[data-fee-switch]")) {
      if (spacer) spacer.remove();
      return;
    }
    if (!shouldShow) {
      if (spacer) spacer.remove();
      return;
    }
    const firstPane = tile.querySelector("[data-fee-pane]");
    if (!firstPane) return;
    if (!spacer) {
      spacer = document.createElement("div");
      spacer.className = "fee-switch-spacer";
      spacer.setAttribute("aria-hidden", "true");
      firstPane.parentElement.insertBefore(spacer, firstPane);
    }
  }

  function wireFeeHideToggle(tile) {
    if (!tile || tile.dataset.feeFixBound === "true") return;
    tile.dataset.feeFixBound = "true";

    const rows = feeRowCandidates(tile);
    if (!rows.length) return;

    const lowerRows = rows.filter((row) =>
      /^(Reception|Year\s+[1-6])\b/i.test(
        (row.textContent || "").replace(/\s+/g, " ").trim()
      )
    );
    const upperRows = rows.filter((row) =>
      /^Year\s+(7|8|9|10|11|12|13)\b/i.test(
        (row.textContent || "").replace(/\s+/g, " ").trim()
      )
    );

    if (!lowerRows.length || !upperRows.length) return;

    const heading = tile.querySelector("h2");
    if (!heading) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "fee-profile-toggle";
    button.textContent = "Hide years R–6";
    button.style.marginLeft = "auto";
    button.style.alignSelf = "flex-start";
    button.style.fontSize = "12px";
    button.style.letterSpacing = ".08em";
    button.style.textTransform = "uppercase";
    button.style.background = "transparent";
    button.style.border = "1px solid currentColor";
    button.style.padding = ".3rem .45rem";
    button.style.cursor = "pointer";

    let hidden = false;
    button.addEventListener("click", () => {
      hidden = !hidden;
      lowerRows.forEach((row) => {
        row.hidden = hidden;
        row.style.display = hidden ? "none" : "";
      });
      button.textContent = hidden ? "Show years R–6" : "Hide years R–6";
    });

    const parent = heading.parentElement;
    if (parent) {
      parent.style.display = "flex";
      parent.style.alignItems = "flex-start";
      parent.style.gap = ".75rem";
      parent.appendChild(button);
    }
  }

  function bindTileInteractions(scope) {
    if (!scope) return;
    scope
      .querySelectorAll(".subjects-details, .school-feature-tile.tile-expandable")
      .forEach((node) => {
        const tile = node.closest
          ? node.closest(".school-feature-tile")
          : node.classList.contains("school-feature-tile")
          ? node
          : null;
        if (tile && /popular subjects/i.test(tile.querySelector("h2")?.textContent || "")) {
          wireSubjectToggle(tile);
        }
      });

    scope.querySelectorAll("[data-fee-switch]").forEach((switcher) => {
      if (switcher.dataset.bound === "true") return;
      switcher.dataset.bound = "true";
      const tile = switcher.closest(".school-feature-tile");
      const buttons = switcher.querySelectorAll("[data-fee-target]");
      const panes = tile ? tile.querySelectorAll("[data-fee-pane]") : [];
      buttons.forEach((button) => {
        button.addEventListener("click", () => {
          const targetPane = button.getAttribute("data-fee-target");
          buttons.forEach((btn) =>
            btn.classList.toggle("is-active", btn === button)
          );
          panes.forEach((pane) =>
            pane.classList.toggle(
              "is-active",
              pane.getAttribute("data-fee-pane") === targetPane
            )
          );
        });
      });
    });

    scope.querySelectorAll(".school-feature-tile").forEach((tile) => {
      const title = tile.querySelector("h2")?.textContent.trim() || "";
      if (/popular subjects/i.test(title)) wireSubjectToggle(tile);
      if (/fee profile/i.test(title)) {
        wireFeeHideToggle(tile);
      }
    });

    normalizePercentages(scope);
  }

  function renderCurrentMap(attempt) {
    if (window.L) {
      renderMap(currentData, null);
      return;
    }
    if (attempt >= 40) return;
    window.setTimeout(function () {
      renderCurrentMap(attempt + 1);
    }, 100);
  }

  bindTileInteractions(document);
  renderCurrentMap(0);

  async function fetchSchool(slug) {
    if (cache.has(slug)) return cache.get(slug);
    const response = await fetch(`/${locationSlug}/schools/${slug}/`, {
      credentials: "same-origin",
    });
    if (!response.ok) throw new Error("Unable to fetch comparison school");
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const data = extractSchoolData(doc, slug);
    cache.set(slug, data);
    return data;
  }

  function setActiveLink(slug) {
    sideCompareLinks.forEach((link) => {
      const target =
        link.dataset.compareSchool ||
        new URL(link.href, window.location.origin).searchParams.get("compare");
      link.classList.toggle("is-active", target === slug);
    });
  }

  function createCompareHeader(data, label, allowClear) {
    const column = document.createElement("section");
    column.className = "school-compare-column";
    const header = document.createElement("div");
    header.className = "school-compare-column-head";
    header.innerHTML = `
      <p class="school-compare-kicker">${escapeHtml(label)}</p>
      <h2>${escapeHtml(data.name)}</h2>
      <p>${escapeHtml(data.subhead)}</p>
    `;
    const actions = document.createElement("div");
    actions.className = "school-compare-column-actions";
    actions.innerHTML = `<a href="${escapeHtml(data.path)}">Open full page</a>`;
    if (allowClear) {
      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "school-compare-clear";
      clearBtn.textContent = "Clear comparison";
      clearBtn.addEventListener("click", clearComparison);
      actions.appendChild(clearBtn);
    }
    header.appendChild(actions);
    column.appendChild(header);
    return column;
  }

  function createPairedComparison(primaryData, secondaryData) {
    const wrapper = document.createElement("div");
    wrapper.className = "school-compare-paired";
    const primaryMap = buildTileMap(primaryData);
    const secondaryMap = buildTileMap(secondaryData);
    const titles = buildTileOrder(primaryData, secondaryData);

    titles.forEach((title) => {
      const row = document.createElement("div");
      row.className = "school-compare-row";
      const primaryTile = primaryMap.has(title)
        ? tileElementFromHtml(primaryMap.get(title))
        : createPlaceholderTile(title);
      const secondaryTile = secondaryMap.has(title)
        ? tileElementFromHtml(secondaryMap.get(title))
        : createPlaceholderTile(title);
      if (primaryTile) row.appendChild(primaryTile);
      if (secondaryTile) row.appendChild(secondaryTile);
      wrapper.appendChild(row);
    });

    return wrapper;
  }

  function syncComparisonFeeSpacers(scope) {
    if (!scope) return;
    scope.querySelectorAll(".school-compare-row").forEach((row) => {
      const tiles = Array.from(row.querySelectorAll(".school-feature-tile"));
      if (tiles.length < 2) return;
      const feeTiles = tiles.filter((tile) =>
        /fee profile/i.test(tile.querySelector("h2")?.textContent || "")
      );
      if (!feeTiles.length) return;
      const hasSwitch = feeTiles.map((tile) => Boolean(tile.querySelector("[data-fee-switch]")));
      const shouldPad = hasSwitch.some(Boolean) && hasSwitch.some((value) => !value);
      feeTiles.forEach((tile) => ensureFeeSwitchSpacer(tile, shouldPad));
    });
  }


  async function applyComparison(slug) {
    if (!slug || slug === currentSlug || !main || !baseGrid) return;
    try {
      const comparisonData = await fetchSchool(slug);
      if (!compareMount) {
        compareMount = document.createElement("div");
        compareMount.className = "school-compare-columns";
        baseGrid.insertAdjacentElement("afterend", compareMount);
      }
      compareMount.innerHTML = "";
      const headerRow = document.createElement("div");
      headerRow.className = "school-compare-headers";
      headerRow.appendChild(createCompareHeader(currentData, "Current school", false));
      headerRow.appendChild(
        createCompareHeader(comparisonData, "Comparison school", true)
      );
      compareMount.appendChild(headerRow);
      compareMount.appendChild(createPairedComparison(currentData, comparisonData));
      bindTileInteractions(compareMount);
      syncComparisonFeeSpacers(compareMount);
      baseGrid.style.display = "none";
      compareMount.style.display = "block";
      body.classList.add("is-compare-mode");
      setActiveLink(slug);
      renderMap(currentData, comparisonData);

      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("compare", slug);
      window.history.replaceState({}, "", nextUrl);
    } catch (err) {
      console.error(err);
    }
  }

  function clearComparison() {
    if (baseGrid) baseGrid.style.display = "";
    if (compareMount) compareMount.style.display = "none";
    body.classList.remove("is-compare-mode");
    setActiveLink("");
    renderMap(currentData, null);
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.delete("compare");
    nextUrl.searchParams.delete("schools");
    window.history.replaceState(
      {},
      "",
      nextUrl.pathname + (nextUrl.search ? nextUrl.search : "")
    );
  }

  sideCompareLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const href = link.getAttribute("href") || "";
      const url = new URL(href, window.location.origin);
      let target = url.searchParams.get("compare");
      if (!target && url.searchParams.get("schools")) {
        const schools = url.searchParams.get("schools").split(",");
        target = schools.find((slug) => slug && slug !== currentSlug);
      }
      if (!target) return;
      event.preventDefault();
      applyComparison(target);
    });
  });

  const params = new URLSearchParams(window.location.search);
  let initialCompare = params.get("compare");
  if (!initialCompare && params.get("schools")) {
    const schools = params.get("schools").split(",");
    initialCompare = schools.find((slug) => slug && slug !== currentSlug);
  }
  if (initialCompare) applyComparison(initialCompare);
})();
