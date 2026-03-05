(() => {
  const NOISY_HASHES = new Set(["#hero"]);
  const NAV_LAYER_Z_INDEX = "2147483000";
  let layerFixScheduled = false;

  const isModifiedClick = (event) =>
    Boolean(event.metaKey || event.ctrlKey || event.shiftKey || event.altKey);

  const getPointerCoordinates = (event) => {
    if (typeof event.clientX === "number" && typeof event.clientY === "number") {
      return { x: event.clientX, y: event.clientY };
    }

    if (event.changedTouches && event.changedTouches.length > 0) {
      return {
        x: event.changedTouches[0].clientX,
        y: event.changedTouches[0].clientY
      };
    }

    return null;
  };

  const pickAnchorByPoint = (event) => {
    const point = getPointerCoordinates(event);
    if (!point) {
      return null;
    }

    const candidates = Array.from(document.querySelectorAll("nav a[href]")).filter((anchor) => {
      if (!(anchor instanceof HTMLElement)) {
        return false;
      }

      const rect = anchor.getBoundingClientRect();
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        point.x >= rect.left &&
        point.x <= rect.right &&
        point.y >= rect.top &&
        point.y <= rect.bottom
      );
    });

    if (candidates.length === 0) {
      return null;
    }

    candidates.sort((a, b) => {
      const aRect = a.getBoundingClientRect();
      const bRect = b.getBoundingClientRect();
      return aRect.width * aRect.height - bRect.width * bRect.height;
    });

    return candidates[0];
  };

  const getAnchorFromEvent = (event) => {
    if (event.target instanceof Element) {
      const nativeAnchor = event.target.closest("a[href]");
      if (nativeAnchor) {
        return nativeAnchor;
      }
    }

    return pickAnchorByPoint(event);
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

    const rawHref = anchor.getAttribute("href") || "";
    const isMailOrTel = /^(mailto:|tel:)/i.test(rawHref.trim());
    const next = resolveTargetUrl(anchor, event);

    if (!next && !isMailOrTel) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (navigateNative.__locked) {
      return;
    }

    navigateNative.__locked = true;

    if (isMailOrTel) {
      window.location.href = rawHref;
      return;
    }

    window.location.assign(next);
  };

  const cleanupNoisyHash = () => {
    if (!NOISY_HASHES.has(window.location.hash.toLowerCase())) {
      return;
    }

    const cleanUrl = `${window.location.pathname}${window.location.search}`;
    window.history.replaceState(null, "", cleanUrl);
  };

  const makeMobileNavClickable = () => {
    document
      .querySelectorAll('[data-framer-name="Overlay"], .framer-ayl197')
      .forEach((overlay) => {
        if (!(overlay instanceof HTMLElement)) {
          return;
        }
        overlay.style.pointerEvents = "none";
      });

    document.querySelectorAll("nav").forEach((nav) => {
      if (!(nav instanceof HTMLElement)) {
        return;
      }

      nav.style.zIndex = NAV_LAYER_Z_INDEX;
      nav.style.pointerEvents = "auto";

      let parent = nav.parentElement;
      let hops = 0;

      while (parent && hops < 3) {
        if (parent instanceof HTMLElement) {
          const computedPosition = window.getComputedStyle(parent).position;
          if (computedPosition !== "static") {
            parent.style.zIndex = NAV_LAYER_Z_INDEX;
          }
          parent.style.pointerEvents = "auto";
        }
        parent = parent.parentElement;
        hops += 1;
      }
    });
  };

  const scheduleLayerFix = () => {
    if (layerFixScheduled) {
      return;
    }

    layerFixScheduled = true;
    window.requestAnimationFrame(() => {
      layerFixScheduled = false;
      makeMobileNavClickable();
    });
  };

  document.addEventListener("pointerup", navigateNative, true);
  document.addEventListener("click", navigateNative, true);
  document.addEventListener("pointerdown", scheduleLayerFix, true);
  document.addEventListener("click", scheduleLayerFix, true);

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
  scheduleLayerFix();
  window.addEventListener("hashchange", cleanupNoisyHash);
  window.addEventListener("resize", scheduleLayerFix);
  window.addEventListener("load", scheduleLayerFix);

  const observer = new MutationObserver(scheduleLayerFix);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });
})();
