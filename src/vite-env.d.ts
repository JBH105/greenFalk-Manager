/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_API: "http://localhost:5432/api/";
  // Add more env variables as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

