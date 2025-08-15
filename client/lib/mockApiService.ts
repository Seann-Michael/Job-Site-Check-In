// Simple mock API service that returns static data
// This replaces the Supabase-dependent dataService for demo purposes

export interface Project {
  id: string;
  business_id: string;
  name: string;
  description: string;
  type: 'renovation' | 'landscaping' | 'cleaning' | 'maintenance' | 'construction' | 'repair' | 'improvement' | 'other';
  status: 'planning' | 'in_progress' | 'review' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigned_to?: string;
  client_contact?: {
    name: string;
    email: string;
    phone: string;
  };
  location: string;
  before_photos?: string[];
  after_photos?: string[];
  progress_photos?: string[];
  notes?: string;
  estimated_completion?: string;
  actual_completion?: string;
  cost_estimate?: number;
  actual_cost?: number;
  materials_used?: string[];
  crew_members?: string[];
  weather_conditions?: string;
  created_at: string;
  updated_at: string;
  started_at?: string;
  completed_at?: string;
  due_date?: string;
}

export interface Business {
  id: string;
  owner_id: string;
  name: string;
  description?: string;
  address: any;
  phone: string;
  email: string;
  website?: string;
  category: string;
  subcategory?: string;
  google_place_id?: string;
  google_my_business?: any;
  business_hours?: any;
  social_media?: any;
  metadata?: any;
  status: 'active' | 'inactive' | 'pending_verification' | 'suspended' | 'deleted';
  created_at: string;
  updated_at: string;
  verified_at?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'super_admin' | 'agency_admin' | 'business_owner' | 'staff' | 'viewer';
  is_2fa_enabled: boolean;
  avatar_url?: string;
  phone?: string;
  metadata?: any;
  created_at: string;
  updated_at: string;
  last_login?: string;
  email_verified: boolean;
  phone_verified: boolean;
}

// Mock data
const mockBusinesses: Business[] = [
  {
    id: "business-1",
    owner_id: "user-1",
    name: "Downtown Coffee Shop",
    description: "Local coffee shop serving artisanal coffee and pastries",
    address: {
      street: "123 Main St",
      city: "Downtown",
      state: "CA",
      zip: "90210"
    },
    phone: "(555) 123-4567",
    email: "info@downtowncoffee.com",
    website: "https://downtowncoffee.com",
    category: "Food & Beverage",
    subcategory: "Coffee Shop",
    status: "active",
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z"
  },
  {
    id: "business-2",
    owner_id: "user-1",
    name: "Tech Repair Solutions",
    description: "Computer and phone repair services",
    address: {
      street: "456 Tech Blvd",
      city: "Silicon Valley",
      state: "CA",
      zip: "94043"
    },
    phone: "(555) 987-6543",
    email: "support@techrepair.com",
    website: "https://techrepair.com",
    category: "Technology",
    subcategory: "Repair Services",
    status: "active",
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z"
  },
  {
    id: "business-3",
    owner_id: "user-1",
    name: "Green Thumb Landscaping",
    description: "Professional landscaping and garden design",
    address: {
      street: "789 Garden Way",
      city: "Suburbia",
      state: "CA",
      zip: "91210"
    },
    phone: "(555) 456-7890",
    email: "contact@greenthumb.com",
    website: "https://greenthumb.com",
    category: "Home & Garden",
    subcategory: "Landscaping",
    status: "active",
    created_at: "2024-01-03T00:00:00Z",
    updated_at: "2024-01-03T00:00:00Z"
  }
];

