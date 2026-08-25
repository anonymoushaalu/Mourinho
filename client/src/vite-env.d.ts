/// <reference types="vite/client" />

/** Declaring each variable makes typos in `import.meta.env.*` a type error. */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_DEV_API_PROXY_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
