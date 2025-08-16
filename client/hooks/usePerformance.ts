import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { debounce, throttle } from "lodash";

// Intersection Observer hook for lazy loading
export function useIntersectionObserver(
  options: IntersectionObserverInit = {},
) {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasIntersected, setHasIntersected] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
      if (entry.isIntersecting && !hasIntersected) {
        setHasIntersected(true);
      }
    }, options);

    observer.observe(element);

    return () => {
      observer.unobserve(element);
    };
  }, [options, hasIntersected]);

  return { elementRef, isIntersecting, hasIntersected };
}

// Debounced value hook
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Throttled callback hook
export function useThrottle<T extends Function>(
  callback: T,
  delay: number,
): T {
  const throttledCallback = useMemo(
    () => throttle(callback, delay),
    [callback, delay],
  );

  useEffect(() => {
    return () => {
      throttledCallback.cancel();
    };
  }, [throttledCallback]);

  return throttledCallback;
}

// Virtual scrolling hook for large lists
export function useVirtualScrolling({
  itemHeight,
  containerHeight,
  itemCount,
  overscan = 3,
}: {
  itemHeight: number;
  containerHeight: number;
  itemCount: number;
  overscan?: number;
}) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleStart = Math.floor(scrollTop / itemHeight);
  const visibleEnd = Math.min(
    visibleStart + Math.ceil(containerHeight / itemHeight),
    itemCount - 1,
  );

  const startIndex = Math.max(0, visibleStart - overscan);
  const endIndex = Math.min(itemCount - 1, visibleEnd + overscan);

  const offsetY = startIndex * itemHeight;
  const totalHeight = itemCount * itemHeight;

  const handleScroll = useThrottle((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, 16); // ~60fps

  return {
    startIndex,
    endIndex,
    offsetY,
    totalHeight,
    handleScroll,
    visibleItems: endIndex - startIndex + 1,
  };
}

// Memory optimization for large datasets
export function useMemoizedData<T>(
  data: T[],
  keyExtractor: (item: T) => string,
) {
  const memoizedData = useMemo(() => {
    const map = new Map();
    data.forEach((item) => {
      map.set(keyExtractor(item), item);
    });
    return map;
  }, [data, keyExtractor]);

  const getItem = useCallback(
    (key: string) => memoizedData.get(key),
    [memoizedData],
  );

  return { memoizedData, getItem };
}

// Image lazy loading hook
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState<string | undefined>(placeholder);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isError, setIsError] = useState(false);
  const { elementRef, hasIntersected } = useIntersectionObserver({
    threshold: 0.1,
  });

  useEffect(() => {
    if (!hasIntersected || !src) return;

    const img = new Image();
    img.onload = () => {
      setImageSrc(src);
      setIsLoaded(true);
    };
    img.onerror = () => {
      setIsError(true);
    };
    img.src = src;

    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [hasIntersected, src]);

  return {
    elementRef,
    imageSrc,
    isLoaded,
    isError,
  };
}

// Performance monitoring hook
export function usePerformanceMonitor(componentName: string) {
  const renderStartTime = useRef<number>(0);
  const mountStartTime = useRef<number>(0);

  useEffect(() => {
    mountStartTime.current = performance.now();

    return () => {
      const mountTime = performance.now() - mountStartTime.current;
      if (mountTime > 100) {
        // Log slow mounts
        console.warn(
          `${componentName} took ${mountTime.toFixed(2)}ms to mount`,
        );
      }
    };
  }, [componentName]);

  const startRender = useCallback(() => {
    renderStartTime.current = performance.now();
  }, []);

  const endRender = useCallback(() => {
    const renderTime = performance.now() - renderStartTime.current;
    if (renderTime > 16) {
      // Log slow renders (>16ms = <60fps)
      console.warn(`${componentName} render took ${renderTime.toFixed(2)}ms`);
    }
  }, [componentName]);

  return { startRender, endRender };
}

// Window size hook with throttling
export function useWindowSize() {
  const [windowSize, setWindowSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 0,
    height: typeof window !== "undefined" ? window.innerHeight : 0,
  }));

  const handleResize = useThrottle(() => {
    setWindowSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  }, 100);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [handleResize]);

  return windowSize;
}

// Optimized search hook
export function useOptimizedSearch<T>(
  data: T[],
  searchTerm: string,
  searchFields: (keyof T)[],
  debounceMs: number = 300,
) {
  const debouncedSearchTerm = useDebounce(searchTerm, debounceMs);

  const filteredData = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return data;

    const lowercaseSearchTerm = debouncedSearchTerm.toLowerCase();
    return data.filter((item) =>
      searchFields.some((field) => {
        const value = item[field];
        return (
          typeof value === "string" &&
          value.toLowerCase().includes(lowercaseSearchTerm)
        );
      }),
    );
  }, [data, debouncedSearchTerm, searchFields]);

  return {
    filteredData,
    isSearching: searchTerm !== debouncedSearchTerm,
    searchTerm: debouncedSearchTerm,
  };
}

// Resource preloading hook
export function usePreloadResources(resources: string[]) {
  useEffect(() => {
    const preloadPromises = resources.map((resource) => {
      if (resource.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
        // Preload images
        return new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = resolve;
          img.onerror = reject;
          img.src = resource;
        });
      } else if (resource.match(/\.(js|css)$/i)) {
        // Preload scripts and stylesheets
        const link = document.createElement("link");
        link.rel = "prefetch";
        link.href = resource;
        document.head.appendChild(link);
        return Promise.resolve();
      }
      return Promise.resolve();
    });

    Promise.allSettled(preloadPromises).then((results) => {
      const failed = results.filter((result) => result.status === "rejected");
      if (failed.length > 0) {
        console.warn(`Failed to preload ${failed.length} resources`);
      }
    });
  }, [resources]);
}

// Connection quality monitoring
export function useConnectionQuality() {
  const [connectionQuality, setConnectionQuality] = useState<
    "fast" | "slow" | "offline"
  >("fast");

  useEffect(() => {
    if (!("connection" in navigator)) return;

    const connection = (navigator as any).connection;
    if (!connection) return;

    const updateConnectionQuality = () => {
      const { effectiveType, downlink } = connection;

      if (effectiveType === "slow-2g" || effectiveType === "2g") {
        setConnectionQuality("slow");
      } else if (downlink && downlink < 1.5) {
        setConnectionQuality("slow");
      } else {
        setConnectionQuality("fast");
      }
    };

    updateConnectionQuality();
    connection.addEventListener("change", updateConnectionQuality);

    const handleOnline = () => setConnectionQuality("fast");
    const handleOffline = () => setConnectionQuality("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      connection.removeEventListener("change", updateConnectionQuality);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return connectionQuality;
}
