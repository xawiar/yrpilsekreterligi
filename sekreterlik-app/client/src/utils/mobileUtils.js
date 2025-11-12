/**
 * Mobil cihaz tespiti ve yardımcı fonksiyonlar
 */

export const isMobile = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024; // lg breakpoint
};

export const isTablet = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 640 && window.innerWidth < 1024;
};

export const isDesktop = () => {
  if (typeof window === 'undefined') return false;
  return window.innerWidth >= 1024;
};

/**
 * Touch event'leri için minimum swipe distance
 */
export const MIN_SWIPE_DISTANCE = 50;

/**
 * Mobil için optimize edilmiş spacing
 */
export const MOBILE_SPACING = {
  xs: '0.5rem',   // 8px
  sm: '0.75rem',  // 12px
  md: '1rem',     // 16px
  lg: '1.5rem',   // 24px
  xl: '2rem',     // 32px
};

/**
 * Mobil için minimum touch target size (Apple HIG)
 */
export const MIN_TOUCH_TARGET = 44; // pixels

/**
 * Mobil için font size'lar
 */
export const MOBILE_TYPOGRAPHY = {
  xs: 'text-xs',    // 12px
  sm: 'text-sm',    // 14px
  base: 'text-base', // 16px
  lg: 'text-lg',    // 18px
  xl: 'text-xl',    // 20px
  '2xl': 'text-2xl', // 24px
};

