import type { Project, Business, User, ProjectTask, ProjectPhoto, ProjectDocument, Review } from './dataService';

// Sample data for demonstration when Supabase is not configured
const sampleUser: User = {
  id: 'demo-user-1',
  email: 'demo@example.com',
  name: 'Demo User',
  role: 'business_owner',
  is_2fa_enabled: false,
  avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
  phone: '+1 (555) 123-4567',
  metadata: {
    timezone: 'America/New_York',
    notifications: { email: true, sms: false, push: true }
  },
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  last_login: '2024-01-20T10:00:00Z',
  email_verified: true,
  phone_verified: false
};

const sampleBusinesses: Business[] = [
  {
    id: 'demo-business-1',
    owner_id: 'demo-user-1',
    name: 'Tony\'s Italian Restaurant',
    description: 'Authentic Italian cuisine in the heart of downtown',
    address: {
      street: '456 Main Street',
      city: 'Boston',
      state: 'MA',
      zipCode: '02101',
      country: 'USA',
      coordinates: { lat: 42.3601, lng: -71.0589 }
    },
    phone: '+1 (617) 555-0123',
    email: 'info@tonysitalian.com',
    website: 'https://tonysitalian.com',
    category: 'restaurant',
    subcategory: 'Italian Restaurant',
    google_place_id: 'ChIJN1t_tDeuEmsRUsoyG83frY4',
    business_hours: {
      monday: { open: '11:00', close: '22:00', closed: false },
      tuesday: { open: '11:00', close: '22:00', closed: false },
      wednesday: { open: '11:00', close: '22:00', closed: false },
      thursday: { open: '11:00', close: '22:00', closed: false },
      friday: { open: '11:00', close: '23:00', closed: false },
      saturday: { open: '11:00', close: '23:00', closed: false },
      sunday: { open: '12:00', close: '21:00', closed: false }
    },
    social_media: {
      instagram: 'https://instagram.com/tonysitalian',
      yelp: 'https://yelp.com/biz/tonys-italian-restaurant'
    },
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'demo-business-2',
    owner_id: 'demo-user-1',
    name: 'Precision Auto Repair',
    description: 'Professional automotive repair and maintenance services',
    address: {
      street: '789 Industrial Parkway',
      city: 'Chicago',
      state: 'IL',
      zipCode: '60607',
      country: 'USA',
      coordinates: { lat: 41.8781, lng: -87.6298 }
    },
    phone: '+1 (312) 555-0456',
    email: 'service@precisionauto.com',
    website: 'https://precisionauto.com',
    category: 'automotive',
    subcategory: 'Auto Repair Shop',
    business_hours: {
      monday: { open: '08:00', close: '17:00', closed: false },
      tuesday: { open: '08:00', close: '17:00', closed: false },
      wednesday: { open: '08:00', close: '17:00', closed: false },
      thursday: { open: '08:00', close: '17:00', closed: false },
      friday: { open: '08:00', close: '17:00', closed: false },
      saturday: { open: '09:00', close: '15:00', closed: false },
      sunday: { open: '00:00', close: '00:00', closed: true }
    },
    status: 'active',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  }
];

