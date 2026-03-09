import { useCallback, useMemo, useRef, useEffect, useState } from 'react';

/**
 * Performance optimization hooks for React components
 */

/**
 * Debounce hook to limit how often a function can fire
 */
export function useDebounce<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<NodeJS.Timeout>();

  const debouncedCallback = useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return debouncedCallback as T;
}

/**
 * Throttle hook to limit how often a function can fire (max once per interval)
 */
export function useThrottle<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const lastRun = useRef<number>(Date.now());
  
  const throttledCallback = useCallback((...args: Parameters<T>) => {
    if (Date.now() - lastRun.current >= delay) {
      callback(...args);
      lastRun.current = Date.now();
    }
  }, [callback, delay]);

  return throttledCallback as T;
}

/**
 * Stable callback hook that prevents unnecessary re-renders
 */
export function useStableCallback<T extends (...args: any[]) => any>(
  callback: T
): T {
  const callbackRef = useRef(callback);
  
  // Update the ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Return a stable callback that calls the latest version
  const stableCallback = useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []);

  return stableCallback as T;
}

/**
 * Memoize expensive calculations
 */
export function useExpensiveCalculation<T>(
  calculationFn: () => T,
  dependencies: React.DependencyList
): T {
  return useMemo(calculationFn, dependencies);
}

/**
 * Performance monitoring hook
 */
export function usePerformanceMonitor(componentName: string) {
  const renderCount = useRef(0);
  const renderStartTime = useRef<number>();

  useEffect(() => {
    renderCount.current++;
    renderStartTime.current = performance.now();

    return () => {
      if (renderStartTime.current) {
        const renderTime = performance.now() - renderStartTime.current;
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[Performance] ${componentName} render #${renderCount.current} took ${renderTime.toFixed(2)}ms`);
        }
      }
    };
  });

  return {
    renderCount: renderCount.current,
    logRenderInfo: () => {
      console.log(`[Performance] ${componentName} has rendered ${renderCount.current} times`);
    }
  };
}

/**
 * Intersection Observer hook for lazy loading
 */
export function useIntersectionObserver(
  elementRef: React.RefObject<Element>,
  options: IntersectionObserverInit = {}
) {
  const [isIntersecting, setIsIntersecting] = useState<boolean>(false);
  const [hasIntersected, setHasIntersected] = useState<boolean>(false);

  // BUG-029 fix: Memoize options to prevent observer re-creation on every render
  const { threshold, root, rootMargin } = options;
  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      const isIntersectingNow = entry.isIntersecting;
      setIsIntersecting(isIntersectingNow);
      
      if (isIntersectingNow) {
        setHasIntersected(true);
      }
    }, { threshold, root, rootMargin });

    observer.observe(element);

    return () => {
      observer.unobserve(element);
      observer.disconnect();
    };
  }, [elementRef, threshold, root, rootMargin]);

  return { isIntersecting, hasIntersected };
}

/**
 * Image preloader hook
 */
export function useImagePreloader(imageUrls: string[]) {
  const [loadedImages, setLoadedImages] = useState<Set<string>>(new Set());
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadImage = (url: string): Promise<void> => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          setLoadedImages(prev => new Set(prev).add(url));
          resolve();
        };
        img.onerror = () => {
          setFailedImages(prev => new Set(prev).add(url));
          resolve();
        };
        img.src = url;
      });
    };

    const preloadImages = async () => {
      const promises = imageUrls.map(loadImage);
      await Promise.all(promises);
    };

    if (imageUrls.length > 0) {
      preloadImages();
    }
  }, [imageUrls]);

  return {
    loadedImages,
    failedImages,
    allLoaded: loadedImages.size + failedImages.size === imageUrls.length,
    loadedCount: loadedImages.size,
    failedCount: failedImages.size
  };
}