export interface IUser {
  username: string;
  email: string;
  password: string;
  isActive?: boolean;
  avatarUrl?: string;
  lastLoginAt?: Date;
 projectsCreated?: number;
}

