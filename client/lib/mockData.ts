// This file has been replaced with client/lib/dataService.ts
// All mock data functionality has been moved to use real Supabase data
//
// If you're looking for data operations, please use:
// import { dataService } from '@/lib/dataService';
//
// To populate sample data for demonstration, run:
// npm run populate-data

export * from './dataService';
export { dataService as mockDataService } from './dataService';

// Legacy mock project type export for compatibility
export type MockProject = import('./dataService').Project;
