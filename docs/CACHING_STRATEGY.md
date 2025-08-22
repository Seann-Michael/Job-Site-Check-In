# Caching Strategy Documentation

This document outlines the comprehensive caching strategy implemented for the Local SEO Ranker application to improve performance, reduce server load, and enhance user experience.

## Overview

The caching implementation consists of multiple layers:

1. **Service Worker Caching** - Browser-level caching for offline support
2. **React Query Caching** - Client-side query result caching
3. **Memory Caching** - In-memory caching for immediate access
4. **Local Storage Caching** - Persistent client-side caching
5. **HTTP Caching** - Server response caching with proper headers

## Implementation Details

### 1. Service Worker Caching (`public/sw.js`)

The service worker provides intelligent caching strategies:

- **Static Assets**: Cache-first strategy for CSS, JS, images
- **API Responses**: Network-first with cache fallback
- **Images**: Progressive loading with offline placeholders
- **Offline Support**: Cached responses when network is unavailable

**Cache Types:**
- `lsr-static-v2`: Static application assets
- `lsr-dynamic-v2`: Dynamic content and pages
- `lsr-images-v2`: Image assets with cleanup
- `lsr-api-v2`: API responses for offline use

### 2. React Query Configuration (`client/lib/queryClient.ts`)

Optimized query client with:

```typescript
// Cache times for different data types
CACHE_TIMES = {
  REAL_TIME: { staleTime: 30s, gcTime: 2min },
  SHORT: { staleTime: 2min, gcTime: 10min },
  MEDIUM: { staleTime: 5min, gcTime: 30min },
  LONG: { staleTime: 30min, gcTime: 2hr },
  STATIC: { staleTime: 24hr, gcTime: 7days },
}
```

**Features:**
- Automatic retry with exponential backoff
- Background refetching on window focus
- Optimistic updates for fast UI feedback
- Query key factories for consistent cache keys
- Cache invalidation helpers

### 3. Custom Query Hooks (`client/hooks/useQueries.ts`)

Pre-built hooks for common operations:

```typescript
// Examples
const { data, isLoading } = useProjects(businessId, filters);
const { data: user } = useUserProfile();
const createProject = useCreateProject(); // with cache invalidation
```

**Benefits:**
- Automatic caching based on query keys
- Built-in error handling and retries
- Optimistic updates for mutations
- Cache invalidation on mutations

### 4. Memory & LocalStorage Caching (`client/lib/cacheUtils.ts`)

Multi-level caching system:

```typescript
// Memory cache - fast, temporary
memoryCache.set(key, data, ttlSeconds);
const data = memoryCache.get(key);

// LocalStorage cache - persistent across sessions
localStorageCache.set(key, data, ttlSeconds);
const data = localStorageCache.get(key);
```

**Features:**
- Automatic expiration
- Memory cleanup to prevent leaks
- Size limits to prevent storage overflow
- Cache statistics for monitoring

### 5. Enhanced API Service (`client/lib/cachedApiService.ts`)

Wraps the existing dataService with caching:

```typescript
// Usage
const businesses = await cachedApiService.getBusinesses(ownerId);
await cachedApiService.preloadDashboardData(userId);
```

**Features:**
- Multi-layer cache checking (memory → localStorage → API)
- Cache invalidation on mutations
- Preloading strategies
- Cache warming on app startup

## Cache Strategies by Data Type

### User Data
- **Memory Cache**: 5 minutes
- **LocalStorage**: 30 minutes
- **Strategy**: Private, short-lived due to sensitivity

### Business Data
- **Memory Cache**: 30 minutes
- **LocalStorage**: 2 hours
- **Strategy**: Longer cache, invalidated on updates

### Project Data
- **Memory Cache**: 30 minutes
- **LocalStorage**: 2 hours
- **Strategy**: Medium cache with optimistic updates

### Analytics Data
- **Memory Cache**: 2 minutes
- **LocalStorage**: None
- **Strategy**: Short cache due to frequent changes

### Static Assets
- **Service Worker**: 7 days
- **Strategy**: Cache-first with version-based invalidation

## Performance Benefits

1. **Reduced Server Load**: Fewer redundant API calls
2. **Faster UI**: Immediate responses from cache
3. **Offline Support**: Cached responses when network fails
4. **Better UX**: Optimistic updates for instant feedback
5. **Memory Efficiency**: Automatic cleanup and size limits

## Cache Invalidation

### Automatic Invalidation
- **Mutations**: Related caches cleared on create/update/delete
- **Time-based**: Automatic expiration based on TTL
- **Memory limits**: LRU eviction when cache is full

### Manual Invalidation
```typescript
// Clear specific caches
invalidateQueries.projects();
invalidateQueries.businessDetail(businessId);

// Clear all caches
cachedApiService.clearAllCaches();
```

## Monitoring and Debugging

### Cache Statistics
```typescript
// Get cache usage stats
const stats = cachedApiService.getCacheStats();
console.log('Memory cache:', stats.memory);
console.log('LocalStorage:', stats.localStorage);
```

### React Query DevTools
Add React Query DevTools in development:

```typescript
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

// In App component
{process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
```

## Best Practices

### 1. Use Appropriate Cache Times
- **Real-time data**: 30 seconds or less
- **User data**: 2-5 minutes
- **Business data**: 30 minutes
- **Static data**: Hours or days

### 2. Implement Optimistic Updates
```typescript
const mutation = useMutation({
  onMutate: async (newData) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries({ queryKey });
    
    // Snapshot previous value
    const previous = queryClient.getQueryData(queryKey);
    
    // Optimistically update
    queryClient.setQueryData(queryKey, newData);
    
    return { previous };
  },
  onError: (err, variables, context) => {
    // Rollback on error
    queryClient.setQueryData(queryKey, context.previous);
  }
});
```

### 3. Preload Critical Data
```typescript
// Preload data when user navigates
const handleBusinessSelect = async (businessId) => {
  await cachedApiService.preloadBusinessData(businessId);
  navigate(`/business/${businessId}`);
};
```

### 4. Handle Cache Misses Gracefully
```typescript
const { data, isLoading, error, isStale } = useQuery({
  queryKey,
  queryFn,
  fallbackData: [], // Prevent undefined states
});
```

## Configuration

### Environment Variables
```env
# Cache debugging
VITE_CACHE_DEBUG=true

# Cache sizes
VITE_MEMORY_CACHE_SIZE=100
VITE_DEFAULT_CACHE_TTL=300
```

### Service Worker Updates
The service worker automatically updates when the version changes in `sw.js`. To force an update:

```javascript
// In service worker
const CACHE_NAME = "local-seo-ranker-v2.1.0"; // Increment version
```

## Troubleshooting

### Common Issues

1. **Stale Data**: Check cache TTL settings
2. **Memory Leaks**: Monitor cache statistics
3. **Storage Quota**: Implement proper cleanup
4. **Network Errors**: Ensure fallback strategies

### Debug Commands
```javascript
// Clear all caches
cachedApiService.clearAllCaches();

// Check cache stats
console.log(cachedApiService.getCacheStats());

// Force refresh
queryClient.invalidateQueries();
```

## Future Improvements

1. **Redis Integration**: Server-side caching for better performance
2. **CDN Integration**: Static asset caching at edge locations
3. **GraphQL Caching**: Field-level caching for GraphQL APIs
4. **Background Sync**: Queue mutations when offline
5. **Push Notifications**: Real-time cache invalidation

## Conclusion

This comprehensive caching strategy significantly improves application performance while maintaining data consistency and providing excellent user experience. The multi-layer approach ensures optimal cache utilization while preventing common caching pitfalls.
