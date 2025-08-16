import React, { forwardRef, useRef } from "react";
import { useResponsive, useContainerQuery } from "@/hooks/useResponsive";
import { useIntersectionObserver } from "@/hooks/usePerformance";
import { cn } from "@/lib/utils";

interface ResponsiveWrapperProps {
  children: React.ReactNode;
  className?: string;
  breakpoints?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    "2xl"?: string;
  };
  containerBased?: boolean;
  lazyLoad?: boolean;
  fallback?: React.ReactNode;
}

export const ResponsiveWrapper = forwardRef<
  HTMLDivElement,
  ResponsiveWrapperProps
>(
  (
    {
      children,
      className,
      breakpoints,
      containerBased = false,
      lazyLoad = false,
      fallback,
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { currentBreakpoint, isMobile } = useResponsive();
    const { containerBreakpoint } = useContainerQuery(containerRef);
    const { elementRef, hasIntersected } = useIntersectionObserver({
      threshold: 0.1,
    });

    // Use container-based or viewport-based breakpoints
    const activeBreakpoint = containerBased
      ? containerBreakpoint
      : currentBreakpoint;

    // Get appropriate className for current breakpoint
    const responsiveClassName = breakpoints?.[activeBreakpoint] || "";

    // Combine refs
    const combinedRef = (node: HTMLDivElement) => {
      if (ref) {
        if (typeof ref === "function") {
          ref(node);
        } else {
          ref.current = node;
        }
      }
      containerRef.current = node;
      if (lazyLoad) {
        (elementRef as React.MutableRefObject<HTMLDivElement | null>).current =
          node;
      }
    };

    // Handle lazy loading
    if (lazyLoad && !hasIntersected) {
      return (
        <div ref={combinedRef} className={cn(className, responsiveClassName)}>
          {fallback || (
            <div className="flex items-center justify-center p-8">
              <div className="text-muted-foreground">Loading...</div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div ref={combinedRef} className={cn(className, responsiveClassName)}>
        {children}
      </div>
    );
  },
);

ResponsiveWrapper.displayName = "ResponsiveWrapper";

// Grid component with responsive columns
interface ResponsiveGridProps {
  children: React.ReactNode;
  className?: string;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    "2xl"?: number;
  };
  gap?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    "2xl"?: string;
  };
  containerBased?: boolean;
}

export function ResponsiveGrid({
  children,
  className,
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = { xs: "gap-2", sm: "gap-4", md: "gap-6" },
  containerBased = false,
}: ResponsiveGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { currentBreakpoint } = useResponsive();
  const { containerBreakpoint } = useContainerQuery(containerRef);

  const activeBreakpoint = containerBased
    ? containerBreakpoint
    : currentBreakpoint;

  // Get current column count
  const getColumnCount = () => {
    const breakpointOrder = ["2xl", "xl", "lg", "md", "sm", "xs"] as const;
    const startIndex = breakpointOrder.indexOf(activeBreakpoint);

    for (let i = startIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (columns[bp] !== undefined) {
        return columns[bp];
      }
    }
    return 1;
  };

  // Get current gap
  const getGap = () => {
    const breakpointOrder = ["2xl", "xl", "lg", "md", "sm", "xs"] as const;
    const startIndex = breakpointOrder.indexOf(activeBreakpoint);

    for (let i = startIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (gap[bp] !== undefined) {
        return gap[bp];
      }
    }
    return "gap-4";
  };

  const columnCount = getColumnCount();
  const gapClass = getGap();

  return (
    <div
      ref={containerRef}
      className={cn("grid", gapClass, className)}
      style={{
        gridTemplateColumns: `repeat(${columnCount}, 1fr)`,
      }}
    >
      {children}
    </div>
  );
}

// Responsive text component
interface ResponsiveTextProps {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
  className?: string;
  sizes?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    "2xl"?: string;
  };
}

export function ResponsiveText({
  children,
  as: Component = "div",
  className,
  sizes = {
    xs: "text-sm",
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
    xl: "text-2xl",
  },
}: ResponsiveTextProps) {
  const { currentBreakpoint } = useResponsive();

  const getTextSize = () => {
    const breakpointOrder = ["2xl", "xl", "lg", "md", "sm", "xs"] as const;
    const startIndex = breakpointOrder.indexOf(currentBreakpoint);

    for (let i = startIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (responsiveSizes[bp] !== undefined) {
        return responsiveSizes[bp];
      }
    }
    return "text-base";
  };

  return (
    <Component className={cn(getTextSize(), className)}>{children}</Component>
  );
}

// Responsive spacing component
interface ResponsiveSpacingProps {
  children: React.ReactNode;
  className?: string;
  padding?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    "2xl"?: string;
  };
  margin?: {
    xs?: string;
    sm?: string;
    md?: string;
    lg?: string;
    xl?: string;
    "2xl"?: string;
  };
}

