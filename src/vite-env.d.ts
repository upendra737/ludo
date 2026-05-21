/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Absolute backend URL baked in at build time for embedded deploys (e.g. itch.io iframe). */
  readonly VITE_SOCKET_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
