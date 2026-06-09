/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WORKER_URL:          string;
  readonly VITE_CF_CLIENT_ID:        string;
  readonly VITE_CF_CLIENT_SECRET:    string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}