export function ResponsiveSpacing({
  children,
  className,
  padding,
  margin,
}: ResponsiveSpacingProps) {
  const { currentBreakpoint } = useResponsive();

  const getSpacing = (spacingConfig?: ResponsiveSpacingProps["padding"]) => {
    if (!spacingConfig) return "";

    const breakpointOrder = ["2xl", "xl", "lg", "md", "sm", "xs"] as const;
    const startIndex = breakpointOrder.indexOf(currentBreakpoint);

    for (let i = startIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (spacingConfig[bp] !== undefined) {
        return spacingConfig[bp];
      }
    }
    return "";
  };

  const paddingClass = getSpacing(padding);
  const marginClass = getSpacing(margin);

  return (
    <div className={cn(paddingClass, marginClass, className)}>{children}</div>
  );
}

// Responsive image component
interface ResponsiveImageProps
  extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'sizes'> {
  src: string;
  alt: string;
  className?: string;
  responsiveSizes?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    "2xl"?: number;
  };
  aspectRatio?: string;
  lazy?: boolean;
  fallback?: string;
}

export function ResponsiveImage({
  src,
  alt,
  className,
  responsiveSizes = { xs: 320, sm: 640, md: 768, lg: 1024, xl: 1280 },
  aspectRatio,
  lazy = true,
  fallback,
  ...props
}: ResponsiveImageProps) {
  const { currentBreakpoint, isMobile } = useResponsive();
  const { elementRef, hasIntersected } = useIntersectionObserver({
    threshold: 0.1,
  });

  const getCurrentSize = () => {
    const breakpointOrder = ["2xl", "xl", "lg", "md", "sm", "xs"] as const;
    const startIndex = breakpointOrder.indexOf(currentBreakpoint);

    for (let i = startIndex; i < breakpointOrder.length; i++) {
      const bp = breakpointOrder[i];
      if (responsiveSizes[bp] !== undefined) {
        return responsiveSizes[bp];
      }
    }
    return 320;
  };

  // Generate srcSet for responsive images
  const generateSrcSet = () => {
    return Object.values(sizes)
      .sort((a, b) => a - b)
      .map((size) => `${src}?w=${size} ${size}w`)
      .join(", ");
  };

  const currentSize = getCurrentSize();
  const shouldLoad = !lazy || hasIntersected;

  return (
    <div
      ref={elementRef as React.RefObject<HTMLDivElement>}
      className={cn("overflow-hidden", className)}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {shouldLoad ? (
        <img
          src={`${src}?w=${currentSize}`}
          srcSet={generateSrcSet()}
          sizes={`(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw`}
          alt={alt}
          className="w-full h-full object-cover"
          loading={lazy ? "lazy" : "eager"}
          onError={(e) => {
            if (fallback) {
              (e.target as HTMLImageElement).src = fallback;
            }
          }}
          {...props}
        />
      ) : (
        <div className="w-full h-full bg-muted animate-pulse flex items-center justify-center">
          <span className="text-muted-foreground text-sm">Loading...</span>
        </div>
      )}
    </div>
  );
}

// Responsive container with max-width constraints
interface ResponsiveContainerProps {
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "2xl" | "full";
  centerContent?: boolean;
}

export function ResponsiveContainer({
  children,
  className,
  size = "xl",
  centerContent = true,
}: ResponsiveContainerProps) {
  const maxWidthClasses = {
    sm: "max-w-screen-sm",
    md: "max-w-screen-md",
    lg: "max-w-screen-lg",
    xl: "max-w-screen-xl",
    "2xl": "max-w-screen-2xl",
    full: "max-w-full",
  };

  return (
    <div
      className={cn(
        "w-full",
        maxWidthClasses[size],
        centerContent && "mx-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
