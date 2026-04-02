export const setBadgeCount = async (count) => {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) {
        await navigator.setAppBadge(count);
      } else {
        await navigator.clearAppBadge();
      }
    }
  } catch (e) {
    // Badge API not supported
  }
};

export const clearBadge = async () => {
  try {
    if ('clearAppBadge' in navigator) {
      await navigator.clearAppBadge();
    }
  } catch (e) {
    // Badge API not supported
  }
};
