// Mock Data Service for the Application
// This provides realistic, comprehensive mock data for all features

export interface MockProject {
  id: string;
  name: string;
  description: string;
  address: string;
  customerPhone: string;
  customerEmail: string;
  keywords: string[];
  photos: Array<{
    url: string;
    title?: string;
    description?: string;
    tags: string[];
    uploadedAt: string;
    uploadedBy: string;
    isPrimary?: boolean;
    metadata?: {
      originalFileName: string;
      fileSize: number;
      fileType: string;
      category: string;
      altText: string;
    };
  }>;
  documents: Array<{
    id: string;
    name: string;
    url: string;
    type: string;
    uploadedAt: string;
    uploadedBy: string;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    assignedTo: string;
    dueDate: string;
    status: "pending" | "in-progress" | "completed";
    priority: "low" | "medium" | "high";
  }>;
  checklist: Array<{
    id: string;
    title: string;
    completed: boolean;
    category: string;
  }>;
  notes: Array<{
    id: string;
    content: string;
    createdAt: string;
    createdBy: string;
    type: "general" | "important" | "reminder";
  }>;
  activityLog: Array<{
    id: string;
    action: string;
    description: string;
    timestamp: string;
    user: string;
  }>;
  createdAt: string;
  updatedAt: string;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  assignedUsers: string[];
  starred: boolean;
  archived: boolean;
  createdBy: string;
  estimatedValue?: number;
  actualValue?: number;
  startDate?: string;
  endDate?: string;
  clientType: "residential" | "commercial";
  projectType: "renovation" | "new-construction" | "repair" | "maintenance";
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "project-manager" | "contractor" | "client";
  avatar?: string;
  phone?: string;
  specialties?: string[];
  joinedAt: string;
  isActive: boolean;
}

export interface MockClient {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  company?: string;
  type: "residential" | "commercial";
  projects: string[]; // project IDs
  totalValue: number;
  joinedAt: string;
  lastContact: string;
  preferredContactMethod: "email" | "phone" | "text";
  notes: string;
}

