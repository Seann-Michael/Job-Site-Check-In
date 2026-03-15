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
    return Array.isArray(result) ? result : result.data;
  }

  async getBusinesses(ownerId?: string): Promise<Business[]> {
    const result = await dataService.getBusinesses(ownerId, {});
    return Array.isArray(result) ? result : result.data;
  }

  async getUsers(): Promise<User[]> {
    const result = await dataService.getUsers({});
    return Array.isArray(result) ? result : result.data;
  }

  // Paginated methods
  async getProjectsPaginated(businessId?: string, filters?: any) {
    return await dataService.getProjects(businessId, filters);
  }

  async getBusinessesPaginated(ownerId?: string, filters?: any) {
    return await dataService.getBusinesses(ownerId, filters);
  }

  async getUsersPaginated(filters?: any) {
    return await dataService.getUsers(filters);
  }

  // Pass through all other methods
  async getCurrentUser() { return await dataService.getCurrentUser(); }
  async getBusiness(id: string) { return await dataService.getBusiness(id); }
  async getProject(id: string) { return await dataService.getProject(id); }
  async createBusiness(business: any) { return await dataService.createBusiness(business); }
  async updateBusiness(id: string, updates: any) { return await dataService.updateBusiness(id, updates); }
  async deleteBusiness(id: string) { return await dataService.deleteBusiness(id); }
  async createProject(project: any) { return await dataService.createProject(project); }
  async updateProject(id: string, updates: any) { return await dataService.updateProject(id, updates); }
  async deleteProject(id: string) { return await dataService.deleteProject(id); }
  async getProjectPhotos(projectId: string) {
    return await dataService.getProjectPhotos(projectId);
  }
  async uploadProjectPhoto(projectId: string, file: File, metadata: any) {
    return await dataService.uploadProjectPhoto(projectId, file, metadata);
  }
  async deleteProjectPhoto(id: string) {
    return await dataService.deleteProjectPhoto(id);
  }
  async updateProjectMedia(id: string, updates: any) {
    return await dataService.updateProjectMedia(id, updates);
  }
  async setFeaturedMedia(projectId: string, mediaId: string) {
    return await dataService.setFeaturedMedia(projectId, mediaId);
  }
  async clearFeaturedMedia(mediaId: string) {
    return await dataService.clearFeaturedMedia(mediaId);
  }
  async getFeaturedMediaForProjects(projectIds: string[]): Promise<Record<string, string>> {
    return await dataService.getFeaturedMediaForProjects(projectIds);
  }
  async getProjectDocuments(projectId: string) { return await dataService.getProjectDocuments(projectId); }
  async uploadProjectDocument(projectId: string, file: File, metadata?: any) { return await dataService.uploadProjectDocument(projectId, file, metadata); }
  async uploadClientDocument(clientId: string, file: File, metadata?: any) { return await dataService.uploadClientDocument(clientId, file, metadata); }
  async getClientDocuments(clientId: string) { return await dataService.getClientDocuments(clientId); }
  async deleteProjectDocument(id: string) { return await dataService.deleteProjectDocument(id); }
  async signIn(email: string, password: string) { return await dataService.signIn(email, password); }
  async signUp(email: string, password: string, name: string, role?: string) {
    return await dataService.signUp(email, password, name, role);
  }
  async signOut() { return await dataService.signOut(); }
}

export const compatibleDataService = new CompatibleDataService();
export default compatibleDataService;
