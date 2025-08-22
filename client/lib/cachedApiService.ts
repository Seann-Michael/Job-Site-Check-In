// Cached API service wrapper that enhances the existing dataService with caching
import { dataService } from './dataService';
import { memoryCache, localStorageCache, CACHE_DURATIONS } from './cacheUtils';

// Cache-enhanced wrapper for dataService
export class CachedApiService {
  // User operations with caching
  async getCurrentUser() {
    const cacheKey = 'current_user';
    
    // Check memory cache first (short-lived for user data)
    let user = memoryCache.get(cacheKey);
    if (user) {
      return user;
    }
    
    // Check localStorage for longer persistence
    user = localStorageCache.get(cacheKey);
    if (user) {
      // Refresh memory cache
      memoryCache.set(cacheKey, user, CACHE_DURATIONS.SHORT);
      return user;
    }
    
    // Fetch from API
    user = await dataService.getCurrentUser();
    if (user) {
      // Cache for future use
      memoryCache.set(cacheKey, user, CACHE_DURATIONS.SHORT);
      localStorageCache.set(cacheKey, user, CACHE_DURATIONS.MEDIUM);
    }
    
    return user;
  }

  async getUsers(filters?: any) {
    const cacheKey = `users_${JSON.stringify(filters || {})}`;
    
    // For user lists, use shorter cache due to potential frequent changes
    let users = memoryCache.get(cacheKey);
    if (users) {
      return users;
    }
    
    users = await dataService.getUsers(filters);
    if (users) {
      memoryCache.set(cacheKey, users, CACHE_DURATIONS.SHORT);
    }
    
    return users;
  }

  // Business operations with caching
  async getBusinesses(ownerId?: string, filters?: any) {
    const cacheKey = `businesses_${ownerId || 'all'}_${JSON.stringify(filters || {})}`;
    
    let businesses = memoryCache.get(cacheKey);
    if (businesses) {
      return businesses;
    }
    
    businesses = await dataService.getBusinesses(ownerId, filters);
    if (businesses) {
      // Cache business lists for medium duration
      memoryCache.set(cacheKey, businesses, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, businesses, CACHE_DURATIONS.LONG);
    }
    
    return businesses;
  }

  async getBusiness(id: string) {
    const cacheKey = `business_${id}`;
    
    let business = memoryCache.get(cacheKey);
    if (business) {
      return business;
    }
    
    business = localStorageCache.get(cacheKey);
    if (business) {
      memoryCache.set(cacheKey, business, CACHE_DURATIONS.MEDIUM);
      return business;
    }
    
    business = await dataService.getBusiness(id);
    if (business) {
      memoryCache.set(cacheKey, business, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, business, CACHE_DURATIONS.LONG);
    }
    
    return business;
  }

  async createBusiness(businessData: any) {
    const result = await dataService.createBusiness(businessData);
    
    if (result) {
      // Invalidate business caches
      this.invalidateBusinessCaches();
      
      // Cache the new business
      const cacheKey = `business_${result.id}`;
      memoryCache.set(cacheKey, result, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, result, CACHE_DURATIONS.LONG);
    }
    
    return result;
  }

  async updateBusiness(id: string, updates: any) {
    const result = await dataService.updateBusiness(id, updates);
    
    if (result) {
      // Update cache with new data
      const cacheKey = `business_${id}`;
      memoryCache.set(cacheKey, result, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, result, CACHE_DURATIONS.LONG);
      
      // Invalidate business lists
      this.invalidateBusinessListCaches();
    }
    
    return result;
  }

  async deleteBusiness(id: string) {
    const result = await dataService.deleteBusiness(id);
    
    // Remove from caches
    memoryCache.delete(`business_${id}`);
    localStorageCache.delete(`business_${id}`);
    
    // Invalidate business lists
    this.invalidateBusinessListCaches();
    
    return result;
  }

  // Project operations with caching
  async getProjects(businessId?: string, filters?: any) {
    const cacheKey = `projects_${businessId || 'all'}_${JSON.stringify(filters || {})}`;
    
    let projects = memoryCache.get(cacheKey);
    if (projects) {
      return projects;
    }
    
    projects = await dataService.getProjects(businessId, filters);
    if (projects) {
      memoryCache.set(cacheKey, projects, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, projects, CACHE_DURATIONS.LONG);
    }
    
    return projects;
  }

