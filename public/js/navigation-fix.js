(() => {
  const NOISY_HASHES = new Set(["#hero"]);

  const isModifiedClick = (event) =>
    Boolean(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

  const getAnchorFromEvent = (event) => {
    if (!(event.target instanceof Element)) {
      return null;
    }

    return event.target.closest("a[href]");
  };

  const resolveTargetUrl = (anchor, event) => {
    const href = anchor.getAttribute("href");
    if (!href) {
      return null;
    }

    const hrefLower = href.toLowerCase();
    if (
      hrefLower.startsWith("#") ||
      hrefLower.startsWith("mailto:") ||
      hrefLower.startsWith("tel:") ||
      hrefLower.startsWith("javascript:")
    ) {
      return null;
    }

    if (anchor.hasAttribute("download")) {
      return null;
    }

    const target = (anchor.getAttribute("target") || "").toLowerCase();
    if (target && target !== "_self") {
      return null;
    }

    if ("button" in event && event.button !== 0) {
      return null;
    }

    if (isModifiedClick(event)) {
      return null;
    }

    let url;
    try {
      url = new URL(href, window.location.href);
    } catch {
      return null;
    }

    if (url.origin !== window.location.origin) {
      return null;
    }

    if (NOISY_HASHES.has(url.hash.toLowerCase())) {
      url.hash = "";
    }

    url.pathname = url.pathname.replace(/\/index\.html$/i, "/");

    const next = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;

    if (next === current) {
      return null;
    }

    return next;
  };

  const navigateNative = (event) => {
    const anchor = getAnchorFromEvent(event);
    if (!anchor) {
      return;
    }

    const next = resolveTargetUrl(anchor, event);
    if (!next) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (navigateNative.__locked) {
      return;
    }

    navigateNative.__locked = true;
    window.location.assign(next);
  };

  const cleanupNoisyHash = () => {
    if (!NOISY_HASHES.has(window.location.hash.toLowerCase())) {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", cleanUrl);
  };

  document.addEventListener("pointerup", navigateNative, true);
  document.addEventListener("click", navigateNative, true);

  document.addEventListener(
    "keydown",
    (event) => {
      if (event.key !== "Enter") {
        return;
      }
      navigateNative(event);
    },
    true
  );

  cleanupNoisyHash();
  window.addEventListener("hashchange", cleanupNoisyHash);
})();
