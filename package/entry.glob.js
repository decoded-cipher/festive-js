
import Festive from "./index.js";

const modules = import.meta.glob("./themes/**/index.js", { eager: true });
for (const path in modules) {
  const mod = modules[path];
  const theme = mod?.default;
  if (theme?.key) Festive.registerTheme(theme);
}

export default Festive;
