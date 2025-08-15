# 🚀 Local SEO Ranker Setup Guide

This guide will help you set up the Local SEO Ranker application with Supabase backend.

## Quick Setup (Recommended)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Interactive Setup
```bash
npm run setup
```

This will guide you through:
- Configuring Supabase connection
- Creating environment files
- Optionally populating sample data

### 3. Start the Application
```bash
npm run dev
```

Your app will be available at `http://localhost:5173`

---

## Manual Setup

If you prefer to set up manually:

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com/dashboard)
2. Click "New Project"
3. Fill in your project details
4. Wait for setup to complete

### 2. Get Your Supabase Credentials

1. Go to Project Settings → API
2. Copy your:
   - Project URL
   - Anon/Public Key
   - Service Role Key (optional, for backend)

### 3. Create Environment File

Create a `.env` file in the root directory:

```bash
# Supabase Configuration
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

# Backend Configuration (optional)
SUPABASE_URL=your-supabase-project-url
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key

# Optional: External Services
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### 4. Start the Application

```bash
npm run dev
```

---

## ✨ Demo Mode

Don't have Supabase set up yet? No problem! 

The application will automatically run in **Demo Mode** with sample data when Supabase environment variables are not configured. This lets you:

- Explore all features with realistic demo data
- Test the user interface and workflows
- See how the application works before committing to setup

### Demo Data Includes:
- 2 sample businesses (restaurant & auto repair)
- 3 sample projects with different statuses
- Sample tasks, reviews, and analytics
- Realistic project timelines and budgets

---

## 🎯 Next Steps

### Configure External Services (Optional)

#### Google Maps API
For address autocomplete and mapping features:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Enable: Maps JavaScript API, Places API, Geocoding API
3. Create an API key
4. Add to your `.env` file

#### SendGrid (Email)
For email notifications:
1. Sign up at [SendGrid](https://sendgrid.com/)
2. Create an API key
3. Add `SENDGRID_API_KEY` to your `.env`

#### Twilio (SMS)
For SMS notifications:
1. Sign up at [Twilio](https://twilio.com/)
2. Get your Account SID and Auth Token
3. Add to your `.env` file

### Run Backend Server (Optional)
For additional API functionality:
```bash
npm run server:dev
```

### Populate Sample Data
If you want to add sample data to your Supabase database:
```bash
npm run populate-data
```

---

## 🔧 Troubleshooting

### Common Issues

**"Module not found" errors**
- Run `npm install` to ensure all dependencies are installed

**"Supabase not configured" warning**
- Check that your `.env` file exists and has the correct variables
- Verify your Supabase credentials are correct

**Database schema errors**
- The schema should be automatically created in your Supabase project
- If you see table errors, check the Supabase dashboard for any issues

**Build/development errors**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run typecheck`

### Getting Help

1. Check the [README.md](README.md) for detailed documentation
2. Review the error messages in your browser console
3. Verify your environment variables are set correctly
4. Try running in demo mode first to ensure basic functionality

---

## 🎉 You're Ready!

Once setup is complete, you can:

- ✅ Create and manage SEO projects
- ✅ Track business performance
- ✅ Manage tasks and workflows
- ✅ Monitor analytics and rankings
- ✅ Upload photos and documents
- ✅ Generate reports

Enjoy using Local SEO Ranker! 🚀
