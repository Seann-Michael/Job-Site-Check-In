# Local SEO Ranker

A comprehensive local SEO management platform built with React, TypeScript, and Supabase. This application helps agencies and businesses manage their local SEO projects, track rankings, manage citations, and monitor their online presence.

## 🚀 Features

### Core Features
- **Project Management**: Create and manage SEO projects with tasks, photos, and documents
- **Business Management**: Multi-business support for agencies and business owners
- **Citation Management**: Track and manage business directory listings
- **Review Management**: Monitor and respond to customer reviews
- **Keyword Tracking**: Track local search rankings and keyword performance
- **Analytics Dashboard**: Comprehensive analytics and reporting
- **Task Management**: Project task tracking with progress monitoring
- **Photo & Document Management**: Upload and organize project files

### Advanced Features
- **Agency Management**: Multi-tenant agency support with team collaboration
- **Technical SEO Audits**: Website auditing and technical SEO analysis
- **Competitor Tracking**: Monitor competitor rankings and strategies
- **Content Calendar**: Plan and schedule content marketing
- **Link Building**: Track link building opportunities and campaigns
- **Monitoring & Alerts**: Automated monitoring with smart alerts
- **Google My Business Integration**: GMB optimization and posting
- **Local Rankings**: Track local pack and maps rankings

## 🛠️ Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI Components**: Radix UI, Tailwind CSS, Shadcn/ui
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Server**: Express.js (optional, in server_complete/)
- **Maps**: Google Maps API integration
- **Charts**: Recharts for analytics visualization
- **Animations**: Framer Motion
- **Form Handling**: React Hook Form with Zod validation

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher)
- **npm** or **yarn**
- **Supabase account** (free tier available)

Optional:
- **Google Maps API key** (for address features)
- **SendGrid API key** (for email notifications)
- **Twilio credentials** (for SMS notifications)

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd local-seo-ranker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