// Generate realistic mock data
const generateMockProjects = (): MockProject[] => {
  const projectNames = [
    "Kitchen Renovation - Smith Residence",
    "Bathroom Remodel - Johnson Home",
    "Deck Construction - Williams Property",
    "Basement Finishing - Davis House",
    "Office Build-out - TechCorp HQ",
    "Restaurant Kitchen Upgrade - Bella Vista",
    "Roof Replacement - Anderson Home",
    "Hardwood Floor Installation - Thompson Residence",
    "Pool Installation - Martinez Family",
    "Sunroom Addition - Garcia House",
  ];

  const addresses = [
    "123 Maple Street, Springfield, IL 62701",
    "456 Oak Avenue, Chicago, IL 60601",
    "789 Pine Road, Naperville, IL 60540",
    "321 Elm Drive, Peoria, IL 61601",
    "654 Cedar Lane, Rockford, IL 61101",
    "147 Walnut Court, Joliet, IL 60431",
    "258 Cherry Street, Evanston, IL 60201",
    "369 Hickory Avenue, Aurora, IL 60502",
    "741 Poplar Boulevard, Decatur, IL 62521",
    "852 Sycamore Place, Quincy, IL 62301",
  ];

  const keywords = [
    ["kitchen", "renovation", "cabinets", "countertops", "appliances"],
    ["bathroom", "remodel", "tile", "vanity", "shower"],
    ["deck", "construction", "outdoor", "wood", "railing"],
    ["basement", "finishing", "flooring", "drywall", "lighting"],
    ["office", "commercial", "build-out", "partition", "electrical"],
    ["restaurant", "kitchen", "commercial", "equipment", "ventilation"],
    ["roof", "replacement", "shingles", "gutters", "exterior"],
    ["hardwood", "flooring", "installation", "refinishing", "stain"],
    ["pool", "installation", "excavation", "liner", "filtration"],
    ["sunroom", "addition", "windows", "heating", "insulation"],
  ];

  const taskTitles = [
    "Order materials",
    "Schedule inspection",
    "Demolition phase",
    "Install foundation",
    "Electrical rough-in",
    "Plumbing rough-in",
    "Drywall installation",
    "Paint preparation",
    "Final cleanup",
    "Client walkthrough",
    "Permit application",
    "Site preparation",
    "Install fixtures",
    "Quality check",
    "Final invoice",
  ];

  const checklistItems = [
    { title: "Permits obtained", category: "Legal" },
    { title: "Materials delivered", category: "Logistics" },
    { title: "Safety equipment ready", category: "Safety" },
    { title: "Utilities marked", category: "Safety" },
    { title: "Insurance verified", category: "Legal" },
    { title: "Client approval received", category: "Communication" },
    { title: "Final inspection scheduled", category: "Quality" },
    { title: "Cleanup completed", category: "Completion" },
    { title: "Keys handed over", category: "Completion" },
    { title: "Warranty documentation", category: "Documentation" },
  ];

  const projects: MockProject[] = [];

  for (let i = 0; i < 10; i++) {
    const projectId = `project-${i + 1}`;
    const startDate = new Date(
      2024,
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28) + 1,
    );
    const endDate = new Date(
      startDate.getTime() + (Math.random() * 90 + 30) * 24 * 60 * 60 * 1000,
    );

    // Generate photos for each project (exactly 20 photos total across 10 projects = 2 photos per project)
    const photos = [];
    const photoCount = 2; // Exactly 2 photos per project for 20 total

    for (let j = 0; j < photoCount; j++) {
      const photoTypes = ["before", "during", "after", "detail", "progress"];
      const categories = [
        "interior",
        "exterior",
        "structural",
        "electrical",
        "plumbing",
        "finishing",
      ];

      // Create more realistic and varied photo URLs
      const colors = [
        "4f46e5", "059669", "dc2626", "ea580c", "7c2d12", "6366f1",
        "8b5cf6", "f59e0b", "10b981", "3b82f6", "ef4444", "84cc16"
      ];
      const color = colors[(i * photoCount + j) % colors.length];
      const photoId = (i * photoCount + j + 1); // Unique ID for each photo across all projects

      // Create varied photo content based on project type and photo index
      const projectType = projectNames[i].split(" - ")[0];
      const photoStage = j === 0 ? "Before" : "After";

      const imageUrls = [
        `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><defs><linearGradient id="grad${photoId}" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" style="stop-color:%23${color};stop-opacity:1" /><stop offset="100%" style="stop-color:%23${color}88;stop-opacity:1" /></linearGradient></defs><rect width="800" height="600" fill="url(%23grad${photoId})"/><circle cx="200" cy="150" r="50" fill="white" opacity="0.3"/><circle cx="600" cy="450" r="70" fill="white" opacity="0.2"/><text x="400" y="280" font-family="Arial" font-size="32" fill="white" text-anchor="middle" font-weight="bold">${projectType}</text><text x="400" y="320" font-family="Arial" font-size="24" fill="white" text-anchor="middle">${photoStage} Photo</text><text x="400" y="360" font-family="Arial" font-size="18" fill="white" text-anchor="middle" opacity="0.8">Gallery Image ${photoId}</text></svg>`,
        `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23f3f4f6"/><rect x="50" y="50" width="700" height="500" fill="%23${color}" opacity="0.8"/><rect x="100" y="100" width="600" height="400" fill="white" opacity="0.9"/><text x="400" y="280" font-family="Arial" font-size="28" fill="%23374151" text-anchor="middle" font-weight="bold">${projectType}</text><text x="400" y="320" font-family="Arial" font-size="20" fill="%23374151" text-anchor="middle">${photoStage} - Photo ${photoId}</text></svg>`,
        `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect width="800" height="600" fill="%23${color}"/><polygon points="0,600 800,400 800,600" fill="white" opacity="0.1"/><polygon points="0,0 400,200 0,400" fill="white" opacity="0.1"/><text x="400" y="300" font-family="Arial" font-size="36" fill="white" text-anchor="middle" font-weight="bold">📸 ${photoId}</text><text x="400" y="350" font-family="Arial" font-size="20" fill="white" text-anchor="middle">${projectType} - ${photoStage}</text></svg>`,
      ];

      const selectedPhotoType = j === 0 ? "before" : "after";
      const selectedCategory = categories[i % categories.length];

      photos.push({
        url: imageUrls[0], // Primary URL
        title: `${selectedPhotoType.charAt(0).toUpperCase() + selectedPhotoType.slice(1)} - ${projectNames[i]}`,
        description: `Professional ${selectedPhotoType} photo showcasing ${selectedCategory} work for ${projectNames[i]}. High-quality documentation of project progress and completion.`,
        tags: [
          selectedPhotoType,
          selectedCategory,
          ...keywords[i].slice(0, 2),
          `photo-${photoId}`,
        ],
        uploadedAt: new Date(
          startDate.getTime() +
            (j / photoCount) * (endDate.getTime() - startDate.getTime()),
        ).toISOString(),
        uploadedBy: ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Wilson"][
          Math.floor(Math.random() * 4)
        ],
        isPrimary: j === 0,
        metadata: {
          originalFileName: `${projectId}_${selectedPhotoType}_${selectedCategory}_${j + 1}.jpg`,
          fileSize: Math.floor(Math.random() * 3000000) + 800000, // 800KB - 3.8MB
          fileType: "image/jpeg",
          category: selectedCategory,
          altText: `${selectedPhotoType.charAt(0).toUpperCase() + selectedPhotoType.slice(1)} photo of ${projectNames[i]} showing ${selectedCategory} work`,
          fallbackUrls: imageUrls.slice(1), // Store fallback URLs
        },
      });
    }

    // Generate tasks
    const tasks = [];
    const taskCount = Math.floor(Math.random() * 10) + 5; // 5-15 tasks per project

    for (let k = 0; k < taskCount; k++) {
      const taskStartDate = new Date(
        startDate.getTime() + k * 7 * 24 * 60 * 60 * 1000,
      ); // Tasks spaced a week apart

      tasks.push({
        id: `task-${projectId}-${k + 1}`,
        title: taskTitles[k % taskTitles.length],
        description: `Complete ${taskTitles[k % taskTitles.length].toLowerCase()} for ${projectNames[i]}`,
        assignedTo: ["John Doe", "Jane Smith", "Mike Johnson", "Sarah Wilson"][
          Math.floor(Math.random() * 4)
        ],
        dueDate: new Date(
          taskStartDate.getTime() +
            (Math.random() * 14 + 1) * 24 * 60 * 60 * 1000,
        ).toISOString(),
        status:
          Math.random() > 0.7
            ? "completed"
            : Math.random() > 0.4
              ? "in-progress"
              : "pending",
        priority:
          Math.random() > 0.7 ? "high" : Math.random() > 0.4 ? "medium" : "low",
      });
    }

    // Generate checklist
    const checklist = checklistItems
      .slice(0, Math.floor(Math.random() * 8) + 3)
      .map((item, index) => ({
        id: `checklist-${projectId}-${index + 1}`,
        title: item.title,
        completed: Math.random() > 0.4,
        category: item.category,
      }));

    // Generate notes
    const notes = [];
    const noteCount = Math.floor(Math.random() * 5) + 2; // 2-7 notes per project
    const noteTypes: Array<"general" | "important" | "reminder"> = [
      "general",
      "important",
      "reminder",
    ];

    for (let l = 0; l < noteCount; l++) {
      notes.push({
        id: `note-${projectId}-${l + 1}`,
        content: [
          "Client requested additional features for this area",
          "Weather delay pushed schedule back by 2 days",
          "Material supplier confirmed delivery for next week",
          "Need to coordinate with electrician before proceeding",
          "Client is very satisfied with progress so far",
          "Remember to order extra materials for contingency",
          "Inspection scheduled for Friday at 2 PM",
        ][l % 7],
        createdAt: new Date(
          startDate.getTime() +
            Math.random() * (Date.now() - startDate.getTime()),
        ).toISOString(),
        createdBy: ["John Doe", "Jane Smith", "Mike Johnson"][
          Math.floor(Math.random() * 3)
        ],
        type: noteTypes[Math.floor(Math.random() * noteTypes.length)],
      });
    }

    // Generate activity log
    const activityLog = [];
    const activityCount = Math.floor(Math.random() * 15) + 10; // 10-25 activity entries
    const actions = [
      "created project",
      "uploaded photos",
      "added task",
      "completed task",
      "updated project details",
      "added note",
      "scheduled inspection",
      "marked checklist item complete",
      "updated project status",
    ];

    for (let m = 0; m < activityCount; m++) {
      activityLog.push({
        id: `activity-${projectId}-${m + 1}`,
        action: actions[Math.floor(Math.random() * actions.length)],
        description: `${["John Doe", "Jane Smith", "Mike Johnson"][Math.floor(Math.random() * 3)]} ${actions[Math.floor(Math.random() * actions.length)]}`,
        timestamp: new Date(
          startDate.getTime() +
            Math.random() * (Date.now() - startDate.getTime()),
        ).toISOString(),
        user: ["John Doe", "Jane Smith", "Mike Johnson"][
          Math.floor(Math.random() * 3)
        ],
      });
    }

    projects.push({
      id: projectId,
      name: projectNames[i],
      description: `Professional ${projectNames[i].split(" - ")[0].toLowerCase()} project with high-quality materials and expert craftsmanship.`,
      address: addresses[i],
      customerPhone: `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      customerEmail: `client${i + 1}@email.com`,
      keywords: keywords[i],
      photos,
      documents: [
        {
          id: `doc-${projectId}-1`,
          name: "Project Contract",
          url: "#",
          type: "pdf",
          uploadedAt: startDate.toISOString(),
          uploadedBy: "John Doe",
        },
        {
          id: `doc-${projectId}-2`,
          name: "Building Permits",
          url: "#",
          type: "pdf",
          uploadedAt: startDate.toISOString(),
          uploadedBy: "Jane Smith",
        },
      ],
      tasks,
      checklist,
      notes,
      activityLog,
      createdAt: startDate.toISOString(),
      updatedAt: new Date().toISOString(),
      status:
        Math.random() > 0.8
          ? "completed"
          : Math.random() > 0.6
            ? "active"
            : Math.random() > 0.4
              ? "paused"
              : "draft",
      assignedUsers: ["John Doe", "Jane Smith"].slice(
        0,
        Math.floor(Math.random() * 2) + 1,
      ),
      starred: Math.random() > 0.7,
      archived: Math.random() > 0.9,
      createdBy: "John Doe",
      estimatedValue: Math.floor(Math.random() * 100000) + 10000,
      actualValue: Math.floor(Math.random() * 100000) + 8000,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      clientType: Math.random() > 0.7 ? "commercial" : "residential",
      projectType: ["renovation", "new-construction", "repair", "maintenance"][
        Math.floor(Math.random() * 4)
      ] as any,
    });
  }

  return projects;
};

const generateMockUsers = (): MockUser[] => {
  return [
    {
      id: "user-1",
      name: "John Doe",
      email: "john@company.com",
      role: "admin",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=john",
      phone: "(555) 123-4567",
      specialties: ["Project Management", "Construction", "Renovation"],
      joinedAt: "2023-01-15T00:00:00Z",
      isActive: true,
    },
    {
      id: "user-2",
      name: "Jane Smith",
      email: "jane@company.com",
      role: "project-manager",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=jane",
      phone: "(555) 234-5678",
      specialties: ["Interior Design", "Client Relations", "Quality Control"],
      joinedAt: "2023-02-20T00:00:00Z",
      isActive: true,
    },
    {
      id: "user-3",
      name: "Mike Johnson",
      email: "mike@company.com",
      role: "contractor",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=mike",
      phone: "(555) 345-6789",
      specialties: ["Electrical", "Plumbing", "HVAC"],
      joinedAt: "2023-03-10T00:00:00Z",
      isActive: true,
    },
    {
      id: "user-4",
      name: "Sarah Wilson",
      email: "sarah@company.com",
      role: "contractor",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=sarah",
      phone: "(555) 456-7890",
      specialties: ["Carpentry", "Flooring", "Painting"],
      joinedAt: "2023-04-05T00:00:00Z",
      isActive: true,
    },
    {
      id: "user-5",
      name: "David Brown",
      email: "david@company.com",
      role: "contractor",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=david",
      phone: "(555) 567-8901",
      specialties: ["Roofing", "Siding", "Exterior Work"],
      joinedAt: "2023-05-12T00:00:00Z",
      isActive: false,
    },
  ];
};

const generateMockClients = (): MockClient[] => {
  const names = [
    "Robert Smith",
    "Mary Johnson",
    "William Brown",
    "Patricia Davis",
    "James Wilson",
    "Jennifer Miller",
    "Michael Garcia",
    "Linda Rodriguez",
    "David Martinez",
    "Barbara Lopez",
  ];

  const companies = [
    "TechCorp Solutions",
    "Green Valley Industries",
    "Sunset Retail Group",
    "Downtown Development LLC",
    "Heritage Property Management",
    null,
    null,
    null,
  ];

  return names.map((name, index) => ({
    id: `client-${index + 1}`,
    name,
    email: `${name.toLowerCase().replace(" ", ".")}@email.com`,
    phone: `(555) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
    address: `${Math.floor(Math.random() * 9999) + 100} ${["Main", "Oak", "Pine", "Elm", "Maple"][Math.floor(Math.random() * 5)]} St, Springfield, IL`,
    company: companies[Math.floor(Math.random() * companies.length)],
    type: companies[Math.floor(Math.random() * companies.length)]
      ? "commercial"
      : "residential",
    projects: [`project-${index + 1}`], // Each client has one main project
    totalValue: Math.floor(Math.random() * 150000) + 25000,
    joinedAt: new Date(
      2023,
      Math.floor(Math.random() * 12),
      Math.floor(Math.random() * 28) + 1,
    ).toISOString(),
    lastContact: new Date(
      Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    preferredContactMethod: ["email", "phone", "text"][
      Math.floor(Math.random() * 3)
    ] as any,
    notes: [
      "Prefers morning appointments",
      "Very detail-oriented client",
      "Has pets - be mindful when entering property",
      "Budget-conscious but values quality",
      "Excellent communication, responds quickly",
      "Prefers eco-friendly materials when possible",
    ][Math.floor(Math.random() * 6)],
  }));
};

