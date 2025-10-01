
class Festive {
  constructor() {
    this._registry = new Map();
    this._container = null;
    this._cleanup = null;
  }

  // ===== Theme Registry =====
  registerTheme(theme) {
    if (!theme || !theme.key) {
      throw new Error("[festive-js] theme must have a unique `key`");
    }
    this._registry.set(theme.key, theme);
  }
  unregisterTheme(key) { this._registry.delete(key); }
  clearThemes() { this._registry.clear(); }
  getRegisteredThemes() { return Array.from(this._registry.values()); }

  // ===== Trigger helpers =====
  _inRange(date, t) {
    const m = date.getMonth() + 1, d = date.getDate();
    const cur = m * 100 + d;
    const start = (Number(t.monthStart ?? 1) * 100) + Number(t.dayStart ?? 1);
    const end   = (Number(t.monthEnd   ?? 12) * 100) + Number(t.dayEnd   ?? 31);
    if (start <= end) return cur >= start && cur <= end;
    return cur >= start || cur <= end;
  }
  _matches(date, trig) {
    if (!trig || !trig.type) return false;
    if (trig.type === "always") return true;
    if (trig.type === "date") {
      const m = date.getMonth() + 1, d = date.getDate();
      return m === Number(trig.month) && d === Number(trig.day);
    }
    if (trig.type === "range") return this._inRange(date, trig);
    return false;
  }
  pickTheme(date = new Date(), options = {}) {
    if (options.forceTheme && this._registry.has(options.forceTheme)) {
      return this._registry.get(options.forceTheme);
    }
    for (const theme of this._registry.values()) {
      for (const t of (theme.triggers || [])) {
        if (this._matches(date, t)) return theme;
      }
    }
    return null;
  }

  // ===== DOM helpers =====
  _ensureContainer() {
    if (this._container) return this._container;
    const el = document.createElement("div");
    el.id = "festive-js-root";
    el.setAttribute("aria-hidden", "true");
    Object.assign(el.style, {
      position: "fixed",
      left: "0", top: "0",
      width: "100vw", height: "100vh",
      pointerEvents: "none",
      zIndex: "2147483647"
    });
    document.documentElement.appendChild(el);
    this._container = el;
    return el;
  }

  // ===== Lifecycle =====
  destroy() {
    if (this._cleanup) { try { this._cleanup(); } catch {} this._cleanup = null; }
    if (this._container) { this._container.remove(); this._container = null; }
  }
  init(options = {}) {
    this.destroy();
    const root = this._ensureContainer();
    const common = {
      primaryColor: options.primaryColor || "#0ea5e9",
      secondaryColor: options.secondaryColor || "#f43f5e",
      primaryFont: options.primaryFont || "system-ui, sans-serif",
      secondaryFont: options.secondaryFont || "serif"
    };
    const theme = this.pickTheme(new Date(), options);
    if (!theme) return { applied: false, reason: "no-theme" };
    const perTheme = (options.themes && options.themes[theme.key]) || {};
    const maybeCleanup = theme.apply(root, common, perTheme);
    if (typeof maybeCleanup === "function") this._cleanup = maybeCleanup;
    return { applied: true, theme: theme.key };
  }
}

const singleton = new Festive();
export default singleton;
export { Festive };
