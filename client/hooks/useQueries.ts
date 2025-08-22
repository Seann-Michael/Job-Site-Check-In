import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys, CACHE_TIMES, invalidateQueries } from '@/lib/queryClient';
import { dataService } from '@/lib/dataService';
import { toast } from 'sonner';

// User queries
export const useUsers = (filters?: any) => {
  return useQuery({
    queryKey: queryKeys.users.list(filters),
    queryFn: async () => {
      const response = await dataService.getUsers(filters);
      return response;
    },
    ...CACHE_TIMES.MEDIUM,
  });
};

export const useUserProfile = () => {
  return useQuery({
    queryKey: queryKeys.users.profile(),
    queryFn: async () => {
      const user = await dataService.getCurrentUser();
      return user;
    },
    ...CACHE_TIMES.SHORT,
    retry: 3,
  });
};

// Business queries
export const useBusinesses = (ownerId?: string, filters?: any) => {
  return useQuery({
    queryKey: queryKeys.businesses.list(ownerId, filters),
    queryFn: async () => {
      const response = await dataService.getBusinesses(ownerId, filters);
      return response;
    },
    ...CACHE_TIMES.MEDIUM,
    enabled: !!ownerId || filters, // Only run if we have an owner ID or filters
  });
};

export const useBusiness = (id: string) => {
  return useQuery({
    queryKey: queryKeys.businesses.detail(id),
    queryFn: async () => {
      const business = await dataService.getBusiness(id);
      return business;
    },
    ...CACHE_TIMES.MEDIUM,
    enabled: !!id,
  });
};

// Project queries
export const useProjects = (businessId?: string, filters?: any) => {
  return useQuery({
    queryKey: queryKeys.projects.list(businessId, filters),
    queryFn: async () => {
      const response = await dataService.getProjects(businessId, filters);
      return response;
    },
    ...CACHE_TIMES.MEDIUM,
  });
};

export const useProject = (id: string) => {
  return useQuery({
    queryKey: queryKeys.projects.detail(id),
    queryFn: async () => {
      const project = await dataService.getProject(id);
      return project;
    },
    ...CACHE_TIMES.MEDIUM,
    enabled: !!id,
  });
};

// Keyword queries would go here (if implemented)
export const useKeywords = (businessId: string, filters?: any) => {
  return useQuery({
    queryKey: queryKeys.keywords.list(businessId, filters),
    queryFn: async () => {
      // Implementation would depend on the actual keyword service
      // const response = await keywordService.getKeywords(businessId, filters);
      // return response;
      return { data: [], pagination: null }; // Placeholder
    },
    ...CACHE_TIMES.MEDIUM,
    enabled: !!businessId,
  });
};

// Analytics queries (shorter cache due to frequently changing data)
export const useAnalyticsSummary = (timeRange?: string) => {
  return useQuery({
    queryKey: queryKeys.analytics.summary(timeRange),
    queryFn: async () => {
      // Implementation would depend on analytics service
      // const data = await analyticsService.getSummary(timeRange);
      // return data;
      return {}; // Placeholder
    },
    ...CACHE_TIMES.SHORT,
  });
};

// Credit system queries
export const useCreditBalance = () => {
  return useQuery({
    queryKey: queryKeys.credits.balance(),
    queryFn: async () => {
      // Implementation would use credit service
      // const balance = await creditService.getBalance();
      // return balance;
      return { current_credits: 0, total_purchased: 0 }; // Placeholder
    },
    ...CACHE_TIMES.SHORT,
  });
};

export const useCreditTransactions = (filters?: any) => {
  return useQuery({
    queryKey: queryKeys.credits.transactions(filters),
    queryFn: async () => {
      // Implementation would use credit service
      // const response = await creditService.getTransactions(filters);
      // return response;
      return { data: [], pagination: null }; // Placeholder
    },
    ...CACHE_TIMES.SHORT,
  });
};