// Mock Data Service
class MockDataService {
  private static instance: MockDataService;
  private projects: MockProject[] = [];
  private users: MockUser[] = [];
  private clients: MockClient[] = [];
  private initialized = false;

  static getInstance(): MockDataService {
    if (!MockDataService.instance) {
      MockDataService.instance = new MockDataService();
    }
    return MockDataService.instance;
  }

  public initialize() {
    if (this.initialized) return;

    // Use more specific Builder.io detection
    const isBuilderIoEditor =
      typeof window !== "undefined" &&
      (window.location.href.includes("builder.io") ||
        window.location.hostname.includes("builder.io") ||
        (document.referrer.includes("builder.io") && window.parent !== window));

    if (isBuilderIoEditor) {
      // Use minimal mock data for Builder.io to prevent rendering issues
      this.projects = this.getMinimalMockProjects();
      this.users = this.getMinimalMockUsers();
      this.clients = this.getMinimalMockClients();
      this.initialized = true;
      return;
    }

    // Force reinitialization to ensure we have full mock data
    const forceReinit = true; // Always force for now to ensure data is available
    if (forceReinit) {
      console.log("🔄 Force reinitializing mock data...");
      localStorage.removeItem("projects");
      localStorage.removeItem("users");
      localStorage.removeItem("clients");
    }

    // Check if data already exists in localStorage
    const existingProjects = localStorage.getItem("projects");
    const existingUsers = localStorage.getItem("users");
    const existingClients = localStorage.getItem("clients");

    if (existingProjects && !forceReinit) {
      this.projects = JSON.parse(existingProjects);
      console.log("📂 Loaded existing projects from localStorage:", this.projects.length);
    } else {
      console.log("🔨 Generating new mock projects...");
      this.projects = generateMockProjects();
      localStorage.setItem("projects", JSON.stringify(this.projects));
      console.log("✅ Generated and saved", this.projects.length, "projects with", this.projects.reduce((total, p) => total + p.photos.length, 0), "total photos");
    }

    if (existingUsers) {
      this.users = JSON.parse(existingUsers);
    } else {
      this.users = generateMockUsers();
      localStorage.setItem("users", JSON.stringify(this.users));
    }

    if (existingClients) {
      this.clients = JSON.parse(existingClients);
    } else {
      this.clients = generateMockClients();
      localStorage.setItem("clients", JSON.stringify(this.clients));
    }

    this.initialized = true;
  }

