interface OfflineData {
  id: string;
  type: 'project' | 'business' | 'task' | 'media' | 'draft' | 'analytics';
  data: any;
  timestamp: number;
  synced: boolean;
  version: number;
  userId?: string;
}

interface SyncQueueItem {
  id: string;
  operation: 'create' | 'update' | 'delete';
  endpoint: string;
  data: any;
  timestamp: number;
  retryCount: number;
  priority: 'high' | 'medium' | 'low';
}

interface OfflineStorageConfig {
  dbName: string;
  version: number;
  maxStorageSize: number; // in MB
  syncRetryLimit: number;
  syncRetryDelay: number; // in ms
}

class OfflineStorageService {
  private db: IDBDatabase | null = null;
  private config: OfflineStorageConfig;
  private syncQueue: SyncQueueItem[] = [];
  private isOnline: boolean = navigator.onLine;
  private syncInProgress: boolean = false;

  constructor(config?: Partial<OfflineStorageConfig>) {
    this.config = {
      dbName: 'LocalSEORankerDB',
      version: 2,
      maxStorageSize: 100, // 100MB
      syncRetryLimit: 3,
      syncRetryDelay: 5000,
      ...config
    };

    this.initialize();
    this.setupEventListeners();
  }

  private async initialize() {
    try {
      await this.openDatabase();
      await this.loadSyncQueue();
      console.log('✅ Offline storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize offline storage:', error);
    }
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB not supported'));
        return;
      }

