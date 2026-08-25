import { UserRole, UserStatus } from '@prisma/client';
import { Request } from 'express';

export type SafeUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AuthenticatedRequest = Request & { user: SafeUser };
