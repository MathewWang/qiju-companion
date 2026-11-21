// Source UI + local runtime, with Vite HMR; no model call is made by this entry point.
process.env.COMPANION_DEV='1';
await import('../runtime/index.mjs');
