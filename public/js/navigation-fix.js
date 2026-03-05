(() => {
  const NOISY_HASHES = new Set(["#hero"]);
  const BLOCKED_TARGET = "__blocked__";
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

  const isNoisyHash = (hashValue) => {
    const hash = (hashValue || "").toLowerCase();
    return NOISY_HASHES.has(hash) || hash.startsWith("#:");
  };

  const normalizePathname = (pathname) => {
    if (typeof pathname !== "string" || pathname.length === 0) {
      return pathname;
    }

    return pathname
      .replace(/\/work\/work(?=\/|$)/gi, "/work")
      .replace(/\/index\.html$/i, "/");
  };

  const isBlockedPathname = (pathname) => /\/work\/matching(?:\/|$)/i.test(pathname);
  const ROOT_ROUTE_SEGMENTS = new Set(["work", "contact", "about", "designsystem"]);

  const isBlockedProjectHref = (hrefValue) => {
    const href = (hrefValue || "").trim().toLowerCase();
    if (!href) {
      return false;
    }
    if (href.startsWith("javascript:")) {
      return true;
    }
    return /(^|\/)work\/matching(?:\/|$)/i.test(href);
  };

  const isBlockedProjectAnchor = (anchor) => {
    if (!(anchor instanceof HTMLAnchorElement)) {
      return false;
    }
    const labelText = (anchor.textContent || "").toLowerCase();
    const hasBlockedLabel =
      labelText.includes("psychologist matching flow") || labelText.includes("coming soon");

    return (
      anchor.getAttribute("data-coming-soon") === "true" ||
      isBlockedProjectHref(anchor.getAttribute("href")) ||
      hasBlockedLabel
    );
  };

  const inferSitePrefix = () => {
    const knownRoots = new Set(["work", "contact", "about", "designsystem", "public", "framer"]);
    const segments = window.location.pathname.split("/").filter(Boolean);
    if (segments.length === 0 || knownRoots.has(segments[0].toLowerCase())) {
      return "";
    }
    return `/${segments[0]}`;
  };

  const getWorkListingPath = () => {
    const prefix = inferSitePrefix();
    return `${prefix}/work/`;
  };

  const getForcedRootRoutePath = (hrefValue) => {
    const rawHref = (hrefValue || "").trim();
    if (!rawHref) {
      return null;
    }

    const hashIndex = rawHref.indexOf("#");
    const queryIndex = rawHref.indexOf("?");
    const cutIndex =
      hashIndex === -1
        ? queryIndex
        : queryIndex === -1
          ? hashIndex
          : Math.min(hashIndex, queryIndex);

    const pathOnly = (cutIndex === -1 ? rawHref : rawHref.slice(0, cutIndex)).toLowerCase();
    if (!pathOnly) {
      return null;
    }

    const cleaned = pathOnly
      .replace(/^(\.\/)+/, "")
      .replace(/^(\.\.\/)+/, "")
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

    if (!ROOT_ROUTE_SEGMENTS.has(cleaned)) {
      return null;
    }

    const prefix = inferSitePrefix();
    return `${prefix}/${cleaned}/`;
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
      const forcedRootRoute = getForcedRootRoutePath(href);
      if (forcedRootRoute) {
        url = new URL(forcedRootRoute, window.location.origin);
      } else {
        url = new URL(href, window.location.href);
      }
    } catch {
      return null;
    }

    if (url.origin !== window.location.origin) {
      return null;
    }

    if (isNoisyHash(url.hash)) {
      url.hash = "";
    }

    url.pathname = normalizePathname(url.pathname);

    if (isBlockedPathname(url.pathname)) {
      return BLOCKED_TARGET;
    }

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

    if (isBlockedProjectAnchor(anchor)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const rawHref = anchor.getAttribute("href") || "";
    const isMailOrTel = /^(mailto:|tel:)/i.test(rawHref.trim());
    const next = resolveTargetUrl(anchor, event);
    const isBlockedNavigation = next === BLOCKED_TARGET;

    if (!next && !isMailOrTel && !isBlockedNavigation) {
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

    if (isBlockedNavigation) {
      window.location.assign(getWorkListingPath());
      return;
    }

    window.location.assign(next);
  };

  const cleanupNoisyHash = () => {
    const normalizedPathname = normalizePathname(window.location.pathname);
    const hasPathMismatch = normalizedPathname !== window.location.pathname;
    const noisyHash = isNoisyHash(window.location.hash);
    const blockedPath = isBlockedPathname(normalizedPathname);

    if (!hasPathMismatch && !noisyHash && !blockedPath) {
      return;
    }

    if (blockedPath) {
      window.location.replace(getWorkListingPath());
      return;
    }

    const cleanUrl = `${normalizedPathname}${window.location.search}`;
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

  const hardDisableBlockedProjectLinks = () => {
    document.querySelectorAll("a[href], a[data-coming-soon='true']").forEach((anchor) => {
      if (!(anchor instanceof HTMLAnchorElement) || !isBlockedProjectAnchor(anchor)) {
        return;
      }

      anchor.setAttribute("data-coming-soon", "true");
      anchor.setAttribute("aria-disabled", "true");
      anchor.setAttribute("href", "javascript:void(0)");
      anchor.style.pointerEvents = "none";
      anchor.style.cursor = "default";
      anchor.style.userSelect = "none";
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");

      const cardRoot = anchor.closest("[class*='framer-']");
      if (cardRoot instanceof HTMLElement) {
        cardRoot.style.pointerEvents = "none";
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
      hardDisableBlockedProjectLinks();
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
