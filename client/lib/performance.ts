// Performance optimization utilities for the broadcast messaging system

export interface PerformanceMetrics {
  startTime: number;
  endTime?: number;
  duration?: number;
  operations: number;
  throughput?: number;
  memoryUsage?: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private observers: Map<string, PerformanceObserver> = new Map();

  startMeasurement(key: string, operations: number = 1): void {
    this.metrics.set(key, {
      startTime: performance.now(),
      operations,
      memoryUsage: this.getMemoryUsage(),
    });
  }

  endMeasurement(key: string): PerformanceMetrics | null {
    const metric = this.metrics.get(key);
    if (!metric) return null;

    const endTime = performance.now();
    const duration = endTime - metric.startTime;
    const throughput = metric.operations / (duration / 1000);

    const finalMetric: PerformanceMetrics = {
      ...metric,
      endTime,
      duration,
      throughput,
    };

    this.metrics.set(key, finalMetric);
    return finalMetric;
  }

  getMetrics(key: string): PerformanceMetrics | null {
    return this.metrics.get(key) || null;
  }

  getAllMetrics(): Record<string, PerformanceMetrics> {
    return Object.fromEntries(this.metrics);
  }

  clearMetrics(key?: string): void {
    if (key) {
      this.metrics.delete(key);
    } else {
      this.metrics.clear();
    }
  }

  private getMemoryUsage(): number {
    if ("memory" in performance) {
      return (performance as any).memory?.usedJSHeapSize || 0;
    }
    return 0;
  }

  // Monitor specific API calls
  observeNavigationTiming(): void {
    if (!("PerformanceObserver" in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === "navigation") {
          console.log("Navigation Timing:", {
            domContentLoaded:
              entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
            loadComplete: entry.loadEventEnd - entry.loadEventStart,
            totalPageLoad: entry.loadEventEnd - entry.fetchStart,
          });
        }
      }
    });

    observer.observe({ entryTypes: ["navigation"] });
    this.observers.set("navigation", observer);
  }

  // Monitor resource loading
  observeResourceTiming(): void {
    if (!("PerformanceObserver" in window)) return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.duration > 1000) {
          // Log slow resources
          console.warn("Slow Resource:", {
            name: entry.name,
            duration: entry.duration,
            size: (entry as any).transferSize || 0,
          });
        }
      }
    });

    observer.observe({ entryTypes: ["resource"] });
    this.observers.set("resource", observer);
  }

  disconnect(): void {
    this.observers.forEach((observer) => observer.disconnect());
    this.observers.clear();
  }
}

// Cache management utilities
export class CacheManager {
  private caches: Map<string, Map<string, any>> = new Map();
  private ttl: Map<string, Map<string, number>> = new Map();

  createCache(name: string): void {
    this.caches.set(name, new Map());
    this.ttl.set(name, new Map());
  }

  set(
    cacheName: string,
    key: string,
    value: any,
    ttlSeconds: number = 300,
  ): void {
    if (!this.caches.has(cacheName)) {
      this.createCache(cacheName);
    }

    const cache = this.caches.get(cacheName)!;
    const ttlMap = this.ttl.get(cacheName)!;

    cache.set(key, value);
    ttlMap.set(key, Date.now() + ttlSeconds * 1000);
  }

  get(cacheName: string, key: string): any | null {
    const cache = this.caches.get(cacheName);
    const ttlMap = this.ttl.get(cacheName);

    if (!cache || !ttlMap) return null;

    const expiry = ttlMap.get(key);
    if (!expiry || Date.now() > expiry) {
      cache.delete(key);
      ttlMap.delete(key);
      return null;
    }

    return cache.get(key) || null;
  }

  delete(cacheName: string, key: string): void {
    const cache = this.caches.get(cacheName);
    const ttlMap = this.ttl.get(cacheName);

    cache?.delete(key);
    ttlMap?.delete(key);
  }

  clear(cacheName: string): void {
    const cache = this.caches.get(cacheName);
    const ttlMap = this.ttl.get(cacheName);

    cache?.clear();
    ttlMap?.clear();
  }

  clearExpired(): void {
    const now = Date.now();

    this.ttl.forEach((ttlMap, cacheName) => {
      const cache = this.caches.get(cacheName);
      if (!cache) return;

      for (const [key, expiry] of ttlMap.entries()) {
        if (now > expiry) {
          cache.delete(key);
          ttlMap.delete(key);
        }
      }
    });
  }