const mockProjects: Project[] = [
  {
    id: "project-1",
    business_id: "business-1",
    name: "Coffee Shop Interior Renovation",
    description: "Complete interior renovation including new flooring, lighting, and seating area",
    type: "renovation",
    status: "in_progress",
    priority: "high",
    assigned_to: "user-1",
    client_contact: {
      name: "John Doe",
      email: "john@downtowncoffee.com",
      phone: "(555) 123-4567"
    },
    location: "123 Main St, Downtown, CA 90210",
    before_photos: ["/photos/coffee-before-1.jpg", "/photos/coffee-before-2.jpg"],
    progress_photos: ["/photos/coffee-progress-1.jpg"],
    notes: "Installing new hardwood floors and LED lighting system",
    estimated_completion: "2024-02-10",
    cost_estimate: 15000,
    materials_used: ["Hardwood flooring", "LED fixtures", "Paint"],
    crew_members: ["Mike Johnson", "Sarah Davis"],
    created_at: "2024-01-10T00:00:00Z",
    updated_at: "2024-01-15T00:00:00Z",
    due_date: "2024-02-10T00:00:00Z"
  },
  {
    id: "project-2",
    business_id: "business-2",
    name: "Storefront Window Repair",
    description: "Replace damaged storefront windows and improve entrance accessibility",
    type: "repair",
    status: "planning",
    priority: "medium",
    assigned_to: "user-1",
    client_contact: {
      name: "Jane Smith",
      email: "jane@techrepair.com",
      phone: "(555) 987-6543"
    },
    location: "456 Tech Blvd, Silicon Valley, CA 94043",
    before_photos: ["/photos/storefront-before.jpg"],
    notes: "Need to replace 3 large windows and install automatic door",
    estimated_completion: "2024-02-15",
    cost_estimate: 8500,
    materials_used: ["Tempered glass", "Aluminum frames", "Automatic door system"],
    created_at: "2024-01-12T00:00:00Z",
    updated_at: "2024-01-18T00:00:00Z",
    due_date: "2024-02-15T00:00:00Z"
  },
  {
    id: "project-3",
    business_id: "business-3",
    name: "Garden Redesign Project",
    description: "Complete landscape redesign with new plantings and irrigation system",
    type: "landscaping",
    status: "review",
    priority: "low",
    assigned_to: "user-1",
    client_contact: {
      name: "Bob Johnson",
      email: "bob@greenthumb.com",
      phone: "(555) 456-7890"
    },
    location: "789 Garden Way, Suburbia, CA 91210",
    before_photos: ["/photos/garden-before-1.jpg", "/photos/garden-before-2.jpg"],
    after_photos: ["/photos/garden-after-1.jpg"],
    notes: "Installed new irrigation system and native plants",
    actual_completion: "2024-01-28",
    cost_estimate: 12000,
    actual_cost: 11500,
    materials_used: ["Native plants", "Drip irrigation", "Mulch", "Decorative stones"],
    crew_members: ["Tom Wilson", "Lisa Brown"],
    weather_conditions: "Sunny, 72°F",
    created_at: "2024-01-14T00:00:00Z",
    updated_at: "2024-01-28T00:00:00Z",
    completed_at: "2024-01-28T00:00:00Z"
  },
  {
    id: "project-4",
    business_id: "business-1",
    name: "Kitchen Deep Cleaning",
    description: "Professional deep cleaning of commercial kitchen equipment and surfaces",
    type: "cleaning",
    status: "completed",
    priority: "medium",
    assigned_to: "user-1",
    location: "123 Main St, Downtown, CA 90210 - Kitchen Area",
    before_photos: ["/photos/kitchen-before.jpg"],
    after_photos: ["/photos/kitchen-after.jpg"],
    notes: "All equipment sanitized and floors deep cleaned",
    actual_completion: "2024-01-25",
    cost_estimate: 800,
    actual_cost: 750,
    materials_used: ["Industrial cleaners", "Sanitizers"],
    crew_members: ["Maria Garcia"],
    created_at: "2024-01-05T00:00:00Z",
    updated_at: "2024-01-25T00:00:00Z",
    completed_at: "2024-01-25T00:00:00Z"
  },
  {
    id: "project-5",
    business_id: "business-2",
    name: "HVAC System Maintenance",
    description: "Annual HVAC system maintenance and filter replacement",
    type: "maintenance",
    status: "in_progress",
    priority: "urgent",
    assigned_to: "user-1",
    location: "456 Tech Blvd, Silicon Valley, CA 94043 - Roof Unit",
    before_photos: ["/photos/hvac-before.jpg"],
    progress_photos: ["/photos/hvac-progress.jpg"],
    notes: "Replacing filters and checking refrigerant levels",
    estimated_completion: "2024-02-05",
    cost_estimate: 500,
    materials_used: ["HVAC filters", "Refrigerant"],
    crew_members: ["Dave Thompson"],
    created_at: "2024-01-08T00:00:00Z",
    updated_at: "2024-01-22T00:00:00Z"
  }
];

const mockUsers: User[] = [
  {
    id: "user-1",
    email: "admin@example.com",
    name: "Admin User",
    role: "super_admin",
    is_2fa_enabled: false,
    email_verified: true,
    phone_verified: false,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-01-01T00:00:00Z"
  },
  {
    id: "user-2",
    email: "manager@example.com",
    name: "Project Manager",
    role: "agency_admin",
    is_2fa_enabled: true,
    email_verified: true,
    phone_verified: true,
    created_at: "2024-01-02T00:00:00Z",
    updated_at: "2024-01-02T00:00:00Z"
  }
];

class MockApiService {
  // Simulate API delay
  private async delay(ms: number = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getBusinesses(): Promise<Business[]> {
    await this.delay();
    console.log("MockApiService: Fetched businesses", mockBusinesses.length);
    return [...mockBusinesses];
  }

  async getUsers(): Promise<User[]> {
    await this.delay();
    console.log("MockApiService: Fetched users", mockUsers.length);
    return [...mockUsers];
  }

  async getProjects(businessId?: string): Promise<Project[]> {
    await this.delay();
    let projects = [...mockProjects];
    
    if (businessId) {
      projects = projects.filter(p => p.business_id === businessId);
    }
    
    console.log("MockApiService: Fetched projects", projects.length, businessId ? `for business ${businessId}` : '');
    return projects;
  }

  async getProject(id: string): Promise<Project | null> {
    await this.delay();
    const project = mockProjects.find(p => p.id === id) || null;
    console.log("MockApiService: Fetched project", id, project ? 'found' : 'not found');
    return project;
  }

  async deleteProject(id: string): Promise<void> {
    await this.delay();
    console.log("MockApiService: Deleted project", id);
    // In a real implementation, this would remove from the array
    // For now, just log it
  }

  async createProject(project: Partial<Project>): Promise<Project> {
    await this.delay();
    const newProject: Project = {
      id: `project-${Date.now()}`,
      business_id: project.business_id || 'business-1',
      name: project.name || 'New Project',
      description: project.description || '',
      type: project.type || 'seo_audit',
      status: project.status || 'draft',
      priority: project.priority || 'medium',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...project
    };
    console.log("MockApiService: Created project", newProject.id);
    return newProject;
  }

  async updateProject(id: string, updates: Partial<Project>): Promise<Project> {
    await this.delay();
    const project = mockProjects.find(p => p.id === id);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const updatedProject = {
      ...project,
      ...updates,
      updated_at: new Date().toISOString()
    };
    
    console.log("MockApiService: Updated project", id);
    return updatedProject;
  }
}

// Export singleton instance
export const mockApiService = new MockApiService();
