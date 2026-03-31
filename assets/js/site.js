// sitewide interactions intentionally minimal

(function () {
  const body = document.body;
  if (!body) return;

  function isSchoolProfilePage() {
    return body.classList.contains("school-profile-page");
  }

  function getSchoolSlug() {
    return body.dataset.schoolSlug || "";
  }

  function getLocationSlug() {
    return body.dataset.locationSlug || "";
  }

  function isExternalHttpLink(anchor) {
    if (!anchor || !anchor.href) return false;

    try {
      const url = new URL(anchor.href, window.location.origin);
      if (!/^https?:$/i.test(url.protocol)) return false;
      return url.origin !== window.location.origin;
    } catch (err) {
      return false;
    }
  }

  function sendGaEvent(anchor) {
    if (typeof window.gtag !== "function") return;

    const schoolSlug = getSchoolSlug();
    const locationSlug = getLocationSlug();
    const linkText = (anchor.textContent || "").trim();

    let destinationHost = "";
    let linkUrl = "";

    try {
      const url = new URL(anchor.href, window.location.origin);
      destinationHost = url.hostname;
      linkUrl = url.toString();
    } catch (err) {
      return;
    }

    window.gtag("event", "school_outbound_click", {
      school_slug: schoolSlug,
      location_slug: locationSlug,
      destination_host: destinationHost,
      link_url: linkUrl,
      link_text: linkText
    });
  }

  document.addEventListener("click", function (event) {
    if (!isSchoolProfilePage()) return;

    const anchor = event.target.closest("a");
    if (!anchor) return;
    if (!isExternalHttpLink(anchor)) return;

    sendGaEvent(anchor);
  });
})();