      const request = indexedDB.open(this.config.dbName, this.config.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  private createObjectStores(db: IDBDatabase) {
    // Main data store
    if (!db.objectStoreNames.contains('data')) {
      const dataStore = db.createObjectStore('data', { keyPath: 'id' });
      dataStore.createIndex('type', 'type', { unique: false });
      dataStore.createIndex('synced', 'synced', { unique: false });
      dataStore.createIndex('timestamp', 'timestamp', { unique: false });
      dataStore.createIndex('userId', 'userId', { unique: false });
    }

    // Sync queue store
    if (!db.objectStoreNames.contains('syncQueue')) {
      const syncStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('priority', 'priority', { unique: false });
      syncStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Media cache store
    if (!db.objectStoreNames.contains('media')) {
      const mediaStore = db.createObjectStore('media', { keyPath: 'id' });
      mediaStore.createIndex('url', 'url', { unique: true });
      mediaStore.createIndex('timestamp', 'timestamp', { unique: false });
    }

    // Settings store
    if (!db.objectStoreNames.contains('settings')) {
      db.createObjectStore('settings', { keyPath: 'key' });
    }

    console.log('📦 IndexedDB object stores created/updated');
  }

  private setupEventListeners() {
    // Online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      console.log('🌐 Back online - starting sync');
      this.startSync();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      console.log('📱 Gone offline - queuing operations');
    });

    // Page visibility for sync optimization
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isOnline) {
        this.startSync();
      }
    });
  }

  // Data operations
  async saveData(data: Omit<OfflineData, 'timestamp' | 'version'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const offlineData: OfflineData = {
      ...data,
      timestamp: Date.now(),
      version: 1
    };

    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(offlineData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Check storage size
    await this.checkStorageSize();
  }

  async getData(id: string): Promise<OfflineData | null> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async getDataByType(type: OfflineData['type'], userId?: string): Promise<OfflineData[]> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['data'], 'readonly');
    const store = transaction.objectStore('data');
    const index = store.index('type');
    
    return new Promise((resolve, reject) => {
      const request = index.getAll(type);
      request.onsuccess = () => {
        let results = request.result;
        
        // Filter by userId if provided
        if (userId) {
          results = results.filter(item => item.userId === userId);
        }
        
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteData(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction(['data'], 'readwrite');
    const store = transaction.objectStore('data');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Sync queue operations
  async addToSyncQueue(item: Omit<SyncQueueItem, 'timestamp' | 'retryCount'>): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const syncItem: SyncQueueItem = {
      ...item,
      timestamp: Date.now(),
      retryCount: 0
    };

    const transaction = this.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(syncItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    this.syncQueue.push(syncItem);

    // Start sync if online
    if (this.isOnline) {
      this.startSync();
    }
  }

  private async loadSyncQueue(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncQueue'], 'readonly');
    const store = transaction.objectStore('syncQueue');
    
    this.syncQueue = await new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    console.log(`📋 Loaded ${this.syncQueue.length} items in sync queue`);
  }

  private async startSync(): Promise<void> {
    if (this.syncInProgress || !this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 Starting sync process...');

    try {
      // Sort by priority and timestamp
      this.syncQueue.sort((a, b) => {
        const priorityWeight = { high: 3, medium: 2, low: 1 };
        const priorityDiff = priorityWeight[b.priority] - priorityWeight[a.priority];
        if (priorityDiff !== 0) return priorityDiff;
        return a.timestamp - b.timestamp;
      });

      const syncPromises = this.syncQueue.slice(0, 5).map(item => this.syncItem(item));
      await Promise.allSettled(syncPromises);

    } catch (error) {
      console.error('❌ Sync process failed:', error);
    } finally {
      this.syncInProgress = false;
      
      // Continue syncing if there are more items
      if (this.syncQueue.length > 0) {
        setTimeout(() => this.startSync(), 1000);
      }
    }
  }

  private async syncItem(item: SyncQueueItem): Promise<void> {
    try {
      const response = await fetch(item.endpoint, {
        method: this.getHTTPMethod(item.operation),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.getAuthToken()}`
        },
        body: item.operation !== 'delete' ? JSON.stringify(item.data) : undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Remove from queue on success
      await this.removeFromSyncQueue(item.id);
      console.log(`✅ Synced: ${item.operation} ${item.endpoint}`);

    } catch (error) {
      console.warn(`⚠️ Sync failed for ${item.id}:`, error);
      
      item.retryCount++;
      
      if (item.retryCount >= this.config.syncRetryLimit) {
        console.error(`❌ Max retries reached for ${item.id}, removing from queue`);
        await this.removeFromSyncQueue(item.id);
      } else {
        // Update retry count in database
        await this.updateSyncQueueItem(item);
        
        // Retry with exponential backoff
        const delay = this.config.syncRetryDelay * Math.pow(2, item.retryCount - 1);
        setTimeout(() => this.syncItem(item), delay);
      }
    }
  }

  private async removeFromSyncQueue(id: string): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    this.syncQueue = this.syncQueue.filter(item => item.id !== id);
  }

  private async updateSyncQueueItem(item: SyncQueueItem): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['syncQueue'], 'readwrite');
    const store = transaction.objectStore('syncQueue');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Media caching
  async cacheMedia(url: string, blob: Blob): Promise<void> {
    if (!this.db) throw new Error('Database not initialized');

    const mediaData = {
      id: this.generateId(),
      url,
      blob,
      timestamp: Date.now(),
      size: blob.size,
      type: blob.type
    };

    const transaction = this.db.transaction(['media'], 'readwrite');
    const store = transaction.objectStore('media');
    
    await new Promise<void>((resolve, reject) => {
      const request = store.put(mediaData);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getCachedMedia(url: string): Promise<Blob | null> {
    if (!this.db) return null;

    const transaction = this.db.transaction(['media'], 'readonly');
    const store = transaction.objectStore('media');
    const index = store.index('url');
    
    return new Promise((resolve, reject) => {
      const request = index.get(url);
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.blob : null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Storage management
  async checkStorageSize(): Promise<void> {
    if (!('navigator' in window) || !('storage' in navigator) || !('estimate' in navigator.storage)) {
      return;
    }

    try {
      const estimate = await navigator.storage.estimate();
      const usedMB = (estimate.usage || 0) / (1024 * 1024);
      const quotaMB = (estimate.quota || 0) / (1024 * 1024);

      console.log(`💾 Storage: ${usedMB.toFixed(2)}MB / ${quotaMB.toFixed(2)}MB`);

      if (usedMB > this.config.maxStorageSize) {
        await this.cleanupOldData();
      }
    } catch (error) {
      console.warn('Failed to check storage size:', error);
    }
  }

  private async cleanupOldData(): Promise<void> {
    if (!this.db) return;

    console.log('🧹 Cleaning up old data...');

    const transaction = this.db.transaction(['data', 'media'], 'readwrite');
    const dataStore = transaction.objectStore('data');
    const mediaStore = transaction.objectStore('media');

    // Remove synced data older than 30 days
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const dataIndex = dataStore.index('timestamp');
    const mediaIndex = mediaStore.index('timestamp');

    // Cleanup old synced data
    const dataCursor = dataIndex.openCursor(IDBKeyRange.upperBound(thirtyDaysAgo));
    dataCursor.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        const data = cursor.value as OfflineData;
        if (data.synced) {
          cursor.delete();
        }
        cursor.continue();
      }
    };

    // Cleanup old media
    const mediaCursor = mediaIndex.openCursor(IDBKeyRange.upperBound(thirtyDaysAgo));
    mediaCursor.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result;
      if (cursor) {
        cursor.delete();
        cursor.continue();
      }
    };
  }

  // Utility methods
  private getHTTPMethod(operation: SyncQueueItem['operation']): string {
    switch (operation) {
      case 'create': return 'POST';
      case 'update': return 'PUT';
      case 'delete': return 'DELETE';
      default: return 'GET';
    }
  }

  private getAuthToken(): string {
    return localStorage.getItem('auth_token') || '';
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }

  // Public API methods
  async saveProject(project: any): Promise<void> {
    await this.saveData({
      id: project.id || this.generateId(),
      type: 'project',
      data: project,
      synced: false
    });

    if (this.isOnline) {
      await this.addToSyncQueue({
        id: this.generateId(),
        operation: project.id ? 'update' : 'create',
        endpoint: '/api/projects',
        data: project,
        priority: 'medium'
      });
    }
  }

  async saveDraft(type: string, data: any): Promise<string> {
    const id = this.generateId();
    await this.saveData({
      id,
      type: 'draft',
      data: { type, ...data },
      synced: false
    });
    return id;
  }

  async getDrafts(): Promise<OfflineData[]> {
    return this.getDataByType('draft');
  }

  async clearAllData(): Promise<void> {
    if (!this.db) return;

    const transaction = this.db.transaction(['data', 'syncQueue', 'media'], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('data').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('syncQueue').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore('media').clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);

    this.syncQueue = [];
    console.log('🗑️ All offline data cleared');
  }

  // Getters
  get isInitialized(): boolean {
    return this.db !== null;
  }

  get queueLength(): number {
    return this.syncQueue.length;
  }

  get isOnlineStatus(): boolean {
    return this.isOnline;
  }
}

// Export singleton instance
export const offlineStorageService = new OfflineStorageService();

export default offlineStorageService;
