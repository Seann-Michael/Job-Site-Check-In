import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'your-supabase-url';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sample data generation
const generateSampleData = {
  // Sample users (business owners and agency staff)
  users: [
    {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'john.doe@example.com',
      name: 'John Doe',
      role: 'business_owner',
      phone: '+1 (555) 123-4567',
      avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      email_verified: true,
      phone_verified: false,
      is_2fa_enabled: false,
      metadata: {
        timezone: 'America/New_York',
        notifications: { email: true, sms: false, push: true }
      }
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'sarah.johnson@seoproagency.com',
      name: 'Sarah Johnson',
      role: 'agency_admin',
      phone: '+1 (555) 987-6543',
      avatar_url: 'https://images.unsplash.com/photo-1494790108755-2616b3ecbfde?w=150&h=150&fit=crop&crop=face',
      email_verified: true,
      phone_verified: true,
      is_2fa_enabled: true,
      metadata: {
        timezone: 'America/Los_Angeles',
        notifications: { email: true, sms: true, push: true }
      }
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'mike.chen@example.com',
      name: 'Mike Chen',
      role: 'business_owner',
      phone: '+1 (555) 456-7890',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      email_verified: true,
      phone_verified: true,
      is_2fa_enabled: false,
      metadata: {
        timezone: 'America/Chicago',
        notifications: { email: true, sms: false, push: false }
      }
    }
  ],

  // Sample agencies
  agencies: [
    {
      id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      name: 'SEO Pro Agency',
      description: 'Premier local SEO services for small and medium businesses',
      logo_url: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=200&h=200&fit=crop',
      website: 'https://seoproagency.com',
      primary_contact: {
        name: 'Sarah Johnson',
        email: 'sarah.johnson@seoproagency.com',
        phone: '+1 (555) 987-6543'
      },
      address: {
        street: '123 Digital Marketing Blvd',
        city: 'San Francisco',
        state: 'CA',
        zipCode: '94107',
        country: 'USA'
      },
      phone: '+1 (555) 987-6543',
      email: 'hello@seoproagency.com',
      subscription_tier: 'professional',
      subscription_status: 'active',
      settings: {
        branding: { primary_color: '#3B82F6', secondary_color: '#1E40AF' },
        features: { white_label: true, client_portal: true, reporting: true }
      }
    }
  ],

  // Sample businesses
  businesses: [
    {
      id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      owner_id: '11111111-1111-1111-1111-111111111111',
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
        facebook: 'https://facebook.com/tonysitalian',
        instagram: 'https://instagram.com/tonysitalian',
        yelp: 'https://yelp.com/biz/tonys-italian-restaurant'
      },
      status: 'active'
    },
    {
      id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      owner_id: '33333333-3333-3333-3333-333333333333',
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
      status: 'active'
    }
  ],

  // Sample projects
  projects: [
    {
      id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      name: 'Local SEO Optimization Campaign',
      description: 'Comprehensive local SEO strategy to improve online visibility and drive more foot traffic',
      type: 'local_optimization',
      status: 'active',
      priority: 'high',
      assigned_to: '22222222-2222-2222-2222-222222222222',
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
      started_at: '2024-01-15T09:00:00Z',
      due_date: '2024-06-15T17:00:00Z'
    },
    {
      id: 'qqqqqqqq-qqqq-qqqq-qqqq-qqqqqqqqqqqq',
      business_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      name: 'Technical SEO Audit & Optimization',
      description: 'Comprehensive technical SEO audit and implementation of critical fixes',
      type: 'technical_seo',
      status: 'in_progress',
      priority: 'medium',
      assigned_to: '22222222-2222-2222-2222-222222222222',
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
      started_at: '2024-02-01T09:00:00Z',
      due_date: '2024-05-01T17:00:00Z'
    }
  ],

  // Sample project tasks
  project_tasks: [
    {
      id: 'tttttttt-tttt-tttt-tttt-tttttttttttt',
      project_id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
      title: 'Complete keyword research analysis',
      description: 'Research and analyze target keywords for local search optimization',
      status: 'completed',
      priority: 'high',
      assigned_to: '22222222-2222-2222-2222-222222222222',
      assigned_by: '22222222-2222-2222-2222-222222222222',
      estimated_hours: 8,
      actual_hours: 6.5,
      due_date: '2024-01-25T17:00:00Z',
      started_at: '2024-01-20T09:00:00Z',
      completed_at: '2024-01-24T15:30:00Z',
      progress_percentage: 100,
      labels: ['research', 'keywords', 'high-priority']
    },
    {
      id: 'uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu',
      project_id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
      title: 'Optimize Google My Business profile',
      description: 'Update GMB profile with optimized descriptions, photos, and business information',
      status: 'in_progress',
      priority: 'high',
      assigned_to: '22222222-2222-2222-2222-222222222222',
      assigned_by: '22222222-2222-2222-2222-222222222222',
      estimated_hours: 4,
      actual_hours: 2,
      due_date: '2024-02-10T17:00:00Z',
      started_at: '2024-02-05T09:00:00Z',
      progress_percentage: 60,
      labels: ['gmb', 'optimization']
    }
  ],

  // Sample reviews
  reviews: [
    {
      id: 'rrrrrrrr-rrrr-rrrr-rrrr-rrrrrrrrrrrr',
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      platform: 'google',
      platform_review_id: 'google_review_123456',
      rating: 5,
      title: 'Amazing authentic Italian food!',
      text: 'Tony\'s has the best pasta in Boston! The atmosphere is cozy and the service is excellent. Highly recommend the carbonara and tiramisu.',
      author: {
        name: 'Jennifer Smith',
        profile_photo: 'https://images.unsplash.com/photo-1494790108755-2616b3ecbfde?w=50&h=50&fit=crop&crop=face'
      },
      date: '2024-01-20T19:30:00Z',
      response: {
        text: 'Thank you so much Jennifer! We\'re thrilled you enjoyed your dining experience. Hope to see you again soon!',
        date: '2024-01-21T10:00:00Z'
      },
      is_verified: true,
      is_featured: true
    },
    {
      id: 'ssssssss-ssss-ssss-ssss-ssssssssssss',
      business_id: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
      platform: 'google',
      platform_review_id: 'google_review_789012',
      rating: 4,
      text: 'Great service and honest pricing. Fixed my transmission issue quickly and explained everything clearly.',
      author: {
        name: 'Robert Johnson'
      },
      date: '2024-01-18T14:15:00Z',
      is_verified: true
    }
  ],

  // Sample keywords
  keywords: [
    {
      id: 'kkkkkkkk-kkkk-kkkk-kkkk-kkkkkkkkkkkk',
      project_id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
      keyword: 'italian restaurant boston',
      search_volume: 1200,
      competition: 'high',
      difficulty_score: 75,
      intent: 'local',
      location: 'Boston, MA',
      device: 'mobile'
    },
    {
      id: 'llllllll-llll-llll-llll-llllllllllll',
      project_id: 'pppppppp-pppp-pppp-pppp-pppppppppppp',
      keyword: 'best pasta boston',
      search_volume: 800,
      competition: 'medium',
      difficulty_score: 60,
      intent: 'local',
      location: 'Boston, MA',
      device: 'mobile'
    }
  ],

  // Sample local rankings
  local_rankings: [
    {
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      keyword: 'italian restaurant boston',
      location: 'Boston, MA',
      search_type: 'local_pack',
      position: 8,
      visibility_score: 65,
      distance_from_centroid: 0.5,
      tracked_date: '2024-01-20',
      search_engine: 'google',
      device: 'mobile',
      ranking_url: 'https://tonysitalian.com'
    },
    {
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      keyword: 'best pasta boston',
      location: 'Boston, MA',
      search_type: 'local_pack',
      position: 15,
      visibility_score: 45,
      distance_from_centroid: 0.8,
      tracked_date: '2024-01-20',
      search_engine: 'google',
      device: 'mobile',
      ranking_url: 'https://tonysitalian.com'
    }
  ],

  // Sample citations
  citations: [
    {
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      directory_name: 'Yelp',
      directory_url: 'https://yelp.com',
      business_listing_url: 'https://yelp.com/biz/tonys-italian-restaurant',
      citation_status: 'verified',
      business_name: 'Tony\'s Italian Restaurant',
      address: {
        street: '456 Main Street',
        city: 'Boston',
        state: 'MA',
        zipCode: '02101'
      },
      phone: '+1 (617) 555-0123',
      website: 'https://tonysitalian.com',
      category: 'Italian Restaurant',
      nap_consistency_score: 98,
      domain_authority: 95,
      directory_type: 'review_site',
      submission_date: '2024-01-15T10:00:00Z',
      last_verified: '2024-01-20T14:30:00Z',
      verification_status: 'verified'
    }
  ]
};

