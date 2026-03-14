# Frontend Modules Documentation

## 📱 React Components Architecture

### Layout Components

#### AppLayout Component (`client/components/AppLayout.tsx`)

**Purpose**: Primary application layout providing responsive navigation and content structure.

**Key Features**:

- Responsive sidebar navigation with collapse functionality
- Mobile-optimized bottom navigation bar
- Business switcher for multi-business users
- Contextual header with search and notifications
- Role-based navigation menu rendering
- Real-time notification system integration

**Props Interface**:

```typescript
interface AppLayoutProps {
  children: ReactNode;
}
```

**State Management**:

```typescript
const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
const [currentBusiness, setCurrentBusiness] = useState<Business | null>(null);
const [notifications, setNotifications] = useState<Notification[]>([]);
```

**Navigation Structure**:

```typescript
const sidebarItems = [
  {
    id: "jobs",
    label: "Jobs",
    href: "/admin/jobs",
    icon: FolderIcon,
  },
  { id: "gallery", label: "Gallery", href: "/admin/gallery", icon: ImageIcon },
  { id: "reviews", label: "Reviews", href: "/admin/reviews", icon: StarIcon },
  { id: "reports", label: "Reports", href: "/admin/reports", icon: ChartIcon },
  {
    id: "settings",
    label: "Settings",
    href: "/admin/settings",
    icon: SettingsIcon,
  },
];
```

**Responsive Breakpoints**:

- Mobile: `< 768px` - Bottom navigation, collapsed sidebar
- Tablet: `768px - 1024px` - Collapsible sidebar
- Desktop: `> 1024px` - Full sidebar with labels

**Usage Example**:

```tsx
<AppLayout>
  <Routes>
    <Route path="/projects" element={<ProjectsPage />} />
    <Route path="/gallery" element={<GalleryPage />} />
  </Routes>
</AppLayout>
```

#### AgencyLayout Component (`client/components/AgencyLayout.tsx`)

**Purpose**: Specialized layout for agency administrators managing multiple client accounts.

**Key Features**:

- Agency-specific navigation and branding
- Client account switching functionality
- Commission tracking dashboard
- Multi-tenant data isolation
- Agency-specific quick actions

**Additional Navigation Items**:

```typescript
const agencyItems = [
  { id: "clients", label: "Clients", href: "/agency/admin/clients" },
  { id: "commission", label: "Commission", href: "/agency/admin/commission" },
  { id: "billing", label: "Billing", href: "/agency/admin/billing" },
  { id: "analytics", label: "Analytics", href: "/agency/admin/analytics" },
];
```

#### SuperAdminLayout Component (`client/components/SuperAdminLayout.tsx`)

**Purpose**: Platform administration interface for system-wide management.

**Key Features**:

- System health monitoring dashboard
- User and business management tools
- Platform configuration controls
- Security and audit log access
- Feature flag management interface

### Core Business Components

#### ProjectCard Component (`client/components/ProjectCard.tsx`)

**Purpose**: Displays project information in a card format with quick actions.

**Props Interface**:

```typescript
interface ProjectCardProps {
  project: Project;
  onEdit?: (project: Project) => void;
  onDelete?: (projectId: string) => void;
  onStatusChange?: (projectId: string, status: ProjectStatus) => void;
  showActions?: boolean;
  variant?: "default" | "compact" | "detailed";
}
```

**Features**:

- Project status visualization with color-coded badges
- Progress tracking with completion percentage
- Quick action buttons (edit, delete, change status)
- Responsive design with grid layout support
- Drag-and-drop support for reordering

**Status Variants**:

```typescript
const statusConfig = {
  active: { color: "green", icon: PlayIcon, label: "Active" },
  paused: { color: "yellow", icon: PauseIcon, label: "Paused" },
  completed: { color: "blue", icon: CheckIcon, label: "Completed" },
  draft: { color: "gray", icon: EditIcon, label: "Draft" },
};
```

#### BusinessDetail Component (`client/pages/BusinessDetail.tsx`)

**Purpose**: Comprehensive business information management interface.

**Key Sections**:

1. **Basic Information**: Name, description, contact details
2. **Location Management**: Address, service areas, mapping
3. **Business Hours**: Operating schedule configuration
4. **Social Media**: Profile links and integration
5. **Google My Business**: GMB profile synchronization
6. **Team Management**: Staff and role assignments

**Form Validation**:

```typescript
const businessSchema = z.object({
  name: z.string().min(1, "Business name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().regex(/^\+?[\d\s\-\(\)]+$/, "Valid phone number required"),
  address: z.object({
    street: z.string().min(1, "Street address required"),
    city: z.string().min(1, "City required"),
    state: z.string().min(2, "State required"),
    zip: z.string().min(5, "ZIP code required"),
  }),
});
```

### Media Management Components

#### SmartMediaUploader Component (`client/components/SmartMediaUploader.tsx`)

**Purpose**: Advanced file upload system with metadata enhancement and optimization.

**Key Features**:

- Multi-file upload with drag-and-drop support
- Real-time file optimization and compression
- EXIF data extraction and enhancement
- Progress tracking with pause/resume functionality
- File type validation and size limits
- Thumbnail generation for images and videos

**Supported File Types**:

```typescript
const supportedTypes = {
  images: [".jpg", ".jpeg", ".png", ".webp", ".gif"],
  videos: [".mp4", ".mov", ".avi", ".webm"],
  documents: [".pdf", ".doc", ".docx", ".txt"],
};
```

**Upload Configuration**:

