import { useEffect, useRef, useState } from 'react';
import { isMobile } from '../utils/capacitorUtils';

/**
 * Pull-to-refresh hook for mobile devices
 * Mobil cihazlar için aşağı çekerek yenileme hook'u
 */
export const usePullToRefresh = (onRefresh, options = {}) => {
  const { threshold = 80, disabled = false } = options;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const elementRef = useRef(null);
  const isPulling = useRef(false);
  const touchStartY = useRef(0);
  const touchCurrentY = useRef(0);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isMobile() || disabled) {
      return;
    }

    // Use window or document body if no element ref is provided
    const element = elementRef.current || window;

    const handleTouchStart = (e) => {
      // Only trigger if we're at the top of the scrollable area
      const scrollTop = element === window ? window.scrollY : element.scrollTop;
      if (scrollTop <= 0) {
        touchStartY.current = e.touches[0].clientY;
        isDragging.current = true;
      }
    };

    const handleTouchMove = (e) => {
      if (!isDragging.current) return;

      touchCurrentY.current = e.touches[0].clientY;
      const distance = touchCurrentY.current - touchStartY.current;

      // Only allow pulling down (positive distance)
      const scrollTop = element === window ? window.scrollY : element.scrollTop;
      if (distance > 0 && scrollTop <= 0) {
        // Only preventDefault if event is cancelable
        if (e.cancelable) {
          e.preventDefault();
        }
        const pullDistance = Math.min(distance * 0.5, threshold * 1.5); // Damping factor
        setPullDistance(pullDistance);
        isPulling.current = true;
      } else if (distance <= 0) {
        setPullDistance(0);
        isPulling.current = false;
      }
    };

    const handleTouchEnd = async () => {
      if (!isDragging.current) return;

      isDragging.current = false;

      if (isPulling.current && pullDistance >= threshold && onRefresh) {
        setIsRefreshing(true);
        setPullDistance(0);
        isPulling.current = false;

        try {
          await onRefresh();
        } catch (error) {
          console.error('Pull-to-refresh error:', error);
        } finally {
          setIsRefreshing(false);
        }
      } else {
        // Reset if not pulled enough
        setPullDistance(0);
        isPulling.current = false;
      }
    };

    element.addEventListener('touchstart', handleTouchStart, { passive: false });
    element.addEventListener('touchmove', handleTouchMove, { passive: false });
    element.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      element.removeEventListener('touchstart', handleTouchStart);
      element.removeEventListener('touchmove', handleTouchMove);
      element.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onRefresh, threshold, disabled]);

  return {
    elementRef,
    isRefreshing,
    pullDistance,
    pullProgress: Math.min(pullDistance / threshold, 1),
  };
};

