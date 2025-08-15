import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAnalytics } from "@/lib/analytics";
import { ProjectCard } from "@/components/ProjectCard";

interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onScroll?: (scrollTop: number, scrollDirection: "up" | "down") => void;
  loadMore?: () => void;
  hasMore?: boolean;
  loading?: boolean;
  gap?: number;
}

export function VirtualScroll<T>({
  items = [], // Add default empty array
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 5,
  className = "",
  onScroll,
  loadMore,
  hasMore = false,
  loading = false,
  gap = 0,
}: VirtualScrollProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollTimeoutRef = useRef<NodeJS.Timeout>();
  const lastScrollTopRef = useRef(0);
  const { trackPerformance } = useAnalytics();

  // Add safety check for items array
  const safeItems = Array.isArray(items) ? items : [];
  
  const totalHeight = safeItems.length * (itemHeight + gap);
  const visibleItemCount = Math.ceil(containerHeight / (itemHeight + gap));
  const startIndex = Math.max(
    0,
    Math.floor(scrollTop / (itemHeight + gap)) - overscan,
  );
  const endIndex = Math.min(
    safeItems.length - 1,
    startIndex + visibleItemCount + overscan * 2,
  );

  const visibleItems = safeItems.slice(startIndex, endIndex + 1);
  const offsetY = startIndex * (itemHeight + gap);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const newScrollTop = e.currentTarget.scrollTop;
      const scrollDirection =
        newScrollTop > lastScrollTopRef.current ? "down" : "up";

      setScrollTop(newScrollTop);
      setIsScrolling(true);
      lastScrollTopRef.current = newScrollTop;

      onScroll?.(newScrollTop, scrollDirection);

      // Clear existing timeout
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }

      // Set new timeout
      scrollTimeoutRef.current = setTimeout(() => {
        setIsScrolling(false);
      }, 150);

      // Infinite loading trigger
      if (
        loadMore &&
        hasMore &&
        !loading &&
        newScrollTop + containerHeight >= totalHeight - itemHeight * 3
      ) {
        loadMore();
        if (trackPerformance && typeof trackPerformance === 'function') {
          try {
            trackPerformance("virtual_scroll_load_more", Date.now());
          } catch (error) {
            console.warn('VirtualScroll load more tracking failed:', error);
          }
        }
      }
    },
    [
      onScroll,
      loadMore,
      hasMore,
      loading,
      totalHeight,
      containerHeight,
      itemHeight,
      trackPerformance,
    ],
  );

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  // Performance monitoring
  useEffect(() => {
    try {
      if (safeItems.length > 0 && trackPerformance && typeof trackPerformance === 'function') {
        trackPerformance(
          "virtual_scroll_render_count",
          endIndex - startIndex + 1,
        );
      }
    } catch (error) {
      console.warn('VirtualScroll performance tracking failed:', error);
    }
  }, [startIndex, endIndex, safeItems.length, trackPerformance]);

  return (
    <div
      ref={containerRef}
      className={`virtual-scroll-container overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{
                height: itemHeight,
                marginBottom: gap,
              }}
              className={isScrolling ? "will-change-transform" : ""}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>

        {/* Loading indicator for infinite scroll */}
        {loading && (
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              height: 60,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="spinner" />
              Loading more items...
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook for managing virtual scroll state
export function useVirtualScroll<T>(
  allItems: T[] = [], // Add default empty array
  pageSize: number = 50,
  initialLoad: number = 100,
) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // Add safety check for allItems
  const safeAllItems = Array.isArray(allItems) ? allItems : [];

  useEffect(() => {
    // Initial load
    const initial = safeAllItems.slice(0, initialLoad);
    setItems(initial);
    setHasMore(safeAllItems.length > initialLoad);
  }, [safeAllItems, initialLoad]);

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return;

    setLoading(true);

    // Simulate async loading
    setTimeout(() => {
      const currentLength = items.length;
      const nextItems = safeAllItems.slice(currentLength, currentLength + pageSize);

      setItems((prev) => [...prev, ...nextItems]);
      setHasMore(currentLength + nextItems.length < safeAllItems.length);
      setLoading(false);
    }, 100);
  }, [safeAllItems, items.length, pageSize, loading, hasMore]);

  return {
    items,
    loading,
    hasMore,
    loadMore,
    reset: () => {
      const initial = safeAllItems.slice(0, initialLoad);
      setItems(initial);
      setHasMore(safeAllItems.length > initialLoad);
      setLoading(false);
    },
  };
}

// Optimized list component for projects - Updated to match usage in Index.tsx
interface VirtualProjectListProps {
  projects: any[];
  onDeleteProject: (id: string) => void;
  cardSize?: "small" | "medium" | "large";
  className?: string;
  onScroll?: (scrollTop: number, direction: "up" | "down") => void;
}

export function VirtualProjectList({
  projects = [], // Add default empty array
  onDeleteProject,
  cardSize = "small",
  className = "",
  onScroll,
}: VirtualProjectListProps) {
  const { items, loading, hasMore, loadMore } = useVirtualScroll(
    projects,
    20,
    50,
  );

  // Render function for project cards
  const renderProject = useCallback((project: any, index: number) => {
    return (
      <ProjectCard
        key={project.id}
        project={project}
        onDelete={() => onDeleteProject(project.id)}
      />
    );
  }, [onDeleteProject]);

  // If no projects, show a simple message instead of the virtual scroll
  if (!Array.isArray(projects) || projects.length === 0) {
    return (
      <div className={`flex items-center justify-center p-8 text-muted-foreground ${className}`}>
        No projects to display
      </div>
    );
  }

  // Adjust height based on card size
  const getItemHeight = () => {
    switch (cardSize) {
      case "small": return 280;
      case "medium": return 320;
      case "large": return 380;
      default: return 280;
    }
  };

  return (
    <VirtualScroll
      items={items}
      itemHeight={getItemHeight()}
      containerHeight={600}
      renderItem={renderProject}
      overscan={3}
      className={className}
      onScroll={onScroll}
      loadMore={loadMore}
      hasMore={hasMore}
      loading={loading}
      gap={24} // Gap between project cards
    />
  );
}

// Optimized grid component
interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  gap?: number;
  className?: string;
}

export function VirtualGrid<T>({
  items = [], // Add default empty array
  renderItem,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  gap = 16,
  className = "",
}: VirtualGridProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);

  // Add safety check for items
  const safeItems = Array.isArray(items) ? items : [];

  const columnsPerRow = Math.floor((containerWidth + gap) / (itemWidth + gap));
  const rowHeight = itemHeight + gap;
  const totalRows = Math.ceil(safeItems.length / columnsPerRow);
  const totalHeight = totalRows * rowHeight;

  const startRow = Math.floor(scrollTop / rowHeight);
  const endRow = Math.min(
    totalRows - 1,
    startRow + Math.ceil(containerHeight / rowHeight) + 1,
  );

  const visibleItems: Array<{
    item: T;
    index: number;
    row: number;
    col: number;
  }> = [];

  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col < columnsPerRow; col++) {
      const index = row * columnsPerRow + col;
      if (index < safeItems.length) {
        visibleItems.push({
          item: safeItems[index],
          index,
          row,
          col,
        });
      }
    }
  }

  return (
    <div
      className={`virtual-scroll-container overflow-auto ${className}`}
      style={{ height: containerHeight }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleItems.map(({ item, index, row, col }) => (
          <div
            key={index}
            style={{
              position: "absolute",
              left: col * (itemWidth + gap),
              top: row * rowHeight,
              width: itemWidth,
              height: itemHeight,
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}
