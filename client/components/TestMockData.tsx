import React from 'react';
import { Button } from '@/components/ui/button';
import { mockApiService } from '@/lib/mockApiService';
import { toast } from 'sonner';

export function TestMockData() {
  const handleReinitialize = () => {
    try {
      // Clear localStorage
      localStorage.removeItem('projects');
      localStorage.removeItem('users');
      localStorage.removeItem('clients');
      
      // mockApiService doesn't need reinitialization - data is static
      
      // Check what we have
      const projects = JSON.parse(localStorage.getItem('projects') || '[]');
      console.log('Test: Reinitialized projects:', projects.length);
      if (projects.length > 0) {
        console.log('Test: First project photos:', projects[0].photos?.length || 0);
        console.log('Test: Sample photo:', projects[0].photos?.[0]);
      }
      
      toast.success(`Reinitialized with ${projects.length} projects`);
      
      // Reload to see changes
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Test: Error reinitializing:', error);
      toast.error('Error reinitializing mock data');
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <Button onClick={handleReinitialize} variant="destructive">
        Reinitialize Mock Data
      </Button>
    </div>
  );
}