// Mutation hooks with cache invalidation
export const useCreateBusiness = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (businessData: any) => {
      return await dataService.createBusiness(businessData);
    },
    onSuccess: (data) => {
      // Invalidate and refetch businesses list
      invalidateQueries.businesses();
      
      // Optionally, update the cache directly for immediate UI update
      queryClient.setQueryData(
        queryKeys.businesses.detail(data.id),
        data
      );
      
      toast.success('Business created successfully!');
    },
    onError: (error: any) => {
      toast.error(`Failed to create business: ${error.message}`);
    },
  });
};

export const useUpdateBusiness = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await dataService.updateBusiness(id, updates);
    },
    onSuccess: (data, variables) => {
      // Update the specific business in cache
      queryClient.setQueryData(
        queryKeys.businesses.detail(variables.id),
        data
      );
      
      // Invalidate businesses list to reflect changes
      invalidateQueries.businesses();
      
      toast.success('Business updated successfully!');
    },
    onError: (error: any) => {
      toast.error(`Failed to update business: ${error.message}`);
    },
  });
};

export const useDeleteBusiness = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (id: string) => {
      return await dataService.deleteBusiness(id);
    },
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({
        queryKey: queryKeys.businesses.detail(deletedId)
      });
      
      // Invalidate businesses list
      invalidateQueries.businesses();
      
      // Also invalidate related projects
      invalidateQueries.businessProjects(deletedId);
      
      toast.success('Business deleted successfully!');
    },
    onError: (error: any) => {
      toast.error(`Failed to delete business: ${error.message}`);
    },
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (projectData: any) => {
      return await dataService.createProject(projectData);
    },
    onSuccess: (data) => {
      // Invalidate projects list
      invalidateQueries.projects();
      
      // Optionally, update the cache directly
      queryClient.setQueryData(
        queryKeys.projects.detail(data.id),
        data
      );
      
      toast.success('Project created successfully!');
    },
    onError: (error: any) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      return await dataService.updateProject(id, updates);
    },
    onSuccess: (data, variables) => {
      // Update the specific project in cache
      queryClient.setQueryData(
        queryKeys.projects.detail(variables.id),
        data
      );
      
      // Invalidate projects list
      invalidateQueries.projects();
      
      toast.success('Project updated successfully!');
    },
    onError: (error: any) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });
};

// Optimistic updates for frequently changed data
export const useToggleProjectStatus = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return await dataService.updateProject(id, { status });
    },
    // Optimistic update
    onMutate: async ({ id, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.projects.detail(id) });
      
      // Snapshot the previous value
      const previousProject = queryClient.getQueryData(queryKeys.projects.detail(id));
      
      // Optimistically update to the new value
      queryClient.setQueryData(queryKeys.projects.detail(id), (old: any) => ({
        ...old,
        status,
      }));
      
      // Return a context object with the snapshotted value
      return { previousProject };
    },
    // If the mutation fails, use the context to roll back
    onError: (err, variables, context) => {
      if (context?.previousProject) {
        queryClient.setQueryData(
          queryKeys.projects.detail(variables.id),
          context.previousProject
        );
      }
      toast.error('Failed to update project status');
    },
    // Always refetch after error or success
    onSettled: (data, error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.projects.detail(variables.id)
      });
    },
  });
};

// Background refetch for real-time data
export const useRealtimeData = () => {
  const queryClient = useQueryClient();
  
  // Refetch critical data in the background every 30 seconds
  return useQuery({
    queryKey: ['realtime-refresh'],
    queryFn: async () => {
      // Silently refetch critical queries in the background
      await Promise.all([
        queryClient.refetchQueries({ queryKey: queryKeys.credits.balance() }),
        queryClient.refetchQueries({ queryKey: queryKeys.analytics.summary() }),
      ]);
      return Date.now();
    },
    refetchInterval: 30 * 1000, // 30 seconds
    refetchIntervalInBackground: true,
    staleTime: Infinity, // This query result is never stale
  });
};
