import { useState, useEffect } from "react";
import { useWindowSize } from "./usePerformance";

// Breakpoints based on Tailwind CSS
const BREAKPOINTS = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const;

type Breakpoint = keyof typeof BREAKPOINTS;

// Hook for responsive behavior
export function useResponsive() {
  const { width, height } = useWindowSize();

  const getBreakpoint = (width: number): Breakpoint => {
    if (width >= BREAKPOINTS["2xl"]) return "2xl";
    if (width >= BREAKPOINTS.xl) return "xl";
    if (width >= BREAKPOINTS.lg) return "lg";
    if (width >= BREAKPOINTS.md) return "md";
    if (width >= BREAKPOINTS.sm) return "sm";
    return "xs";
  };

  const currentBreakpoint = getBreakpoint(width);

  const isBreakpoint = (breakpoint: Breakpoint) =>
    currentBreakpoint === breakpoint;

  const isAboveBreakpoint = (breakpoint: Breakpoint) =>
    width >= BREAKPOINTS[breakpoint];

  const isBelowBreakpoint = (breakpoint: Breakpoint) =>
    width < BREAKPOINTS[breakpoint];

  const isMobile = currentBreakpoint === "xs" || currentBreakpoint === "sm";
  const isTablet = currentBreakpoint === "md";
  const isDesktop = width >= BREAKPOINTS.lg;

  const orientation = width > height ? "landscape" : "portrait";

  // Device detection
  const isTouch = "ontouchstart" in window;
  const isAppleDevice = /iPad|iPhone|iPod/.test(navigator.userAgent);
  const isAndroid = /Android/.test(navigator.userAgent);

  return {
    width,
    height,
    currentBreakpoint,
    isBreakpoint,
    isAboveBreakpoint,
    isBelowBreakpoint,
    isMobile,
    isTablet,
    isDesktop,
    orientation,
    isTouch,
    isAppleDevice,
    isAndroid,
    aspectRatio: width / height,
  };
}

// Hook for responsive values
export function useResponsiveValue<T>(values: Partial<Record<Breakpoint, T>>) {
  const { currentBreakpoint } = useResponsive();

  // Find the appropriate value for current breakpoint
  const orderedBreakpoints: Breakpoint[] = [
    "2xl",
    "xl",
    "lg",
    "md",
    "sm",
    "xs",
  ];
  const currentIndex = orderedBreakpoints.indexOf(currentBreakpoint);

  for (let i = currentIndex; i < orderedBreakpoints.length; i++) {
    const breakpoint = orderedBreakpoints[i];
    if (values[breakpoint] !== undefined) {
      return values[breakpoint];
    }
  }

  // Fallback to the largest defined value
  for (const breakpoint of orderedBreakpoints) {
    if (values[breakpoint] !== undefined) {
      return values[breakpoint];
    }
  }

  return undefined;
}

// Hook for container queries (element-based responsive)
export function useContainerQuery(containerRef: React.RefObject<HTMLElement>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerWidth(width);
        setContainerHeight(height);
      }
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

  const getContainerBreakpoint = (): Breakpoint => {
    if (containerWidth >= 1280) return "xl";
    if (containerWidth >= 1024) return "lg";
    if (containerWidth >= 768) return "md";
    if (containerWidth >= 640) return "sm";
    return "xs";
  };

  return {
    containerWidth,
    containerHeight,
    containerBreakpoint: getContainerBreakpoint(),
  };
}