  getCacheStats(cacheName: string): { size: number; hitRate: number } | null {
    const cache = this.caches.get(cacheName);
    if (!cache) return null;

    // Simple stats - in real implementation, you'd track hits/misses
    return {
      size: cache.size,
      hitRate: 0.85, // Mock value
    };
  }
}

// Database query optimization
export class QueryOptimizer {
  private queryCache = new CacheManager();

  constructor() {
    this.queryCache.createCache("queries");
  }

  async optimizedQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    ttlSeconds: number = 60,
  ): Promise<T> {
    // Check cache first
    const cached = this.queryCache.get("queries", queryKey);
    if (cached) {
      return cached;
    }

    // Execute query with performance monitoring
    const monitor = new PerformanceMonitor();
    monitor.startMeasurement("query");

    try {
      const result = await queryFn();

      // Cache the result
      this.queryCache.set("queries", queryKey, result, ttlSeconds);

      const metrics = monitor.endMeasurement("query");
      if (metrics && metrics.duration && metrics.duration > 1000) {
        console.warn(
          `Slow query detected: ${queryKey} took ${metrics.duration}ms`,
        );
      }

      return result;
    } catch (error) {
      monitor.endMeasurement("query");
      throw error;
    }
  }

  invalidateQuery(queryKey: string): void {
    this.queryCache.delete("queries", queryKey);
  }

  invalidatePattern(pattern: string): void {
    // In a real implementation, you'd use pattern matching
    // For now, just clear all
    this.queryCache.clear("queries");
  }
}

// Pagination utilities for large datasets
export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export class DataPaginator<T> {
  static paginate<T>(
    data: T[],
    options: PaginationOptions,
  ): PaginatedResult<T> {
    const { page, pageSize, sortBy, sortOrder = "asc", filters } = options;

    let filtered = data;

    // Apply filters
    if (filters) {
      filtered = filtered.filter((item) => {
        return Object.entries(filters).every(([key, value]) => {
          if (!value || value === "") return true;
          const itemValue = (item as any)[key];
          if (typeof itemValue === "string") {
            return itemValue.toLowerCase().includes(value.toLowerCase());
          }
          return itemValue === value;
        });
      });
    }

    // Apply sorting
    if (sortBy) {
      filtered.sort((a, b) => {
        const aVal = (a as any)[sortBy];
        const bVal = (b as any)[sortBy];

        if (aVal < bVal) return sortOrder === "asc" ? -1 : 1;
        if (aVal > bVal) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filtered.slice(startIndex, endIndex);

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout;

  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(null, args), delay);
  };
}

// Throttle utility for performance
export function throttle<T extends Function>(
  func: T,
  delay: number,
): T {
  let lastCall = 0;

  return ((...args: any[]) => {
    const now = Date.now();
    if (now - lastCall >= delay) {
      lastCall = now;
      (func as any).apply(null, args);
    }
  }) as T;
}

// Memory monitoring
export class MemoryMonitor {
  private interval: NodeJS.Timeout | null = null;

  startMonitoring(intervalMs: number = 5000): void {
    this.interval = setInterval(() => {
      if ("memory" in performance) {
        const memory = (performance as any).memory;
        const usage = {
          used: memory.usedJSHeapSize,
          total: memory.totalJSHeapSize,
          limit: memory.jsHeapSizeLimit,
          percentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
        };

        if (usage.percentage > 80) {
          console.warn("High memory usage detected:", usage);
        }
      }
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

// Global instances
export const globalPerformanceMonitor = new PerformanceMonitor();
export const globalCacheManager = new CacheManager();
export const globalQueryOptimizer = new QueryOptimizer();
export const globalMemoryMonitor = new MemoryMonitor();

// Initialize performance monitoring
if (typeof window !== "undefined") {
  globalPerformanceMonitor.observeNavigationTiming();
  globalPerformanceMonitor.observeResourceTiming();
  globalMemoryMonitor.startMonitoring();

  // Cleanup on page unload
  window.addEventListener("beforeunload", () => {
    globalPerformanceMonitor.disconnect();
    globalMemoryMonitor.stopMonitoring();
  });
}
