import React from "react";
import { ProjectCard } from "@/components/ProjectCard";

interface ProjectGridProps {
  projects: any[];
  onDeleteProject: (id: string) => void;
  cardSize?: "small" | "medium" | "large";
  className?: string;
}

export function ProjectGrid({
  projects = [],
  onDeleteProject,
  cardSize = "small",
  className = "",
}: ProjectGridProps) {
  // Safety check for projects array
  if (!Array.isArray(projects)) {
    console.warn("ProjectGrid: projects prop is not an array, defaulting to empty array");
    return (
      <div className={`text-center text-muted-foreground p-8 ${className}`}>
        No projects available
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className={`text-center text-muted-foreground p-8 ${className}`}>
        No projects to display
      </div>
    );
  }

  // Determine grid columns based on card size
  const getGridClass = () => {
    switch (cardSize) {
      case "small":
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
      case "medium":
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3";
      case "large":
        return "grid-cols-1 md:grid-cols-2";
      default:
        return "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";
    }
  };

  return (
    <div className={`grid ${getGridClass()} gap-6 ${className}`}>
      {projects.map((project) => {
        // Safety check for project object
        if (!project || typeof project !== 'object' || !project.id) {
          console.warn("ProjectGrid: Invalid project object", project);
          return null;
        }

        return (
          <ProjectCard
            key={project.id}
            project={project}
            onDelete={() => onDeleteProject(project.id)}
          />
        );
      })}
    </div>
  );
}
