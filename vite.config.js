import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";

const colorsCss = fs.readFileSync(path.resolve(__dirname, "./src/colors.css"), "utf-8");
const getManifestColor = (varName) => {
  const match = colorsCss.match(new RegExp(`${varName}:\\s*(#[0-9a-fA-F]+)`));
  return match ? match[1] : "#ffffff";
};

export default defineConfig({
  server: {
    host: true,
    allowedHosts: ['pos.surtiswaad.in'],
  },

  preview: {
    host: true,
    allowedHosts: ['pos.surtiswaad.in'],
  },
  plugins: [
    react(),
    tailwindcss(),

    VitePWA({
      registerType: "autoUpdate",

      // Service worker is disabled in dev. With it on, a stale precached
      // bundle keeps being served after a code change and the app renders
      // a blank page. Production builds still ship the full PWA.
      devOptions: {
        enabled: false,
        type: "module",
      },

      // Only files that exist. favicon.ico and robots.txt were listed here and
      // are not in public/, so they were quietly skipped.
      includeAssets: ["favicon.png", "apple-touch-icon.png"],

      manifest: {
        name: "GreenFalk POS",
        short_name: "GreenFalk",
        description: "Surti Swaad restaurant POS — take orders, send them to the kitchen and settle bills",
        // The bar at the top of the installed app takes the brand colour; the
        // splash behind the icon stays white, like the app itself. These used
        // to be both white while index.html said purple, so the two disagreed.
        theme_color: getManifestColor('--theme-primary'),
        background_color: getManifestColor('--color-white'),
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          // Android cuts every launcher icon to the shape its skin uses. With
          // no maskable icon to cut, it drops the icon inside a white square
          // instead, which is why the app looked unlike every other one on the
          // home screen.
          {
            src: "/icons/pwa-maskable-192x192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icons/pwa-maskable-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        navigateFallback: "index.html",

        clientsClaim: true,
        skipWaiting: true,

        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\/api\/.*$/,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },

          {
            urlPattern: ({ request }) => request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "image-cache",
              expiration: {
                maxEntries: 50,
              },
            },
          },

          {
            urlPattern: ({ request }) =>
              request.destination === "script" ||
              request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "static-resources",
            },
          },
        ],
      },
    }),
  ],
});
