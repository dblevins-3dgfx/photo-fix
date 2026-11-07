/// <reference types="vite/client" />

// Set by the Pages workflow for a pull request's preview build only
interface ImportMetaEnv {
  readonly VITE_PREVIEW?: string;
  readonly VITE_PREVIEW_URL?: string;
}
