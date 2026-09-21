(() => {
  "use strict";
  const d = document;
  const b = d.body;
  if (!b || b.dataset.cfTier1 === "1") return;

  const clean = s => (s || "").toLowerCase().replace(/\s+/g," ").trim();
  const opaque = c => c && c !== "transparent" && c !== "rgba(0, 0, 0, 0)";

  function sampleTheme() {
    const cs = getComputedStyle(b);
    const heading = d.querySelector("h1,h2,h3");
    const hcs = heading ? getComputedStyle(heading) : cs;
    const cta = [...d.querySelectorAll('a,button,[role="button"]')].find(el => {
      const s = getComputedStyle(el);
      return opaque(s.backgroundColor) && s.backgroundColor !== cs.backgroundColor;
    });
    const ctaStyle = cta ? getComputedStyle(cta) : null;
    const footer = d.querySelector("footer,[role=contentinfo]");
    const footerStyle = footer ? getComputedStyle(footer) : null;

    if (opaque(cs.backgroundColor)) b.style.setProperty("--cf-bg", cs.backgroundColor);
    if (opaque(cs.backgroundColor)) b.style.setProperty("--cf-surface", cs.backgroundColor);
    if (opaque(cs.color)) b.style.setProperty("--cf-text", cs.color);
    if (opaque(hcs.color)) b.style.setProperty("--cf-heading", hcs.color);
    if (ctaStyle && opaque(ctaStyle.backgroundColor)) b.style.setProperty("--cf-accent", ctaStyle.backgroundColor);
    if (footerStyle && opaque(footerStyle.backgroundColor)) b.style.setProperty("--cf-dark", footerStyle.backgroundColor);
    else if (opaque(hcs.color)) b.style.setProperty("--cf-dark", hcs.color);
    if (footerStyle && opaque(footerStyle.color)) b.style.setProperty("--cf-on-dark", footerStyle.color);
  }

  sampleTheme();
  b.dataset.cfTier1 = "1";
  b.classList.add("cf-tier1");

  function header() {
    const el = d.querySelector("header,[role=banner],[class*=header i]");
    if (!el) return;
    el.classList.add("cf-site-header");
    const sync = () => el.classList.toggle("cf-scrolled", scrollY > 20);
    sync();
    addEventListener("scroll",sync,{passive:true});
  }

  function sections() {
    const main = d.querySelector("main") || b;
    let list = [...main.querySelectorAll(":scope > section")];
    if (!list.length) list = [...main.querySelectorAll("section")];
    if (!list.length) list = [...main.children].filter(el => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      return !["script","style","header","footer","nav"].includes(tag) && el.offsetHeight > 220;
    });
    return list;
  }

  function classify(s,i) {
    if (s.classList.contains("cf-section")) return;
    s.classList.add("cf-section");
    s.dataset.cfSection = String(i+1).padStart(2,"0");
    const h = s.querySelector("h1,h2,h3");
    const text = clean((h?.textContent || "") + " " + s.className);
    const map = s.querySelector('iframe[src*="map" i],iframe[src*="google" i],[class*="map" i],[id*="map" i]');

    if (i === 0) s.classList.add("cf-hero");
    if (/service|capabilit|expertise|what we do|solution/.test(text)) s.classList.add("cf-services-section");
    if (/project|case stud|portfolio|experience|track record|work/.test(text)) s.classList.add("cf-projects-section");
    if (/about|approach|overview|who we are|company|story|purpose|vision|mission/.test(text)) s.classList.add("cf-editorial-section");
    if (map || /location|presence|office|where we work|global|ksa|uae|uk/.test(text)) s.classList.add("cf-map-section");

    const direct = [...s.children].filter(el => !["SCRIPT","STYLE"].includes(el.tagName));
    if (direct.length === 1 && direct[0] instanceof HTMLElement) direct[0].classList.add("cf-section-inner");

    [...s.querySelectorAll(":scope > div,:scope > ul,:scope > ol")].forEach(container => {
      const kids = [...container.children].filter(el => el instanceof HTMLElement && el.offsetParent !== null);
      if (kids.length < 3) return;
      const likely = kids.filter(el => {
        const c = clean(el.className);
        return el.matches("article,li") || /card|item|tile|service|project|sector|capabil/.test(c);
      });
      if (likely.length >= Math.min(2,Math.ceil(kids.length*.4))) {
        container.classList.add("cf-auto-grid");
        likely.forEach(el => el.classList.add("cf-card"));
      }
    });

    [...s.querySelectorAll("img")].forEach((img,n) => {
      if (i === 0 && n === 0) {
        img.loading = "eager";
        img.fetchPriority = "high";
      } else if (!img.hasAttribute("loading")) img.loading = "lazy";
      img.decoding = "async";
    });

    if (map) {
      map.classList.add("cf-map");
      const copy = [...s.children].find(el => el !== map && !el.contains(map));
      if (copy) copy.classList.add("cf-map-copy");
    }
  }

  function footer() {
    const el = d.querySelector("footer,[role=contentinfo],[class*=footer i]");
    if (el) el.classList.add("cf-site-footer");
  }

  function motion() {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    b.classList.add("cf-motion-ready");
    const els = [...d.querySelectorAll(".cf-section h1,.cf-section h2,.cf-section h3,.cf-section p,.cf-section .cf-card,.cf-section figure,.cf-section form")];
    const io = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add("cf-inview"); io.unobserve(e.target); }
    }),{rootMargin:"0px 0px -8% 0px",threshold:.08});
    els.forEach((el,i) => {
      el.classList.add("cf-reveal");
      el.style.setProperty("--cf-delay", Math.min((i%5)*55,220) + "ms");
      io.observe(el);
    });
  }

  function init() {
    header();
    sections().forEach(classify);
    footer();
    motion();
  }

  init();

  const mo = new MutationObserver(ms => {
    if (!ms.some(m => [...m.addedNodes].some(n => n.nodeType === 1))) return;
    clearTimeout(window.__cfRefresh);
    window.__cfRefresh = setTimeout(() => {
      sampleTheme();
      sections().forEach(classify);
      footer();
    },180);
  });
  mo.observe(d.documentElement,{childList:true,subtree:true});
})();