  async getProject(id: string) {
    const cacheKey = `project_${id}`;
    
    let project = memoryCache.get(cacheKey);
    if (project) {
      return project;
    }
    
    project = localStorageCache.get(cacheKey);
    if (project) {
      memoryCache.set(cacheKey, project, CACHE_DURATIONS.MEDIUM);
      return project;
    }
    
    project = await dataService.getProject(id);
    if (project) {
      memoryCache.set(cacheKey, project, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, project, CACHE_DURATIONS.LONG);
    }
    
    return project;
  }

  async createProject(projectData: any) {
    const result = await dataService.createProject(projectData);
    
    if (result) {
      // Invalidate project caches
      this.invalidateProjectCaches();
      
      // Cache the new project
      const cacheKey = `project_${result.id}`;
      memoryCache.set(cacheKey, result, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, result, CACHE_DURATIONS.LONG);
    }
    
    return result;
  }

  async updateProject(id: string, updates: any) {
    const result = await dataService.updateProject(id, updates);
    
    if (result) {
      // Update cache with new data
      const cacheKey = `project_${id}`;
      memoryCache.set(cacheKey, result, CACHE_DURATIONS.MEDIUM);
      localStorageCache.set(cacheKey, result, CACHE_DURATIONS.LONG);
      
      // Invalidate project lists
      this.invalidateProjectListCaches();
    }
    
    return result;
  }

  // Cache invalidation methods
  private invalidateBusinessCaches() {
    // Clear all business-related caches
    this.clearCachesByPattern('business');
  }

  private invalidateBusinessListCaches() {
    // Clear only business list caches, keep individual business caches
    this.clearCachesByPattern('businesses_');
  }

  private invalidateProjectCaches() {
    // Clear all project-related caches
    this.clearCachesByPattern('project');
  }

  private invalidateProjectListCaches() {
    // Clear only project list caches
    this.clearCachesByPattern('projects_');
  }

  private clearCachesByPattern(pattern: string) {
    // Clear memory cache
    const memoryStats = memoryCache.getStats();
    
    // We need to recreate the cache clearing logic since the MemoryCache class
    // doesn't expose the internal map
    memoryCache.clear(); // For now, clear all memory cache
    
    // Clear localStorage cache
    for (const key in localStorage) {
      if (key.includes(pattern)) {
        localStorage.removeItem(key);
      }
    }
  }

  // Preload common data combinations
  async preloadDashboardData(userId?: string) {
    try {
      await Promise.all([
        this.getCurrentUser(),
        this.getBusinesses(userId),
        // Add other dashboard-critical data here
      ]);
    } catch (error) {
      console.warn('Failed to preload dashboard data:', error);
    }
  }

  async preloadBusinessData(businessId: string) {
    try {
      await Promise.all([
        this.getBusiness(businessId),
        this.getProjects(businessId),
        // Add other business-critical data here
      ]);
    } catch (error) {
      console.warn('Failed to preload business data:', error);
    }
  }

  // Cache warming methods
  async warmCache() {
    try {
      const user = await this.getCurrentUser();
      if (user) {
        // Preload user's businesses
        await this.getBusinesses(user.id);
      }
    } catch (error) {
      console.warn('Cache warming failed:', error);
    }
  }

  // Cache statistics
  getCacheStats() {
    return {
      memory: memoryCache.getStats(),
      localStorage: this.getLocalStorageStats(),
    };
  }

  private getLocalStorageStats() {
    let count = 0;
    let size = 0;
    
    for (const key in localStorage) {
      if (key.startsWith('lsr_cache_')) {
        count++;
        size += localStorage.getItem(key)?.length || 0;
      }
    }
    
    return { count, size };
  }

  // Manual cache control
  clearAllCaches() {
    memoryCache.clear();
    localStorageCache.clear();
  }

  invalidateUserCache() {
    memoryCache.delete('current_user');
    localStorageCache.delete('current_user');
  }
}

// Export singleton instance
export const cachedApiService = new CachedApiService();

// Backwards compatibility - enhance existing dataService with caching
export const enhancedDataService = {
  ...dataService,
  ...cachedApiService,
};
