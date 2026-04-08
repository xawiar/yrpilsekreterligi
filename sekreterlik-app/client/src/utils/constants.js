// Centralized Firebase usage flag - import this instead of inline checking
export const USE_FIREBASE =
  import.meta.env.VITE_USE_FIREBASE === 'true' ||
  import.meta.env.VITE_USE_FIREBASE === true ||
  String(import.meta.env.VITE_USE_FIREBASE || '').toLowerCase() === 'true';

export const BREAKPOINTS = {
  MOBILE: 768,
  TABLET: 1024,
  DESKTOP: 1280,
};

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 25,
  MAX_PAGE_SIZE: 100,
};