// Function to populate the database
async function populateSampleData() {
  console.log('🚀 Starting to populate sample data...');

  try {
    // 1. Insert users
    console.log('📝 Inserting users...');
    const { error: usersError } = await supabase
      .from('users')
      .upsert(generateSampleData.users, { onConflict: 'id' });
    
    if (usersError) {
      console.error('Error inserting users:', usersError);
      throw usersError;
    }
    console.log('✅ Users inserted successfully');

    // 2. Insert agencies
    console.log('📝 Inserting agencies...');
    const { error: agenciesError } = await supabase
      .from('agencies')
      .upsert(generateSampleData.agencies, { onConflict: 'id' });
    
    if (agenciesError) {
      console.error('Error inserting agencies:', agenciesError);
      throw agenciesError;
    }
    console.log('✅ Agencies inserted successfully');

    // 3. Insert businesses
    console.log('📝 Inserting businesses...');
    const { error: businessesError } = await supabase
      .from('businesses')
      .upsert(generateSampleData.businesses, { onConflict: 'id' });
    
    if (businessesError) {
      console.error('Error inserting businesses:', businessesError);
      throw businessesError;
    }
    console.log('✅ Businesses inserted successfully');

    // 4. Insert projects
    console.log('📝 Inserting projects...');
    const { error: projectsError } = await supabase
      .from('projects')
      .upsert(generateSampleData.projects, { onConflict: 'id' });
    
    if (projectsError) {
      console.error('Error inserting projects:', projectsError);
      throw projectsError;
    }
    console.log('✅ Projects inserted successfully');

    // 5. Insert project tasks
    console.log('📝 Inserting project tasks...');
    const { error: tasksError } = await supabase
      .from('project_tasks')
      .upsert(generateSampleData.project_tasks, { onConflict: 'id' });
    
    if (tasksError) {
      console.error('Error inserting project tasks:', tasksError);
      throw tasksError;
    }
    console.log('✅ Project tasks inserted successfully');

    // 6. Insert reviews
    console.log('📝 Inserting reviews...');
    const { error: reviewsError } = await supabase
      .from('reviews')
      .upsert(generateSampleData.reviews, { onConflict: 'id' });
    
    if (reviewsError) {
      console.error('Error inserting reviews:', reviewsError);
      throw reviewsError;
    }
    console.log('✅ Reviews inserted successfully');

    // 7. Insert keywords
    console.log('📝 Inserting keywords...');
    const { error: keywordsError } = await supabase
      .from('keywords')
      .upsert(generateSampleData.keywords, { onConflict: 'id' });
    
    if (keywordsError) {
      console.error('Error inserting keywords:', keywordsError);
      throw keywordsError;
    }
    console.log('✅ Keywords inserted successfully');

    // 8. Insert local rankings
    console.log('📝 Inserting local rankings...');
    const { error: rankingsError } = await supabase
      .from('local_rankings')
      .insert(generateSampleData.local_rankings);
    
    if (rankingsError) {
      console.error('Error inserting local rankings:', rankingsError);
      throw rankingsError;
    }
    console.log('✅ Local rankings inserted successfully');

    // 9. Insert citations
    console.log('📝 Inserting citations...');
    const { error: citationsError } = await supabase
      .from('citations')
      .upsert(generateSampleData.citations, { onConflict: 'id' });
    
    if (citationsError) {
      console.error('Error inserting citations:', citationsError);
      throw citationsError;
    }
    console.log('✅ Citations inserted successfully');

    console.log('🎉 Sample data population completed successfully!');
    
    // Generate some analytics data
    console.log('📊 Generating analytics data...');
    await generateAnalyticsData();
    
  } catch (error) {
    console.error('❌ Error populating sample data:', error);
    process.exit(1);
  }
}