First, create a new project in [Supabase](https://supabase.com/dashboard):

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Choose your organization and create the project
4. Wait for the project to be set up

### 4. Configure Environment Variables

Run the interactive setup script:

```bash
npm run setup
```

This will guide you through:
- Setting up your Supabase connection
- Creating environment files
- Optionally populating sample data

**Manual Setup Alternative:**

Copy the environment template:
```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:
```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
# ... other variables
```

### 5. Set Up Database Schema

The database schema has already been created in your Supabase project. To populate it with sample data:

```bash
npm run populate-data
```

### 6. Start Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

### 7. Start Backend Server (Optional)

If you want to use the Express.js backend API:

```bash
npm run server:dev
```

Or start both frontend and backend simultaneously:

```bash
npm run full:dev
```

## 📁 Project Structure

```
local-seo-ranker/
├── client/                 # Frontend React application
│   ├── components/         # Reusable UI components
│   ├── pages/             # Application pages/routes
│   ├── lib/               # Utilities and services
│   ├── hooks/             # Custom React hooks
│   └── types/             # TypeScript type definitions
├── server_complete/       # Backend Express.js API (optional)
│   ├── routes/            # API route handlers
│   ├── services/          # Business logic services
│   └── supabaseClient.ts  # Supabase client configuration
├── scripts/               # Setup and utility scripts
├── public/                # Static assets
└── docs/                  # Documentation
```

## 🗄️ Database Schema

The application uses a comprehensive PostgreSQL schema with the following main entities:

### Core Tables
- `users` - User accounts and authentication
- `businesses` - Business information and details
- `projects` - SEO projects and campaigns
- `project_tasks` - Project task management
- `project_photos` - Project photo uploads
- `project_documents` - Project file attachments

### SEO & Marketing
- `keywords` - Target keywords and tracking
- `local_rankings` - Local search position tracking
- `citations` - Directory listings and NAP data
- `reviews` - Customer reviews and responses
- `competitors` - Competitor tracking
- `backlinks` - Link building and analysis

### Agency Management
- `agencies` - Agency information
- `agency_users` - Team member management
- `agency_projects` - Agency-project relationships

### Analytics & Monitoring
- `analytics` - Performance metrics and data
- `monitoring_alerts` - Automated alerts and notifications
- `technical_audits` - SEO audit results
- `business_insights` - AI-generated insights

## 🔧 Configuration

### Environment Variables

#### Frontend (Required)
```bash
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Backend (Optional)
```bash
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
```

#### Optional External Services
```bash
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
SENDGRID_API_KEY=your-sendgrid-api-key
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
```

### Google Maps Setup (Optional but Recommended)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Maps JavaScript API
   - Places API
   - Geocoding API
   - Street View Static API
4. Create credentials (API Key)
5. Add your API key to the environment variables

## 📱 Usage

### Getting Started

1. **Create Your First Business**
   - Navigate to "Add Business" from the dashboard
   - Fill in your business information
   - Add address and contact details

2. **Create a Project**
   - Click "Add Project" from the main dashboard
   - Select your business
   - Define project scope and objectives
   - Add client contact information
   - Set timeline and budget

3. **Manage Tasks**
   - Break down projects into manageable tasks
   - Assign tasks to team members
   - Track progress and deadlines
   - Add notes and comments

4. **Track Performance**
   - Monitor keyword rankings
   - Track local search visibility
   - Analyze competitor performance
   - Generate reports for clients

### Key Features

#### Project Management
- Create and manage SEO projects
- Task assignment and tracking
- Photo and document management
- Progress monitoring
- Client communication

#### SEO Tools
- Keyword research and tracking
- Local rankings monitoring
- Citation management
- Review monitoring
- Technical SEO audits

#### Agency Features
- Multi-client management
- Team collaboration
- White-label reporting
- Client portal access
- Billing and invoicing

## 🚀 Deployment

### Frontend Deployment

The frontend can be deployed to any static hosting service:

#### Vercel
```bash
npm run build
# Deploy to Vercel
```

#### Netlify
```bash
npm run build
# Deploy dist/ folder to Netlify
```

#### Supabase Hosting
```bash
npm run build
# Use Supabase CLI to deploy
```

### Backend Deployment (Optional)

The Express.js backend can be deployed to:
- Vercel (serverless functions)
- Railway
- Heroku
- Digital Ocean
- AWS/GCP/Azure

## 🔒 Security

The application implements several security measures:

- **Row Level Security (RLS)**: Database-level access control
- **Authentication**: Supabase Auth with JWT tokens
- **Authorization**: Role-based access control
- **Data Validation**: Input validation and sanitization
- **API Security**: Rate limiting and CORS protection

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Common Issues

**1. Supabase Connection Error**
- Verify your environment variables are correct
- Check that your Supabase project is active
- Ensure you're using the correct URL and keys

**2. Database Schema Issues**
- Re-run the database setup script
- Check the Supabase dashboard for any errors
- Verify all tables were created successfully

**3. Build Errors**
- Clear node_modules and reinstall dependencies
- Check for TypeScript errors
- Verify all environment variables are set

### Getting Help

- Check the [documentation](docs/) for detailed guides
- Review the [issues](issues) for known problems
- Create a new issue for bugs or feature requests

## 🎯 Roadmap

### Upcoming Features
- [ ] Advanced reporting and analytics
- [ ] White-label client portals
- [ ] API integrations (SEMrush, Ahrefs, etc.)
- [ ] Mobile app (React Native)
- [ ] Advanced automation workflows
- [ ] Multi-language support
- [ ] Enhanced AI recommendations

### Current Version: 1.0.0

- ✅ Core project management
- ✅ SEO tracking and monitoring
- ✅ Multi-business support
- ✅ Agency management
- ✅ Real-time analytics
- ✅ Photo and document management
- ✅ Task management
- ✅ Review monitoring
- ✅ Citation tracking

---

**Built with ❤️ for the SEO community**