  public forceReinitialize() {
    this.initialized = false;
    this.projects = [];
    this.users = [];
    this.clients = [];
    this.initialize();
  }

  public forceRegenerateProjects() {
    console.log("🔄 Force regenerating projects...");
    localStorage.removeItem("projects");
    this.projects = generateMockProjects();
    localStorage.setItem("projects", JSON.stringify(this.projects));
    console.log("✅ Force regenerated", this.projects.length, "projects with", this.projects.reduce((total, p) => total + p.photos.length, 0), "total photos");
    return this.projects;
  }

  // Minimal mock data for Builder.io editor
  private getMinimalMockProjects(): MockProject[] {
    return [
      {
        id: "builder-project-1",
        name: "Sample Kitchen Remodel",
        description: "A beautiful kitchen renovation project",
        status: "completed",
        priority: "medium",
        clientName: "John Doe",
        clientEmail: "john@example.com",
        startDate: "2024-01-01",
        endDate: "2024-02-15",
        lastActivity: "2024-02-15",
        progress: 100,
        starred: false,
        archived: false,
        tags: ["kitchen", "renovation"],
        photos: [],
        teamMembers: [],
        documents: [],
        notes: [],
        budget: 25000,
        spent: 24500,
        estimatedHours: 120,
        actualHours: 115,
        metadata: {
          createdBy: "user-1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-02-15T00:00:00Z",
          version: 1,
        },
      },
    ];
  }

