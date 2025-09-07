// Backward-compatible wrapper for dataService to handle pagination changes
import { dataService, Project, Business, User } from './dataService';

/**
 * Compatibility wrapper for dataService that maintains backward compatibility
 * while supporting new pagination features
 */
class CompatibleDataService {
  // Backward-compatible methods that return arrays (for existing code)
  async getProjects(businessId?: string, filters?: any): Promise<Project[]> {
    const result = await dataService.getProjects(businessId, filters);
    // Return just the data array for backward compatibility
    return Array.isArray(result) ? result : result.data;
  }

  async getBusinesses(ownerId?: string): Promise<Business[]> {
    const result = await dataService.getBusinesses(ownerId, {});
    // Return just the data array for backward compatibility
    return Array.isArray(result) ? result : result.data;
  }

  async getUsers(): Promise<User[]> {
    const result = await dataService.getUsers({});
    // Return just the data array for backward compatibility
    return Array.isArray(result) ? result : result.data;
  }

  // New paginated methods that return full response objects
  async getProjectsPaginated(businessId?: string, filters?: any) {
    return await dataService.getProjects(businessId, filters);
  }

  async getBusinessesPaginated(ownerId?: string, filters?: any) {
    return await dataService.getBusinesses(ownerId, filters);
  }

  async getUsersPaginated(filters?: any) {
    return await dataService.getUsers(filters);
  }

  // Pass through all other methods unchanged
  async getCurrentUser() {
    return await dataService.getCurrentUser();
  }

  async getBusiness(id: string) {
    return await dataService.getBusiness(id);
  }

  async getProject(id: string) {
    return await dataService.getProject(id);
  }

  async createBusiness(business: any) {
    return await dataService.createBusiness(business);
  }

  async updateBusiness(id: string, updates: any) {
    return await dataService.updateBusiness(id, updates);
  }

  async deleteBusiness(id: string) {
    return await dataService.deleteBusiness(id);
  }

  async createProject(project: any) {
    return await dataService.createProject(project);
  }

  async updateProject(id: string, updates: any) {
    return await dataService.updateProject(id, updates);
  }

  async uploadProjectPhoto(projectId: string, file: File, metadata: any) {
    return await dataService.uploadProjectPhoto(projectId, file, metadata);
  }

  async signIn(email: string, password: string) {
    return await dataService.signIn(email, password);
  }

  async signUp(email: string, password: string, name: string, role?: string) {
    return await dataService.signUp(email, password, name, role);
  }

  async signOut() {
    return await dataService.signOut();
  }

  // Mock data methods - implemented locally since original methods are private
  getMockProjects() {
    return [
      {
        id: "1",
        business_id: "1",
        name: "SEO Optimization for Local Restaurant",
        description: "Comprehensive SEO strategy to improve local search visibility",
        type: "local_optimization",
        status: "active",
        priority: "high",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];
  }

  getMockBusinesses() {
    return [
      {
        id: "1",
        owner_id: "1",
        name: "Sample Restaurant",
        phone: "(555) 123-4567",
        email: "info@samplerestaurant.com",
        category: "Restaurant",
        address: {},
        status: "active",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];
  }

  getMockUsers() {
    return [
      {
        id: "1",
        email: "user@example.com",
        name: "Sample User",
        role: "business_owner",
        is_2fa_enabled: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        email_verified: true,
        phone_verified: false,
      }
    ];
  }
}

// Export singleton instance for backward compatibility
export const compatibleDataService = new CompatibleDataService();

// Export as default for easy replacement
export default compatibleDataService;
