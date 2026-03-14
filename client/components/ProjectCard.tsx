import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, MapPin, Images, CheckCircle, Star, Building2, User } from "lucide-react";
import { Link } from "react-router-dom";
import React, { useState } from "react";
import { toast } from "sonner";
import { Project } from "@/lib/dataService";
import { ImageWithFallback } from "@/components/ImageWithFallback";

interface ProjectCardProps {
  project: Project;
  primaryPhotoUrl?: string;
  onDelete?: () => void;
  onMarkIncomplete?: () => void;
  onToggleStar?: (starred: boolean) => void;
}

export function ProjectCard({
  project,
  primaryPhotoUrl,
  onDelete,
  onMarkIncomplete,
  onToggleStar,
}: ProjectCardProps) {
  const [isStarred, setIsStarred] = useState(project.priority === 'high' || project.priority === 'urgent');

  const handleStarClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newStarred = !isStarred;
    setIsStarred(newStarred);
    onToggleStar?.(newStarred);
    toast.success(newStarred ? "Job starred" : "Job unstarred");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'in_progress':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      case 'completed':
        return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'cancelled':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'draft':
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500/10 text-red-700 dark:text-red-400';
      case 'high':
        return 'bg-orange-500/10 text-orange-700 dark:text-orange-400';
      case 'medium':
        return 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400';
      case 'low':
        return 'bg-green-500/10 text-green-700 dark:text-green-400';
      default:
        return 'bg-gray-500/10 text-gray-700 dark:text-gray-400';
    }
  };

  const getTypeLabel = (type: string) => {
    const typeLabels: Record<string, string> = {
      'seo_audit': 'SEO Audit',
      'local_optimization': 'Local SEO',
      'content_marketing': 'Content Marketing',
      'reputation_management': 'Reputation Mgmt',
      'technical_seo': 'Technical SEO',
      'link_building': 'Link Building',
      'ongoing_optimization': 'Ongoing SEO'
    };
    return typeLabels[type] || type;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return 'No date';
    }
  };

  const getDaysRemaining = () => {
    if (!project.due_date) return null;
    
    const dueDate = new Date(project.due_date);
    const today = new Date();
    const diffTime = dueDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return `${Math.abs(diffDays)} days overdue`;
    if (diffDays === 0) return 'Due today';
    if (diffDays === 1) return '1 day remaining';
    return `${diffDays} days remaining`;
  };

  const daysRemaining = getDaysRemaining();
  const isOverdue = project.due_date && new Date(project.due_date) < new Date();

  return (
    <Card className="group relative overflow-hidden transition-all hover:shadow-lg hover:border-primary/20">
      <Link to={`/job/${project.id}`} className="block">
        <CardContent className="p-0">
          {/* Header with project image/placeholder */}
          <div className="relative h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center overflow-hidden">
            {primaryPhotoUrl ? (
              <img
                src={primaryPhotoUrl}
                alt={project.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-purple-600/20" />
            )}
            <div className="relative z-10 text-center" style={{ display: primaryPhotoUrl ? 'none' : undefined }}>
              <Building2 className="w-8 h-8 mx-auto mb-2 text-primary/60" />
              <Badge variant="secondary" className="text-xs">
                {getTypeLabel(project.type)}
              </Badge>
            </div>

            {/* Type badge overlay when photo is shown */}
            {primaryPhotoUrl && (
              <div className="absolute bottom-2 left-2 z-10">
                <Badge variant="secondary" className="text-xs bg-black/50 text-white border-0">
                  {getTypeLabel(project.type)}
                </Badge>
              </div>
            )}

            {/* Star button */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-2 right-2 h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={handleStarClick}
            >
              <Star
                className={`h-4 w-4 ${
                  isStarred
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-muted-foreground hover:text-yellow-400'
                }`}
              />
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Title and Status */}
            <div className="space-y-2">
              <h3 className="font-semibold text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={getStatusColor(project.status)}>
                  {project.status.replace('_', ' ')}
                </Badge>
                <Badge variant="outline" className={getPriorityColor(project.priority)}>
                  {project.priority}
                </Badge>
              </div>
            </div>

            {/* Description */}
            {project.description && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {project.description}
              </p>
            )}

            {/* Project details */}
            <div className="space-y-2 text-sm text-muted-foreground">
              {/* Client contact */}
              {project.client_contact?.name && (
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4" />
                  <span>{project.client_contact.name}</span>
                </div>
              )}

              {/* Created date */}
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4" />
                <span>Created {formatDate(project.created_at)}</span>
              </div>

              {/* Due date */}
              {project.due_date && (
                <div className="flex items-center gap-2">
                  <CalendarDays className="w-4 h-4" />
                  <span className={isOverdue ? 'text-red-600 font-medium' : ''}>
                    {daysRemaining}
                  </span>
                </div>
              )}
            </div>


            {/* Keywords preview */}
            {project.seo_targets?.target_keywords && project.seo_targets.target_keywords.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Target Keywords:</p>
                <div className="flex flex-wrap gap-1">
                  {project.seo_targets.target_keywords.slice(0, 3).map((keyword: string, index: number) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {keyword}
                    </Badge>
                  ))}
                  {project.seo_targets.target_keywords.length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{project.seo_targets.target_keywords.length - 3} more
                    </Badge>
                  )}
                </div>
              </div>
            )}


            {/* Action buttons (show on hover) */}
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity pt-2">
              <Button variant="outline" size="sm" className="flex-1">
                View Details
              </Button>
              {project.status === 'completed' && onMarkIncomplete && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault();
                    onMarkIncomplete();
                  }}
                >
                  <CheckCircle className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
