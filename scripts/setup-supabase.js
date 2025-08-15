#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

async function setupSupabase() {
  console.log('🚀 Setting up Supabase for Local SEO Ranker');
  console.log('=====================================\n');

  console.log('Please gather the following information from your Supabase project:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Select your project');
  console.log('3. Go to Settings > API\n');

  const supabaseUrl = await askQuestion('Enter your Supabase URL: ');
  const supabaseAnonKey = await askQuestion('Enter your Supabase Anon Key: ');
  const supabaseServiceKey = await askQuestion('Enter your Supabase Service Role Key (optional, for backend): ');

  // Validate inputs
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Supabase URL and Anon Key are required!');
    process.exit(1);
  }

  if (!supabaseUrl.includes('supabase.co')) {
    console.error('❌ Invalid Supabase URL format. Should be like: https://your-project.supabase.co');
    process.exit(1);
  }

  // Create .env file
  const envContent = `# Supabase Configuration
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseAnonKey}

# Backend Server Configuration (for server_complete)
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey || supabaseAnonKey}
SUPABASE_ANON_KEY=${supabaseAnonKey}

# Optional: API Keys for external services
# GOOGLE_MAPS_API_KEY=your-google-maps-api-key
# SENDGRID_API_KEY=your-sendgrid-api-key
# TWILIO_ACCOUNT_SID=your-twilio-account-sid
# TWILIO_AUTH_TOKEN=your-twilio-auth-token

# Development
NODE_ENV=development
`;

  try {
    fs.writeFileSync('.env', envContent);
    console.log('✅ .env file created successfully!');
  } catch (error) {
    console.error('❌ Error creating .env file:', error.message);
    process.exit(1);
  }

  // Create server_complete/.env file
  const serverEnvContent = `# Supabase Configuration for Backend
SUPABASE_URL=${supabaseUrl}
SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceKey || supabaseAnonKey}
SUPABASE_ANON_KEY=${supabaseAnonKey}

# Optional: API Keys for external services
# SENDGRID_API_KEY=your-sendgrid-api-key
# TWILIO_ACCOUNT_SID=your-twilio-account-sid
# TWILIO_AUTH_TOKEN=your-twilio-auth-token

NODE_ENV=development
`;

  try {
    const serverCompleteDir = path.join(process.cwd(), 'server_complete');
    if (fs.existsSync(serverCompleteDir)) {
      fs.writeFileSync(path.join(serverCompleteDir, '.env'), serverEnvContent);
      console.log('✅ server_complete/.env file created successfully!');
    }
  } catch (error) {
    console.log('⚠️  Could not create server_complete/.env file:', error.message);
  }

  console.log('\n🎉 Supabase configuration completed!');
  console.log('\nNext steps:');
  console.log('1. Run: npm run populate-data (to add sample data to your database)');
  console.log('2. Run: npm run dev (to start the development server)');
  console.log('3. Run: npm run server:dev (in another terminal to start the backend API)');
  console.log('\nNote: The database schema has already been created in your Supabase project.');

  const populateNow = await askQuestion('\nWould you like to populate sample data now? (y/n): ');
  
  if (populateNow.toLowerCase() === 'y' || populateNow.toLowerCase() === 'yes') {
    console.log('\n📊 Populating sample data...');
    
    try {
      const { spawn } = require('child_process');
      const populateProcess = spawn('npm', ['run', 'populate-data'], { 
        stdio: 'inherit',
        env: { ...process.env, ...parseEnvFile('.env') }
      });
      
      populateProcess.on('close', (code) => {
        if (code === 0) {
          console.log('\n✅ Sample data populated successfully!');
          console.log('\n🚀 You can now run: npm run dev');
        } else {
          console.log('\n❌ Error populating sample data. You can run it manually later with: npm run populate-data');
        }
        rl.close();
      });
    } catch (error) {
      console.log('\n❌ Error running populate-data script:', error.message);
      console.log('You can run it manually later with: npm run populate-data');
      rl.close();
    }
  } else {
    rl.close();
  }
}

function parseEnvFile(filePath) {
  try {
    const envContent = fs.readFileSync(filePath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && !key.startsWith('#') && valueParts.length > 0) {
        envVars[key.trim()] = valueParts.join('=').trim();
      }
    });
    
    return envVars;
  } catch (error) {
    return {};
  }
}

// Run the setup
setupSupabase().catch(error => {
  console.error('❌ Setup failed:', error.message);
  rl.close();
  process.exit(1);
});
