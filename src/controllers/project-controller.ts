
import { NextFunction, Request, Response } from 'express';
import { createProjectService } from '../services/project-service';
import { getProjectTree as getTree } from '../services/project-service';

export async function createProject(req: Request, res: Response, next?: NextFunction): Promise<void> {
  try {
  
  
 const projectId = await createProjectService();

    res.status(200).json({
      message: 'Project directory created successfully',
      projectId,
    });

  } catch (error) {
    const err = error as Error;
    console.error('Error creating project folder:', err.message);
    res.status(500).json({
      error: err.message || 'Failed to create project directory',
    });
  }
}
export async function getProjectTree(req: Request, res: Response, next?: NextFunction): Promise<void> {
  const tree = await getTree(req.params.projectId);
  res.status(200).json({
    message: 'Project tree retrieved successfully',
    tree,       });
  }