```typescript
interface UploadConfig {
  maxFileSize: number; // 50MB default
  maxFiles: number; // 10 files default
  allowedTypes: string[];
  enableOptimization: boolean;
  enableMetadataEnhancement: boolean;
  compressionQuality: number; // 0.8 default
}
```

**Metadata Enhancement**:

```typescript
interface EnhancedMetadata {
  originalName: string;
  businessInfo: BusinessInfo;
  location?: GeoLocation;
  keywords: string[];
  projectTags: string[];
  exifData?: ExifData;
  structuredData?: StructuredData;
}
```

#### MediaViewer Component (`client/components/MediaViewer.tsx`)

**Purpose**: Responsive media gallery with advanced viewing and management capabilities.

**Features**:

- Grid and list view modes
- Advanced filtering and search
- Bulk operations (delete, move, tag)
- Lightbox view with zoom and navigation
- Metadata editing inline
- Share and download functionality

**View Modes**:

```typescript
type ViewMode = "grid" | "list" | "masonry" | "timeline";

interface ViewConfig {
  mode: ViewMode;
  itemsPerPage: number;
  sortBy: "date" | "name" | "size" | "type";
  sortOrder: "asc" | "desc";
  filterBy?: {
    type?: MediaType;
    dateRange?: DateRange;
    tags?: string[];
  };
}
```

### Search and Navigation Components

#### SmartSearch Component (`client/components/SmartSearch.tsx`)

**Purpose**: Intelligent search system with auto-suggestions and contextual results.

**Features**:

- Real-time search with debouncing
- Auto-completion with keyboard navigation
- Contextual search (projects, businesses, reviews)
- Recent searches and favorites
- Search analytics and optimization

**Search Configuration**:

```typescript
interface SearchConfig {
  placeholder: string;
  searchTypes: SearchType[];
  enableAutoComplete: boolean;
  debounceMs: number;
  minCharacters: number;
  maxResults: number;
}

type SearchType = "projects" | "businesses" | "reviews" | "users" | "all";
```

**Search Result Structure**:

```typescript
interface SearchResult {
  id: string;
  type: SearchType;
  title: string;
  description?: string;
  url: string;
  thumbnail?: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}
```

#### AdvancedSearch Component (`client/components/AdvancedSearch.tsx`)

**Purpose**: Complex filtering interface for detailed search operations.

**Filter Types**:

```typescript
interface FilterConfig {
  textFilters: TextFilter[];
  dateFilters: DateFilter[];
  numberFilters: NumberFilter[];
  selectFilters: SelectFilter[];
  tagFilters: TagFilter[];
}

interface TextFilter {
  key: string;
  label: string;
  placeholder: string;
  searchType: "contains" | "startsWith" | "exact" | "regex";
}
```

### Authentication Components

#### ProtectedRoute Component (`client/components/ProtectedRoute.tsx`)

**Purpose**: Route protection based on user authentication and authorization.

**Features**:

- Role-based access control
- Redirect to login for unauthenticated users
- Permission checking for specific resources
- Loading states during authentication verification

**Implementation**:

```typescript
interface ProtectedRouteProps {
  children: ReactNode;
  requiredRole?: UserRole;
  requiredPermissions?: Permission[];
  fallback?: ReactNode;
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
  requiredPermissions,
  fallback = <LoadingSpinner />,
  redirectTo = '/signin'
}) => {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) return fallback;

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requiredRole && !hasRole(user, requiredRole)) {
    return <AccessDenied />;
  }

  if (requiredPermissions && !hasPermissions(user, requiredPermissions)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
};
```

### Utility Components

#### ErrorBoundary Component (`client/components/ErrorBoundary.tsx`)

**Purpose**: Graceful error handling with user-friendly error displays and reporting.

**Features**:

- Automatic error catching and logging
- User-friendly error messages
- Retry mechanisms for recoverable errors
- Error reporting to monitoring services
- Development vs production error details

**Error Types**:

```typescript
interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

interface ErrorState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  retryCount: number;
}
```

#### LoadingSpinner Component (`client/components/ui/spinner.tsx`)

**Purpose**: Consistent loading state visualization across the application.

**Variants**:

```typescript
type SpinnerSize = "sm" | "md" | "lg" | "xl";
type SpinnerVariant = "default" | "primary" | "secondary" | "accent";

interface SpinnerProps {
  size?: SpinnerSize;
  variant?: SpinnerVariant;
  className?: string;
  label?: string;
}
```

#### Toast Notification System (`client/components/ui/toast.tsx`)

**Purpose**: Non-intrusive notification system for user feedback.

**Notification Types**:

```typescript
type ToastType = "success" | "error" | "warning" | "info";

interface ToastConfig {
  title: string;
  description?: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}
```

### Performance Optimization Components

#### VirtualScroll Component (`client/components/VirtualScroll.tsx`)

**Purpose**: Efficient rendering of large lists with virtualization.

**Features**:

- Dynamic height calculation
- Smooth scrolling with momentum
- Memory-efficient rendering
- Support for variable item heights
- Keyboard navigation support

**Configuration**:

```typescript
interface VirtualScrollProps<T> {
  items: T[];
  itemHeight: number | ((item: T, index: number) => number);
  renderItem: (item: T, index: number) => ReactNode;
  overscan?: number;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
}
```

#### LazyImage Component (`client/components/LazyImage.tsx`)

**Purpose**: Optimized image loading with lazy loading and progressive enhancement.

**Features**:

- Intersection Observer API for lazy loading
- Progressive image loading (blur-up effect)
- Responsive image sizing
- Error fallback handling
- WebP format support with fallbacks

---

This frontend modules documentation provides comprehensive coverage of all major React components in the Local SEO Ranker system, including their purposes, features, interfaces, and usage examples.
