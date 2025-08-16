import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw } from 'lucide-react';

export default function StatusTestPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [netlifyStat, setNetlifyStat] = useState<string>('Not tested');

  const testNetlifyFunctions = async () => {
    try {
      const response = await fetch('/.netlify/functions/api');
      setNetlifyStat(`API function: ${response.status} ${response.statusText}`);
    } catch (err) {
      setNetlifyStat(`Netlify functions unavailable: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const testStatusAPI = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing API at:', '/.netlify/functions/system-status');

      const response = await fetch('/.netlify/functions/system-status');

      console.log('Response status:', response.status);
      console.log('Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${response.statusText}. Body: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('Content-Type:', contentType);

      if (!contentType || !contentType.includes('application/json')) {
        const responseText = await response.text();
        throw new Error(`Expected JSON, got ${contentType}. Response: ${responseText}`);
      }

      const data = await response.json();
      console.log('Parsed data:', data);
      setResult(data);
    } catch (err) {
      console.error('API test error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">System Status API Test</h1>
        
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>API Test</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <Button
                onClick={testNetlifyFunctions}
                variant="outline"
                className="mr-2"
              >
                Test Netlify Functions
              </Button>
              <span className="text-sm text-gray-600">{netlifyStat}</span>
            </div>

            <Button
              onClick={testStatusAPI}
              disabled={isLoading}
              className="mb-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Test Status API
                </>
              )}
            </Button>
            
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
                <strong>Error:</strong> {error}
              </div>
            )}
            
            {result && (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <strong>API Response Received!</strong>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold">
                          <Badge variant={result.overallStatus === 'operational' ? 'default' : 'destructive'}>
                            {result.overallStatus}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600">Overall Status</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {result.servicesMonitored}
                        </div>
                        <p className="text-sm text-gray-600">Services Monitored</p>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {result.overallUptime?.toFixed(2)}%
                        </div>
                        <p className="text-sm text-gray-600">Overall Uptime</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Services ({result.systems?.length || 0})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {result.systems?.map((system: any, index: number) => (
                        <div key={index} className="flex items-center justify-between p-2 border rounded">
                          <span className="font-medium">{system.name}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant={system.status === 'operational' ? 'default' : 'destructive'}>
                              {system.status}
                            </Badge>
                            {system.responseTime && (
                              <span className="text-sm text-gray-500">
                                {system.responseTime}ms
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                
                {result.incidents?.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Active Incidents ({result.incidents.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {result.incidents.map((incident: any, index: number) => (
                          <div key={index} className="p-3 border border-yellow-200 bg-yellow-50 rounded">
                            <div className="font-medium">{incident.title}</div>
                            <div className="text-sm text-gray-600">{incident.description}</div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                
                <details className="mt-4">
                  <summary className="cursor-pointer font-medium">Raw API Response</summary>
                  <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