// Hook for adaptive content loading
export function useAdaptiveLoading() {
  const { isMobile, currentBreakpoint } = useResponsive();
  const [shouldLoadHeavyContent, setShouldLoadHeavyContent] = useState(false);

  useEffect(() => {
    // Check device capabilities
    const hasGoodConnection =
      "connection" in navigator &&
      (navigator as any).connection?.effectiveType !== "slow-2g" &&
      (navigator as any).connection?.effectiveType !== "2g";

    const hasEnoughMemory =
      "deviceMemory" in navigator ? (navigator as any).deviceMemory >= 4 : true; // Assume good memory if not available

    const hasGoodPerformance =
      !isMobile || hasGoodConnection || hasEnoughMemory;

    setShouldLoadHeavyContent(hasGoodPerformance);
  }, [isMobile]);

  return {
    shouldLoadHeavyContent,
    shouldLoadImages: shouldLoadHeavyContent,
    shouldLoadAnimations: shouldLoadHeavyContent && !isMobile,
    shouldLoadCharts: shouldLoadHeavyContent,
    maxImageQuality: isMobile ? "medium" : "high",
    preferredImageFormat: "webp",
  };
}

// Hook for safe area insets (mobile notches, etc.)
export function useSafeArea() {
  const [safeArea, setSafeArea] = useState({
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  });

  useEffect(() => {
    const updateSafeArea = () => {
      const style = getComputedStyle(document.documentElement);
      setSafeArea({
        top: parseInt(
          style.getPropertyValue("env(safe-area-inset-top)") || "0",
        ),
        right: parseInt(
          style.getPropertyValue("env(safe-area-inset-right)") || "0",
        ),
        bottom: parseInt(
          style.getPropertyValue("env(safe-area-inset-bottom)") || "0",
        ),
        left: parseInt(
          style.getPropertyValue("env(safe-area-inset-left)") || "0",
        ),
      });
    };

    updateSafeArea();
    window.addEventListener("resize", updateSafeArea);
    window.addEventListener("orientationchange", updateSafeArea);

    return () => {
      window.removeEventListener("resize", updateSafeArea);
      window.removeEventListener("orientationchange", updateSafeArea);
    };
  }, []);

  return safeArea;
}

// Hook for viewport detection (useful for fixed elements)
export function useViewport() {
  const [viewport, setViewport] = useState({
    width: 0,
    height: 0,
    scrollY: 0,
    scrollX: 0,
  });

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        width: window.innerWidth,
        height: window.innerHeight,
        scrollY: window.scrollY,
        scrollX: window.scrollX,
      });
    };

    updateViewport();

    const throttledUpdate = throttle(updateViewport, 16); // 60fps
    window.addEventListener("resize", throttledUpdate);
    window.addEventListener("scroll", throttledUpdate);

    return () => {
      window.removeEventListener("resize", throttledUpdate);
      window.removeEventListener("scroll", throttledUpdate);
    };
  }, []);

  return viewport;
}

// Utility function for throttling
function throttle<T extends Function>(
  func: T,
  limit: number,
): T {
  let inThrottle: boolean;
  return ((...args: any[]) => {
    if (!inThrottle) {
      func.apply(null, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  }) as T;
}

// Hook for dynamic font sizing
export function useResponsiveFontSize() {
  const { width, currentBreakpoint } = useResponsive();

  const getFontSizeMultiplier = (): number => {
    switch (currentBreakpoint) {
      case "xs":
        return 0.875; // 14px base
      case "sm":
        return 0.9; // 14.4px base
      case "md":
        return 1; // 16px base
      case "lg":
        return 1.05; // 16.8px base
      case "xl":
        return 1.1; // 17.6px base
      case "2xl":
        return 1.125; // 18px base
      default:
        return 1;
    }
  };

  const baseFontSize = 16;
  const multiplier = getFontSizeMultiplier();

  return {
    fontSize: baseFontSize * multiplier,
    multiplier,
    setDocumentFontSize: (size?: number) => {
      const rootFontSize = size || baseFontSize * multiplier;
      document.documentElement.style.fontSize = `${rootFontSize}px`;
    },
  };
}

// Hook for reduced motion preference
export function useReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return {
    prefersReducedMotion,
    shouldAnimate: !prefersReducedMotion,
    transitionDuration: prefersReducedMotion ? "0ms" : "200ms",
  };
}
