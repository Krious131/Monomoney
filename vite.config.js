import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose on the local network (e.g. http://192.168.x.x:5173)
    port: 5173,
  },
});
