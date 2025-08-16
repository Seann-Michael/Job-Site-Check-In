import { supabase } from "@/lib/dataService";

export interface AuditLogEntry {
  id?: string;
  table_name: string;
  operation: 'INSERT' | 'UPDATE' | 'DELETE' | 'SELECT' | 'CUSTOM';
  user_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  metadata?: Record<string, any>;
  description?: string;
  created_at?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  type: 'Added' | 'Changed' | 'Fixed' | 'Removed' | 'Security';
  description: string;
  technical_details?: string;
  author?: string;
}

class AuditLogService {
  private readonly MAX_LOGS = 200;

  /**
   * Log a system change to the audit log
   */
  async logChange(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<void> {
    try {
      const { error } = await supabase
        .from('audit_logs')
        .insert([{
          ...entry,
          created_at: new Date().toISOString(),
        }]);

      if (error) {
        console.error('Failed to log audit entry:', error);
        throw error;
      }

      // Clean up old logs to maintain max count
      await this.cleanupOldLogs();
    } catch (error) {
      console.error('Audit log error:', error);
      // Don't throw - audit logging should not break main functionality
    }
  }

  /**
   * Log a database operation change
   */
  async logDatabaseChange(
    tableName: string,
    operation: AuditLogEntry['operation'],
    userId?: string,
    oldValues?: Record<string, any>,
    newValues?: Record<string, any>,
    description?: string
  ): Promise<void> {
    await this.logChange({
      table_name: tableName,
      operation,
      user_id: userId,
      old_values: oldValues,
      new_values: newValues,
      description,
    });
  }

  /**
   * Log a custom system event
   */
  async logSystemEvent(
    event: string,
    description: string,
    userId?: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.logChange({
      table_name: 'system_events',
      operation: 'CUSTOM',
      user_id: userId,
      description,
      metadata,
    });
  }

  /**
   * Log user actions
   */
  async logUserAction(
    action: string,
    userId: string,
    details?: Record<string, any>,
    description?: string
  ): Promise<void> {
    await this.logChange({
      table_name: 'user_actions',
      operation: 'CUSTOM',
      user_id: userId,
      new_values: details,
      description: description || action,
      metadata: { action_type: action },
    });
  }

  /**
   * Get recent audit logs
   */
  async getRecentLogs(limit = 50): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch audit logs:', error);
      return [];
    }

    return (data as unknown as AuditLogEntry[]) || [];
  }

  /**
   * Get logs for a specific table
   */
  async getTableLogs(tableName: string, limit = 20): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('table_name', tableName)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch table logs:', error);
      return [];
    }

    return (data as unknown as AuditLogEntry[]) || [];
  }

  /**
   * Get logs for a specific user
   */
  async getUserLogs(userId: string, limit = 20): Promise<AuditLogEntry[]> {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Failed to fetch user logs:', error);
      return [];
    }

    return (data as unknown as AuditLogEntry[]) || [];
  }

  /**
   * Clean up old logs to maintain the maximum count
   */
  private async cleanupOldLogs(): Promise<void> {
    try {
      // Get count of current logs
      const { count, error: countError } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true });

      if (countError || !count) {
        return;
      }

      // If we exceed the limit, delete the oldest logs
      if (count > this.MAX_LOGS) {
        const excessCount = count - this.MAX_LOGS;
        
        // Get the oldest log IDs to delete
        const { data: oldestLogs, error: fetchError } = await supabase
          .from('audit_logs')
          .select('id')
          .order('created_at', { ascending: true })
          .limit(excessCount);

        if (fetchError || !oldestLogs) {
          return;
        }

        const idsToDelete = oldestLogs.map(log => log.id);
        
        const { error: deleteError } = await supabase
          .from('audit_logs')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('Failed to cleanup old audit logs:', deleteError);
        }
      }
    } catch (error) {
      console.error('Audit log cleanup error:', error);
    }
  }

  /**
   * Add a changelog entry
   */
  async addChangelogEntry(entry: ChangelogEntry): Promise<void> {
    await this.logChange({
      table_name: 'changelog',
      operation: 'INSERT',
      new_values: entry,
      description: `Changelog: ${entry.type} - ${entry.description}`,
      metadata: {
        version: entry.version,
        type: entry.type,
        author: entry.author,
      },
    });
  }

  /**
   * Helper method to log common project operations
   */
  async logProjectChange(
    projectId: string,
    operation: 'create' | 'update' | 'delete' | 'status_change',
    userId?: string,
    oldData?: any,
    newData?: any
  ): Promise<void> {
    const descriptions = {
      create: 'Project created',
      update: 'Project updated', 
      delete: 'Project deleted',
      status_change: 'Project status changed',
    };

    await this.logDatabaseChange(
      'projects',
      operation === 'create' ? 'INSERT' : 
      operation === 'delete' ? 'DELETE' : 'UPDATE',
      userId,
      oldData,
      newData,
      descriptions[operation]
    );
  }

  /**
   * Helper method to log geo grid ranking operations
   */
  async logGeoGridScan(
    keyword: string,
    location: string,
    businessName: string,
    results: any,
    userId?: string
  ): Promise<void> {
    await this.logSystemEvent(
      'geo_grid_scan',
      `Geo grid scan completed for "${keyword}" in ${location}`,
      userId,
      {
        keyword,
        location,
        business_name: businessName,
        results_count: results?.total_results || 0,
        average_ranking: results?.average_ranking || 0,
        credits_used: results?.credits_used || 0,
      }
    );
  }

  /**
   * Helper method to log bulk actions
   */
  async logBulkAction(
    action: 'compare' | 'share' | 'download' | 'archive',
    itemCount: number,
    userId?: string,
    details?: Record<string, any>
  ): Promise<void> {
    await this.logUserAction(
      `bulk_${action}`,
      userId || 'anonymous',
      {
        action,
        item_count: itemCount,
        ...details,
      },
      `Bulk ${action} performed on ${itemCount} items`
    );
  }
}

// Export singleton instance
export const auditLog = new AuditLogService();

// Export utility functions for common operations
export const logDatabaseChange = auditLog.logDatabaseChange.bind(auditLog);
export const logSystemEvent = auditLog.logSystemEvent.bind(auditLog);
export const logUserAction = auditLog.logUserAction.bind(auditLog);
export const logProjectChange = auditLog.logProjectChange.bind(auditLog);
export const logGeoGridScan = auditLog.logGeoGridScan.bind(auditLog);
export const logBulkAction = auditLog.logBulkAction.bind(auditLog);

// Hook for automatically logging changes
export const useAuditLog = () => {
  return {
    logChange: auditLog.logChange.bind(auditLog),
    logDatabaseChange,
    logSystemEvent,
    logUserAction,
    logProjectChange,
    logGeoGridScan,
    logBulkAction,
    getRecentLogs: auditLog.getRecentLogs.bind(auditLog),
    getTableLogs: auditLog.getTableLogs.bind(auditLog),
    getUserLogs: auditLog.getUserLogs.bind(auditLog),
  };
};