  private getMinimalMockUsers(): MockUser[] {
    return [
      {
        id: "user-1",
        name: "Admin User",
        email: "admin@example.com",
        role: "admin",
        avatar: "",
        phone: "+1234567890",
        isActive: true,
        lastLogin: "2024-01-01T00:00:00Z",
        createdAt: "2024-01-01T00:00:00Z",
      },
    ];
  }

  private getMinimalMockClients(): MockClient[] {
    return [
      {
        id: "client-1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+1234567890",
        address: "123 Main St, City, State",
        company: "ABC Company",
        projects: ["builder-project-1"],
        notes: "",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      },
    ];
  }

  // Project methods
  getProjects(): MockProject[] {
    this.initialize();
    return this.projects;
  }

  getProject(id: string): MockProject | undefined {
    this.initialize();
    return this.projects.find((p) => p.id === id);
  }

  addProject(project: MockProject): void {
    this.initialize();
    this.projects.push(project);
    localStorage.setItem("projects", JSON.stringify(this.projects));
  }

  updateProject(id: string, updates: Partial<MockProject>): void {
    this.initialize();
    const index = this.projects.findIndex((p) => p.id === id);
    if (index !== -1) {
      this.projects[index] = {
        ...this.projects[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem("projects", JSON.stringify(this.projects));
    }
  }

  deleteProject(id: string): void {
    this.initialize();
    this.projects = this.projects.filter((p) => p.id !== id);
    localStorage.setItem("projects", JSON.stringify(this.projects));
  }

  // User methods
  getUsers(): MockUser[] {
    this.initialize();
    return this.users;
  }

  getUser(id: string): MockUser | undefined {
    this.initialize();
    return this.users.find((u) => u.id === id);
  }

  // Client methods
  getClients(): MockClient[] {
    this.initialize();
    return this.clients;
  }

  getClient(id: string): MockClient | undefined {
    this.initialize();
    return this.clients.find((c) => c.id === id);
  }

  // Utility methods
  resetData(): void {
    localStorage.removeItem("projects");
    localStorage.removeItem("users");
    localStorage.removeItem("clients");
    this.initialized = false;
    this.initialize();
  }

  exportData(): {
    projects: MockProject[];
    users: MockUser[];
    clients: MockClient[];
  } {
    this.initialize();
    return {
      projects: this.projects,
      users: this.users,
      clients: this.clients,
    };
  }

  importData(data: {
    projects?: MockProject[];
    users?: MockUser[];
    clients?: MockClient[];
  }): void {
    if (data.projects) {
      this.projects = data.projects;
      localStorage.setItem("projects", JSON.stringify(this.projects));
    }
    if (data.users) {
      this.users = data.users;
      localStorage.setItem("users", JSON.stringify(this.users));
    }
    if (data.clients) {
      this.clients = data.clients;
      localStorage.setItem("clients", JSON.stringify(this.clients));
    }
  }
}

// Export singleton instance
export const mockDataService = MockDataService.getInstance();

// Export types
export type { MockProject, MockUser, MockClient };
