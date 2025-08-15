import React, { useEffect, useState } from 'react';
import { dataService } from '@/lib/dataService';

interface ImageDebuggerProps {
  projectId?: string;
}

export function ImageDebugger({ projectId = "project-1" }: ImageDebuggerProps) {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [imageTests, setImageTests] = useState<any[]>([]);

  const forceReinitialize = () => {
    // Clear localStorage and reload
    localStorage.removeItem('projects');
    localStorage.removeItem('users');
    localStorage.removeItem('clients');
    window.location.reload(); // Reload to see fresh data
  };

  useEffect(() => {
    // Load project data from dataService
    const loadProjectData = async () => {
      try {
        if (projectId) {
          const project = await dataService.getProject(projectId);
          setDebugInfo({ project });
        }
      } catch (error) {
        console.error('Error loading project data:', error);
      }
    };

    loadProjectData();

    // Check localStorage directly
    const projectsFromStorage = localStorage.getItem('projects');
    const projectsArray = projectsFromStorage ? JSON.parse(projectsFromStorage) : [];

    // Check specific project
    const project = projectsArray.find((p: any) => p.id === projectId);

    // Get project from mock service - this would need to be awaited
    let mockProject = null;

    // Test multiple image URLs including control URLs
    const imageTests: any[] = [];

    // Add control test URLs that should definitely work
    const controlUrls = [
      'https://picsum.photos/800/600?random=1',
      'https://picsum.photos/300/200?random=2',
      'https://via.placeholder.com/300x200.jpg'
    ];

    controlUrls.forEach((url, index) => {
      const testResult = {
        index: -index - 1, // Negative indices for control tests
        url,
        isString: true,
        loadSuccess: null as boolean | null,
        error: null as string | null,
        isControl: true
      };

      imageTests.push(testResult);

      const testImg = new Image();
      testImg.onload = () => {
        setImageTests(prev => prev.map(test =>
          test.index === testResult.index ? { ...test, loadSuccess: true } : test
        ));
      };
      testImg.onerror = (e) => {
        setImageTests(prev => prev.map(test =>
          test.index === testResult.index ? {
            ...test,
            loadSuccess: false,
            error: 'Network error or invalid URL'
          } : test
        ));
      };
      testImg.src = url;
    });

    // Test project photos from localStorage (legacy)
    // Note: Current dataService uses separate getProjectPhotos() method

    setImageTests(imageTests);

    setDebugInfo({
      projectId,
      projectsInStorage: projectsArray.length,
      projectFound: !!project,
      photosCount: 0, // Photos are now handled via getProjectPhotos()
      mockServiceProject: !!mockProject,
      mockServicePhotos: 0,
      mockDataInitialized: localStorage.getItem('projects') !== null,
      storageProject: project ? {
        id: project.id,
        name: project.name,
        photosStructure: null // Photos structure removed
      } : null
    });
  }, [projectId]);

  if (!debugInfo) return <div>Loading debug info...</div>;

  return (
    <div className="fixed top-4 right-4 bg-white p-4 border rounded shadow-lg text-xs max-w-sm z-50 max-h-96 overflow-y-auto">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold">Image Debug Info</h3>
        <button
          onClick={forceReinitialize}
          className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
        >
          Reinit
        </button>
      </div>
      <div className="space-y-1">
        <div>Project ID: {debugInfo.projectId}</div>
        <div>Projects in Storage: {debugInfo.projectsInStorage}</div>
        <div>Project Found: {debugInfo.projectFound ? 'Yes' : 'No'}</div>
        <div>Photos Count: {debugInfo.photosCount}</div>
        <div>Mock Service Project: {debugInfo.mockServiceProject ? 'Yes' : 'No'}</div>
        <div>Mock Service Photos: {debugInfo.mockServicePhotos}</div>
        <div>Mock Data Initialized: {debugInfo.mockDataInitialized ? 'Yes' : 'No'}</div>

        {imageTests.length > 0 && (
          <>
            <hr className="my-2" />
            <div className="font-semibold">Image Load Tests:</div>
            {imageTests.map((test, i) => (
              <div key={i} className={`border-l-2 pl-2 ml-2 mb-2 ${test.isControl ? 'border-blue-300' : 'border-gray-300'}`}>
                <div>{test.isControl ? `Control ${Math.abs(test.index)}` : `Photo ${test.index + 1}`}</div>
                <div className="text-xs text-gray-600 break-all">{test.url}</div>
                <div>Type: {test.isString ? 'String' : 'Object'}</div>
                <div>Status: {
                  test.loadSuccess === null ? 'Testing...' :
                  test.loadSuccess ? '✅ Success' : '❌ Failed'
                }</div>
                {test.error && <div className="text-red-500">{test.error}</div>}
              </div>
            ))}
          </>
        )}

        {debugInfo.storageProject && (
          <>
            <hr className="my-2" />
            <div>Project: {debugInfo.storageProject.name}</div>
            <div>Photos Structure:</div>
            <pre className="text-xs bg-gray-100 p-1 rounded">
              {JSON.stringify(debugInfo.storageProject.photosStructure, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}
