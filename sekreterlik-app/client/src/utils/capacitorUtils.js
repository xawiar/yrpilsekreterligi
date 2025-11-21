/**
 * Capacitor Utility Functions
 * Native platform detection and helpers
 */

import { Capacitor } from '@capacitor/core';

/**
 * Check if running on native platform (iOS/Android)
 * @returns {boolean}
 */
export const isNative = () => {
  return Capacitor.isNativePlatform();
};

/**
 * Get current platform
 * @returns {'ios' | 'android' | 'web'}
 */
export const getPlatform = () => {
  return Capacitor.getPlatform();
};

/**
 * Check if running on iOS
 * @returns {boolean}
 */
export const isIOS = () => {
  return getPlatform() === 'ios';
};

/**
 * Check if running on Android
 * @returns {boolean}
 */
export const isAndroid = () => {
  return getPlatform() === 'android';
};

/**
 * Check if running on web
 * @returns {boolean}
 */
export const isWeb = () => {
  return getPlatform() === 'web';
};

/**
 * Check if device is mobile (native or mobile browser)
 * @returns {boolean}
 */
export const isMobile = () => {
  if (isNative()) {
    return true;
  }
  if (typeof window === 'undefined') return false;
  return window.innerWidth < 1024; // lg breakpoint
};

/**
 * Get device info
 * @returns {object}
 */
export const getDeviceInfo = () => {
  return {
    platform: getPlatform(),
    isNative: isNative(),
    isIOS: isIOS(),
    isAndroid: isAndroid(),
    isWeb: isWeb(),
    isMobile: isMobile(),
  };
};

