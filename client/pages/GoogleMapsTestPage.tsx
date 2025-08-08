import React, { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppLayout } from "@/components/AppLayout";
import { GoogleMapComponent } from "@/components/GoogleMaps/GoogleMapComponent";
import { testGoogleMapsConnection, getGoogleMapsApiKey } from "@/lib/googleMaps";

export default function GoogleMapsTestPage() {
  const [apiStatus, setApiStatus] = useState<string>("Checking...");
  const [testResult, setTestResult] = useState<string>("");

  useEffect(() => {
    checkGoogleMapsStatus();
  }, []);

  const checkGoogleMapsStatus = async () => {
    console.log("🧪 Starting Google Maps diagnostic test...");
    
    // Check API key
    const apiKey = getGoogleMapsApiKey();
    console.log("🔑 API Key:", apiKey ? `${apiKey.substring(0, 10)}...` : "NOT FOUND");
    
    if (!apiKey) {
      setApiStatus("❌ No API Key");
      return;
    }
    
    setApiStatus("✅ API Key Found");
    
    // Test connection
    try {
      const isWorking = await testGoogleMapsConnection();
      setTestResult(isWorking ? "✅ Google Maps API Working" : "❌ Google Maps API Failed");
    } catch (error) {
      setTestResult(`❌ Error: ${error.message}`);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-2xl font-bold mb-6">Google Maps Diagnostic Test</h1>
        
        <div className="space-y-6">
          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle>API Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p><strong>API Key Status:</strong> {apiStatus}</p>
                <p><strong>Connection Test:</strong> {testResult}</p>
                <Button onClick={checkGoogleMapsStatus} className="mt-2">
                  Re-test Connection
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Simple Map Test */}
          <Card>
            <CardHeader>
              <CardTitle>Map Rendering Test</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">If you see a map below, Google Maps is working:</p>
              <GoogleMapComponent
                center={{ lat: 37.7749, lng: -122.4194 }} // San Francisco
                zoom={10}
                height="300px"
                className="border border-gray-300"
              />
            </CardContent>
          </Card>

          {/* Console Logs */}
          <Card>
            <CardHeader>
              <CardTitle>Debug Information</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Check the browser console (F12) for detailed logs about map loading.
                Look for messages starting with 🗝️, 📡, ✅, or ❌.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