const sampleProjects: Project[] = [
  {
    id: 'demo-project-1',
    business_id: 'demo-business-1',
    name: 'Local SEO Optimization Campaign',
    description: 'Comprehensive local SEO strategy to improve online visibility and drive more foot traffic',
    type: 'local_optimization',
    status: 'active',
    priority: 'high',
    assigned_to: 'demo-user-1',
    client_contact: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567'
    },
    objectives: [
      'Improve local search rankings for key terms',
      'Increase Google My Business visibility',
      'Build high-quality local citations',
      'Generate more positive customer reviews'
    ],
    deliverables: [
      'Keyword research and strategy',
      'Google My Business optimization',
      'Local citation building',
      'Review management setup',
      'Monthly progress reports'
    ],
    timeline: {
      start_date: '2024-01-15',
      end_date: '2024-06-15',
      milestones: [
        { name: 'Initial audit complete', date: '2024-01-30' },
        { name: 'GMB optimization', date: '2024-02-15' },
        { name: 'Citation building phase 1', date: '2024-03-15' },
        { name: 'Mid-campaign review', date: '2024-04-01' }
      ]
    },
    budget: {
      total: 15000,
      spent: 6000,
      currency: 'USD'
    },
    seo_targets: {
      target_keywords: ['italian restaurant boston', 'best pasta boston', 'authentic italian food'],
      current_rankings: { 'italian restaurant boston': 8, 'best pasta boston': 15 },
      target_rankings: { 'italian restaurant boston': 3, 'best pasta boston': 5 }
    },
    progress: { percentage: 65 },
    created_at: '2024-01-15T09:00:00Z',
    updated_at: '2024-01-20T15:30:00Z',
    started_at: '2024-01-15T09:00:00Z',
    due_date: '2024-06-15T17:00:00Z'
  },
  {
    id: 'demo-project-2',
    business_id: 'demo-business-2',
    name: 'Technical SEO Audit & Optimization',
    description: 'Comprehensive technical SEO audit and implementation of critical fixes',
    type: 'technical_seo',
    status: 'in_progress',
    priority: 'medium',
    assigned_to: 'demo-user-1',
    client_contact: {
      name: 'Mike Chen',
      email: 'mike.chen@example.com',
      phone: '+1 (555) 456-7890'
    },
    objectives: [
      'Identify and fix technical SEO issues',
      'Improve website speed and performance',
      'Enhance mobile responsiveness',
      'Implement structured data markup'
    ],
    progress: { percentage: 40 },
    created_at: '2024-02-01T09:00:00Z',
    updated_at: '2024-02-10T11:20:00Z',
    started_at: '2024-02-01T09:00:00Z',
    due_date: '2024-05-01T17:00:00Z'
  },
  {
    id: 'demo-project-3',
    business_id: 'demo-business-1',
    name: 'Content Marketing Strategy',
    description: 'Develop and implement a comprehensive content marketing strategy',
    type: 'content_marketing',
    status: 'completed',
    priority: 'medium',
    assigned_to: 'demo-user-1',
    client_contact: {
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1 (555) 123-4567'
    },
    objectives: [
      'Create engaging blog content',
      'Develop social media strategy',
      'Increase brand awareness'
    ],
    progress: { percentage: 100 },
    created_at: '2023-12-01T09:00:00Z',
    updated_at: '2024-01-15T17:00:00Z',
    started_at: '2023-12-01T09:00:00Z',
    completed_at: '2024-01-15T17:00:00Z',
    due_date: '2024-01-15T17:00:00Z'
  }
];

/**
 * FallbackDataService provides demo data when Supabase is not configured.
 * This allows the application to run in demo mode for showcasing purposes.
 */
export class FallbackDataService {
  private static instance: FallbackDataService;
  private currentUser: User | null = sampleUser;

  static getInstance(): FallbackDataService {
    if (!FallbackDataService.instance) {
      FallbackDataService.instance = new FallbackDataService();
    }
    return FallbackDataService.instance;
  }

  // Auth methods
  async getCurrentUser(): Promise<User | null> {
    return this.currentUser;
  }

  async signIn(email: string, password: string) {
    // Simulate successful login
    return {
      user: sampleUser,
      session: { access_token: 'demo-token', refresh_token: 'demo-refresh' }
    };
  }

  async signUp(email: string, password: string, name: string, role: string = 'business_owner') {
    // Simulate successful signup
    const newUser = {
      ...sampleUser,
      email,
      name,
      role: role as any
    };
    this.currentUser = newUser;
    return {
      user: newUser,
      session: { access_token: 'demo-token', refresh_token: 'demo-refresh' }
    };
  }

  async signOut() {
    this.currentUser = null;
  }

  // Business methods
  async getBusinesses(ownerId?: string): Promise<Business[]> {
    return sampleBusinesses;
  }

  async getBusiness(id: string): Promise<Business | null> {
    return sampleBusinesses.find(b => b.id === id) || null;
  }

