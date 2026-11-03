/// <reference types="vite/client" />

// Vite exposes only VITE_ variables here; server secrets stay on the backend.
export const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '');
