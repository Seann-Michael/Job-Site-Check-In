#!/usr/bin/env node

/**
 * API Function Testing Script
 *
 * This script tests the API functions locally during development.
 * Run with: node test-api-functions.js
 */

const https = require("https");
const http = require("http");

// Configuration
const BASE_URL = process.env.TEST_BASE_URL || "https://your-site.netlify.app";
const LOCAL_URL = "http://localhost:8888"; // Netlify Dev local URL

console.log("🧪 API Function Testing Script");
console.log("===============================\n");

// Test data
const testData = {
  email: {
    to: "test@example.com",
    subject: "Test Email from Local SEO Ranker",
    template: "geo-grid-share",
    templateData: {
      userName: "Test User",
      results: [
        {
          businessName: "Test Pizza Restaurant",
          keyword: "pizza near me",
          averageRanking: "2.3",
        },
      ],
      publicUrl: "https://example.com/results/123",
    },
  },
  sms: {
    to: "+1234567890", // Replace with your test number
    template: "geo-grid-share",
    templateData: {
      userName: "Test User",
      businessCount: 1,
      results: [
        {
          businessName: "Test Pizza Restaurant",
          keyword: "pizza near me",
        },
      ],
      publicUrl: "https://example.com/results/123",
    },
  },
  dataforseo: {
    keyword: "pizza restaurant",
    location: "New York, NY, United States",
    business_name: "Test Pizza Place",
    grid_size: 5,
    language: "en",
    depth: 10,
  },
  mediaUpload: {
    fileName: "test-image.jpg",
    fileType: "image/jpeg",
    fileData:
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", // 1x1 pixel PNG in base64
    projectId: "550e8400-e29b-41d4-a716-446655440000",
    category: "test",
  },
};

// Helper function to make HTTP requests
function makeRequest(url, method = "POST", data = null) {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith("https:");
    const client = isHttps ? https : http;

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (data && method !== "GET") {
      const postData = JSON.stringify(data);
      options.headers["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = client.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const jsonBody = JSON.parse(body);
          resolve({ status: res.statusCode, data: jsonBody });
        } catch (e) {
          resolve({ status: res.statusCode, data: body });
        }
      });
    });

    req.on("error", reject);

    if (data && method !== "GET") {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

// Test functions
async function testEmailFunction(baseUrl) {
  console.log("📧 Testing Email Function...");
  try {
    const response = await makeRequest(
      `${baseUrl}/.netlify/functions/send-email`,
      "POST",
      testData.email,
    );
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, response.data);
    return response.status === 200;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testSMSFunction(baseUrl) {
  console.log("📱 Testing SMS Function...");
  try {
    const response = await makeRequest(
      `${baseUrl}/.netlify/functions/send-sms`,
      "POST",
      testData.sms,
    );
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, response.data);
    return response.status === 200;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testDataForSEOFunction(baseUrl) {
  console.log("🔍 Testing DataForSEO Function...");
  try {
    const response = await makeRequest(
      `${baseUrl}/.netlify/functions/dataforseo-service`,
      "POST",
      testData.dataforseo,
    );
    console.log(`   Status: ${response.status}`);
    console.log(`   Response:`, response.data);
    return response.status === 200;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

async function testMediaStorageFunction(baseUrl) {
  console.log("🗄️ Testing Media Storage Function...");

  // Test upload
  try {
    const uploadResponse = await makeRequest(
      `${baseUrl}/.netlify/functions/media-storage`,
      "POST",
      testData.mediaUpload,
    );
    console.log(`   Upload Status: ${uploadResponse.status}`);
    console.log(`   Upload Response:`, uploadResponse.data);

    // Test list
    const listResponse = await makeRequest(
      `${baseUrl}/.netlify/functions/media-storage?limit=5`,
      "GET",
    );
    console.log(`   List Status: ${listResponse.status}`);
    console.log(`   List Response:`, listResponse.data);

    return uploadResponse.status === 200 && listResponse.status === 200;
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return false;
  }
}

// Main test runner
async function runTests() {
  const isLocal = process.argv.includes("--local");
  const testUrl = isLocal ? LOCAL_URL : BASE_URL;

  console.log(`🎯 Testing against: ${testUrl}\n`);

  if (isLocal) {
    console.log("💡 Make sure you have Netlify Dev running: netlify dev\n");
  }

  const results = {
    email: await testEmailFunction(testUrl),
    sms: await testSMSFunction(testUrl),
    dataforseo: await testDataForSEOFunction(testUrl),
    mediaStorage: await testMediaStorageFunction(testUrl),
  };

  console.log("\n📊 Test Results Summary:");
  console.log("=======================");
  Object.entries(results).forEach(([name, passed]) => {
    console.log(
      `${passed ? "✅" : "❌"} ${name}: ${passed ? "PASSED" : "FAILED"}`,
    );
  });

  const passedCount = Object.values(results).filter(Boolean).length;
  const totalCount = Object.keys(results).length;

  console.log(`\n🎉 ${passedCount}/${totalCount} tests passed`);

  if (passedCount < totalCount) {
    console.log("\n💡 Troubleshooting Tips:");
    console.log("- Ensure all environment variables are set in .env.local");
    console.log("- Check API keys are valid and have proper permissions");
    console.log("- For local testing: run `netlify dev` first");
    console.log(
      "- For production testing: ensure environment variables are set in Netlify dashboard",
    );
  }
}

// Handle command line arguments
if (process.argv.includes("--help") || process.argv.includes("-h")) {
  console.log("Usage: node test-api-functions.js [--local]");
  console.log("");
  console.log("Options:");
  console.log(
    "  --local    Test against local Netlify Dev server (http://localhost:8888)",
  );
  console.log("  --help     Show this help message");
  console.log("");
  console.log("Environment Variables:");
  console.log(
    "  TEST_BASE_URL    Override the base URL for testing (default: https://your-site.netlify.app)",
  );
  process.exit(0);
}

// Run the tests
runTests().catch(console.error);
