import { defineConfig } from "vite";

// base = "/bolsapolis/" en produccion porque GitHub Pages sirve el proyecto
// bajo https://<usuario>.github.io/bolsapolis/ (no en la raiz del dominio).
// En desarrollo (npm run dev) se mantiene "/" para que funcione en localhost.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/bolsapolis/" : "/",
  server: { port: 5173, open: false },
  build: { target: "es2020", sourcemap: true },
}));
