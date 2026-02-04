import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite"
import path from "path"
import { tanstackRouter } from '@tanstack/router-plugin/vite'

const persistState = process.env.CF_PERSIST_STATE
  ? { path: process.env.CF_PERSIST_STATE }
  : true

export default defineConfig({
  plugins: [tanstackRouter({
    target: 'react',
    autoCodeSplitting: true,
    routesDirectory: 'src/react-app/routes',
    generatedRouteTree: 'src/react-app/routeTree.gen.ts',
  }), react(), cloudflare({ persistState }), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