  async createBusiness(business: Partial<Business>): Promise<Business> {
    const newBusiness: Business = {
      id: `demo-business-${Date.now()}`,
      owner_id: this.currentUser?.id || 'demo-user-1',
      name: business.name || 'New Business',
      description: business.description,
      address: business.address || {},
      phone: business.phone || '',
      email: business.email || '',
      website: business.website,
      category: business.category || 'other',
      subcategory: business.subcategory,
      status: 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    sampleBusinesses.push(newBusiness);
    return newBusiness;
  }

  async updateBusiness(id: string, updates: Partial<Business>): Promise<Business> {
    const index = sampleBusinesses.findIndex(b => b.id === id);
    if (index === -1) throw new Error('Business not found');
    
    sampleBusinesses[index] = {
      ...sampleBusinesses[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    return sampleBusinesses[index];
  }

  async deleteBusiness(id: string): Promise<void> {
    const index = sampleBusinesses.findIndex(b => b.id === id);
    if (index !== -1) {
      sampleBusinesses.splice(index, 1);
    }
  }

  // Project methods
  async getProjects(businessId?: string, filters: any = {}): Promise<Project[]> {
    let projects = [...sampleProjects];
    
    if (businessId) {
      projects = projects.filter(p => p.business_id === businessId);
    }
    
    // Apply filters
    if (filters.status) {
      projects = projects.filter(p => p.status === filters.status);
    }
    
    if (filters.assigned_to) {
      projects = projects.filter(p => p.assigned_to === filters.assigned_to);
    }
    
    return projects;
  }

  async getProject(id: string): Promise<Project | null> {
    return sampleProjects.find(p => p.id === id) || null;
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    const newProject: Project = {
      id: `demo-project-${Date.now()}`,
      business_id: project.business_id || 'demo-business-1',
      name: project.name || 'New Project',
      description: project.description || '',
      type: project.type || 'local_optimization',
      status: project.status || 'draft',
      priority: project.priority || 'medium',
      assigned_to: project.assigned_to,
      client_contact: project.client_contact,
      objectives: project.objectives,
      deliverables: project.deliverables,
      timeline: project.timeline,
      budget: project.budget,
      seo_targets: project.seo_targets,
      progress: { percentage: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      started_at: project.started_at,
      due_date: project.due_date
    };
    
    sampleProjects.push(newProject);
    return newProject;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    const index = sampleProjects.findIndex(p => p.id === id);
    if (index === -1) throw new Error('Project not found');
    
    sampleProjects[index] = {
      ...sampleProjects[index],
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    return sampleProjects[index];
  }

  async deleteProject(id: string): Promise<void> {
    const index = sampleProjects.findIndex(p => p.id === id);
    if (index !== -1) {
      sampleProjects.splice(index, 1);
    }
  }

  // Project Task methods
  async getProjectTasks(projectId: string): Promise<ProjectTask[]> {
    // Return sample tasks for the project
    return [
      {
        id: 'demo-task-1',
        project_id: projectId,
        title: 'Complete keyword research analysis',
        description: 'Research and analyze target keywords for local search optimization',
        status: 'completed',
        priority: 'high',
        assigned_to: 'demo-user-1',
        assigned_by: 'demo-user-1',
        estimated_hours: 8,
        actual_hours: 6.5,
        due_date: '2024-01-25T17:00:00Z',
        started_at: '2024-01-20T09:00:00Z',
        completed_at: '2024-01-24T15:30:00Z',
        progress_percentage: 100,
        labels: ['research', 'keywords', 'high-priority'],
        created_at: '2024-01-20T09:00:00Z',
        updated_at: '2024-01-24T15:30:00Z'
      }
    ];
  }

  async createProjectTask(task: Partial<ProjectTask>): Promise<ProjectTask> {
    const newTask: ProjectTask = {
      id: `demo-task-${Date.now()}`,
      project_id: task.project_id || '',
      title: task.title || 'New Task',
      description: task.description,
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      assigned_to: task.assigned_to,
      assigned_by: task.assigned_by,
      estimated_hours: task.estimated_hours,
      actual_hours: task.actual_hours,
      due_date: task.due_date,
      started_at: task.started_at,
      completed_at: task.completed_at,
      dependencies: task.dependencies,
      labels: task.labels || [],
      progress_percentage: task.progress_percentage || 0,
      metadata: task.metadata,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return newTask;
  }

  async updateProjectTask(id: string, updates: Partial<ProjectTask>): Promise<ProjectTask> {
    // Simulate update
    return {
      id,
      ...updates,
      updated_at: new Date().toISOString()
    } as ProjectTask;
  }

  async deleteProjectTask(id: string): Promise<void> {
    // Simulate deletion
  }

  // Project Photo methods
  async getProjectPhotos(projectId: string): Promise<ProjectPhoto[]> {
    return [];
  }

  async uploadProjectPhoto(projectId: string, file: File, metadata: any = {}): Promise<ProjectPhoto> {
    const newPhoto: ProjectPhoto = {
      id: `demo-photo-${Date.now()}`,
      project_id: projectId,
      filename: file.name,
      original_name: file.name,
      file_path: URL.createObjectURL(file),
      file_size: file.size,
      mime_type: file.type,
      category: metadata.category || 'general',
      description: metadata.description,
      is_featured: metadata.is_featured || false,
      uploaded_by: 'demo-user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return newPhoto;
  }

  async deleteProjectPhoto(id: string): Promise<void> {
    // Simulate deletion
  }

  // Project Document methods
  async getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
    return [];
  }

  async uploadProjectDocument(projectId: string, file: File, metadata: any = {}): Promise<ProjectDocument> {
    const newDocument: ProjectDocument = {
      id: `demo-doc-${Date.now()}`,
      project_id: projectId,
      filename: file.name,
      original_name: file.name,
      file_path: URL.createObjectURL(file),
      file_size: file.size,
      mime_type: file.type,
      document_type: metadata.document_type || 'general',
      description: metadata.description,
      tags: metadata.tags || [],
      version: metadata.version || 1,
      is_final: metadata.is_final || false,
      access_level: metadata.access_level || 'team',
      uploaded_by: 'demo-user-1',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return newDocument;
  }

  async deleteProjectDocument(id: string): Promise<void> {
    // Simulate deletion
  }

  // Review methods
  async getReviews(businessId: string): Promise<Review[]> {
    return [
      {
        id: 'demo-review-1',
        business_id: businessId,
        platform: 'google',
        platform_review_id: 'google_review_123456',
        rating: 5,
        title: 'Amazing authentic Italian food!',
        text: 'Tony\'s has the best pasta in Boston! The atmosphere is cozy and the service is excellent.',
        author: {
          name: 'Jennifer Smith',
          profile_photo: 'https://images.unsplash.com/photo-1494790108755-2616b3ecbfde?w=50&h=50&fit=crop&crop=face'
        },
        date: '2024-01-20T19:30:00Z',
        response: {
          text: 'Thank you so much Jennifer! We\'re thrilled you enjoyed your dining experience.',
          date: '2024-01-21T10:00:00Z'
        },
        is_verified: true,
        is_featured: true,
        created_at: '2024-01-20T19:30:00Z',
        updated_at: '2024-01-21T10:00:00Z'
      }
    ];
  }

  async createReview(review: Partial<Review>): Promise<Review> {
    const newReview: Review = {
      id: `demo-review-${Date.now()}`,
      business_id: review.business_id || '',
      platform: review.platform || 'google',
      rating: review.rating || 5,
      text: review.text || '',
      date: review.date || new Date().toISOString(),
      is_verified: review.is_verified || false,
      is_featured: review.is_featured || false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    return newReview;
  }

  // Analytics methods
  async getAnalytics(businessId: string, dateRange?: { start: string; end: string }) {
    // Return sample analytics data
    const days = 30;
    const data = [];
    
    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      
      data.push({
        id: `demo-analytics-${i}`,
        business_id: businessId,
        metric_type: 'organic_traffic',
        metric_name: 'Daily Organic Sessions',
        value: Math.floor(Math.random() * 100) + 50,
        date: date.toISOString().split('T')[0],
        data_source: 'google_analytics',
        created_at: date.toISOString()
      });
    }
    
    return data;
  }

  // Dashboard summary methods
  async getDashboardSummary(userId?: string) {
    return {
      user_id: userId || 'demo-user-1',
      total_businesses: sampleBusinesses.length,
      total_projects: sampleProjects.length,
      agency_memberships: 0,
      active_projects: sampleProjects.filter(p => p.status === 'active' || p.status === 'in_progress').length,
      critical_alerts: 0
    };
  }

  async getBusinessPerformanceSummary(businessId: string) {
    return {
      business_id: businessId,
      business_name: sampleBusinesses.find(b => b.id === businessId)?.name || 'Unknown',
      total_projects: sampleProjects.filter(p => p.business_id === businessId).length,
      total_reviews: 5,
      avg_rating: 4.8,
      total_citations: 15,
      verified_citations: 12,
      tracked_keywords: 25,
      avg_ranking_position: 8.5,
      active_alerts: 2
    };
  }

  async getProjectActivitySummary(projectId: string) {
    const project = sampleProjects.find(p => p.id === projectId);
    return {
      project_id: projectId,
      project_name: project?.name || 'Unknown',
      status: project?.status || 'unknown',
      priority: project?.priority || 'medium',
      total_tasks: 5,
      completed_tasks: 3,
      active_tasks: 2,
      overdue_tasks: 0,
      total_photos: 10,
      total_documents: 3,
      total_notes: 8,
      last_activity: new Date().toISOString()
    };
  }
}

export const fallbackDataService = FallbackDataService.getInstance();
