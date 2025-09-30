
class Festive {
  constructor() {
    this._loadedThemes = new Map();
    this._themeCache = new Map();
    this._container = null;
    this._cleanup = null;
    this._baseUrl = this._detectBaseUrl();
    this._manifest = null;
    this._manifestPromise = null;
  }

  // ===== URL Detection =====
  _detectBaseUrl() {
    // return 'https://cdn.jsdelivr.net/npm/festive-js@latest/dist';
    return "http://localhost:5173/dist"
  }

  // ===== Manifest Loading =====
  async _loadManifest() {
    if (this._manifest) return this._manifest;
    if (this._manifestPromise) return this._manifestPromise;

    this._manifestPromise = (async () => {
      try {
        const manifestUrl = `${this._baseUrl}/themes.manifest.json`;
        const response = await fetch(manifestUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch manifest: ${response.status}`);
        }
        
        this._manifest = await response.json();
        
        // Update theme URLs with the CDN base URL
        const baseUrl = `${this._baseUrl}/themes`;
        this._manifest.themes.forEach(theme => {
          if (!theme.url.startsWith('http')) {
            theme.fullUrl = `${baseUrl}/${theme.url}`;
          } else {
            theme.fullUrl = theme.url;
          }
        });
        
        return this._manifest;
      } catch (error) {
        console.warn('[festive-js] Failed to load theme manifest:', error);
        // Fallback to empty manifest - no themes available
        this._manifest = {
          version: "1.0.0",
          themes: []
        };
        return this._manifest;
      }
    })();

    return this._manifestPromise;
  }

  // ===== Theme Loading =====
  async _loadTheme(themeMetadata) {
    // Check cache first
    if (this._themeCache.has(themeMetadata.key)) {
      return this._themeCache.get(themeMetadata.key);
    }

    try {
      const response = await fetch(themeMetadata.fullUrl || themeMetadata.url);
      if (!response.ok) {
        throw new Error(`Failed to fetch theme: ${response.status}`);
      }
      
      const themeCode = await response.text();
      
      // Create a function from the theme code and execute it
      const themeFunction = new Function('return ' + themeCode.replace(/^export\s+default\s+/, ''));
      const theme = themeFunction();
      
      // Cache the loaded theme
      this._themeCache.set(themeMetadata.key, theme);
      this._loadedThemes.set(themeMetadata.key, theme);
      
      return theme;
    } catch (error) {
      console.warn(`[festive-js] Failed to load theme '${themeMetadata.key}':`, error);
      return null;
    }
  }

  // ===== Theme Registry =====
  registerTheme(theme) {
    if (!theme || !theme.key) {
      throw new Error("[festive-js] theme must have a unique `key`");
    }
    this._loadedThemes.set(theme.key, theme);
  }
  
  unregisterTheme(key) { 
    this._loadedThemes.delete(key);
    this._themeCache.delete(key);
  }
  
  clearThemes() { 
    this._loadedThemes.clear();
    this._themeCache.clear();
  }
  
  getRegisteredThemes() { 
    return Array.from(this._loadedThemes.values()); 
  }

  // Get available themes from manifest (without loading them)
  async getAvailableThemes() {
    const manifest = await this._loadManifest();
    return manifest.themes.map(theme => ({
      key: theme.key,
      name: theme.name,
      description: theme.description,
      triggers: theme.triggers,
      size: theme.size,
      version: theme.version
    }));
  }

  // Allow setting custom base URL for themes
  setBaseUrl(url) {
    this._baseUrl = url.replace(/\/$/, ''); // Remove trailing slash
    // Clear manifest cache to reload with new URL
    this._manifest = null;
    this._manifestPromise = null;
  }

  // Allow setting custom manifest directly (for offline usage or custom themes)
  setManifest(manifest) {
    this._manifest = manifest;
    this._manifestPromise = Promise.resolve(manifest);
    
    // Update theme URLs if needed
    const baseUrl = `${this._baseUrl}/themes`;
    this._manifest.themes.forEach(theme => {
      if (!theme.url.startsWith('http')) {
        theme.fullUrl = `${baseUrl}/${theme.url}`;
      } else {
        theme.fullUrl = theme.url;
      }
    });
  }

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
  
  async _findAndLoadTheme(date = new Date(), options = {}) {
    // Load manifest first
    const manifest = await this._loadManifest();
    
    // Check for forced theme first
    if (options.forceTheme) {
      // Try loaded themes first
      if (this._loadedThemes.has(options.forceTheme)) {
        return this._loadedThemes.get(options.forceTheme);
      }
      
      // Try to load from manifest
      const themeMetadata = manifest.themes.find(t => t.key === options.forceTheme);
      if (themeMetadata) {
        return await this._loadTheme(themeMetadata);
      }
    }

    // Check loaded themes first for matching date
    for (const theme of this._loadedThemes.values()) {
      for (const t of (theme.triggers || [])) {
        if (this._matches(date, t)) return theme;
      }
    }

    // Check manifest themes and load matching theme
    for (const themeMetadata of manifest.themes) {
      for (const t of (themeMetadata.triggers || [])) {
        if (this._matches(date, t)) {
          return await this._loadTheme(themeMetadata);
        }
      }
    }

    return null;
  }

  // Legacy method for backward compatibility
  pickTheme(date = new Date(), options = {}) {
    // For synchronous backward compatibility, only check loaded themes
    if (options.forceTheme && this._loadedThemes.has(options.forceTheme)) {
      return this._loadedThemes.get(options.forceTheme);
    }
    
    for (const theme of this._loadedThemes.values()) {
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
  
  async init(options = {}) {
    this.destroy();
    const root = this._ensureContainer();
    const common = {
      primaryColor: options.primaryColor || "#0ea5e9",
      secondaryColor: options.secondaryColor || "#f43f5e",
      primaryFont: options.primaryFont || "system-ui, sans-serif",
      secondaryFont: options.secondaryFont || "serif"
    };
    
    try {
      const theme = await this._findAndLoadTheme(new Date(), options);
      if (!theme) return { applied: false, reason: "no-theme" };
      
      const perTheme = (options.themes && options.themes[theme.key]) || {};
      const maybeCleanup = theme.apply(root, common, perTheme);
      if (typeof maybeCleanup === "function") this._cleanup = maybeCleanup;
      
      return { applied: true, theme: theme.key };
    } catch (error) {
      console.warn("[festive-js] Failed to load and apply theme:", error);
      return { applied: false, reason: "load-error", error: error.message };
    }
  }
}

const singleton = new Festive();
export default singleton;
export { Festive };