// Generate sample analytics data
async function generateAnalyticsData() {
  const analyticsData = [];
  const startDate = new Date('2024-01-01');
  const endDate = new Date();
  
  // Generate daily analytics for the past period
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];
    
    // Organic traffic data
    analyticsData.push({
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      metric_type: 'organic_traffic',
      metric_name: 'Daily Organic Sessions',
      value: Math.floor(Math.random() * 100) + 50,
      date: dateStr,
      data_source: 'google_analytics'
    });
    
    // Phone calls
    analyticsData.push({
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      metric_type: 'phone_calls',
      metric_name: 'GMB Phone Calls',
      value: Math.floor(Math.random() * 10) + 2,
      date: dateStr,
      data_source: 'google_my_business'
    });
    
    // Direction requests
    analyticsData.push({
      business_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
      metric_type: 'direction_requests',
      metric_name: 'GMB Direction Requests',
      value: Math.floor(Math.random() * 20) + 5,
      date: dateStr,
      data_source: 'google_my_business'
    });
  }
  
  const { error } = await supabase
    .from('analytics')
    .insert(analyticsData);
    
  if (error) {
    console.error('Error generating analytics data:', error);
  } else {
    console.log('✅ Analytics data generated successfully');
  }
}

// Run the population script
if (require.main === module) {
  populateSampleData();
}

export { populateSampleData };
