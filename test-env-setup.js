#!/usr/bin/env node

/**
 * Environment Setup Test
 * 
 * This script tests that environment variables are properly configured
 * Run with: node test-env-setup.js
 */

require('dotenv').config({ path: '.env.local' });

console.log('🔧 Environment Configuration Test');
console.log('==================================\n');

const tests = [
  {
    name: 'Google Maps API',
    vars: ['VITE_GOOGLE_MAPS_API_KEY'],
    validate: (key) => key && key.startsWith('AIza') && key.length > 30
  },
  {
    name: 'Mailgun Email',
    vars: ['MAILGUN_API_KEY', 'MAILGUN_DOMAIN', 'FROM_EMAIL'],
    validate: (key, domain, email) => 
      key && key.includes('-') && 
      domain && domain.includes('.') && 
      email && email.includes('@')
  },
  {
    name: 'DataForSEO API',
    vars: ['DATAFORSEO_API_KEY'],
    validate: (key) => key && key.includes(':') && key.includes('@')
  },
  {
    name: 'Supabase (Frontend)',
    vars: ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    validate: (url, key) => 
      url && url.includes('supabase.co') && 
      key && key.startsWith('eyJ')
  },
  {
    name: 'Supabase (Backend)',
    vars: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    validate: (url, key) => 
      url && url.includes('supabase.co') && 
      key && key.startsWith('eyJ')
  },
  {
    name: 'Twilio SMS',
    vars: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'],
    validate: (sid, token, phone) => 
      sid && sid.startsWith('AC') && 
      token && token.length > 20 && 
      phone && phone.startsWith('+')
  }
];

let passedTests = 0;
let totalTests = tests.length;

tests.forEach(test => {
  const values = test.vars.map(varName => process.env[varName]);
  const isValid = test.validate(...values);
  
  console.log(`${isValid ? '✅' : '❌'} ${test.name}`);
  
  test.vars.forEach((varName, index) => {
    const value = values[index];
    const status = value && value !== 'your-' && value !== 'demo_' && value !== 'ACdemo' ? 
      (value.length > 20 ? `${value.substring(0, 20)}...` : value) : 
      '❌ NOT SET';
    console.log(`   ${varName}: ${status}`);
  });
  
  if (isValid) passedTests++;
  console.log('');
});

console.log('📊 Results Summary:');
console.log('==================');
console.log(`✅ Configured: ${passedTests}/${totalTests} services`);
console.log(`❌ Missing: ${totalTests - passedTests}/${totalTests} services\n`);

if (passedTests === totalTests) {
  console.log('🎉 All environment variables are properly configured!');
  console.log('✅ Ready for API function testing');
} else {
  console.log('⚠️  Some environment variables need attention:');
  
  if (!process.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL.includes('your-')) {
    console.log('- Set up your Supabase project and add the URL/keys');
  }
  
  if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID.startsWith('ACdemo')) {
    console.log('- Add your Twilio credentials for SMS functionality');
  }
}

console.log('\n💡 Next Steps:');
console.log('1. Update any missing credentials in .env.local');
console.log('2. Set environment variables in Netlify dashboard for production');
console.log('3. Test API functions: node test-api-functions.js --local');
console.log('4. Deploy to Netlify and test production APIs');
