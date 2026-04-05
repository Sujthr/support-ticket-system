export interface JwtPayload {
  sub: string;        // userId
  email: string;
  role: string;
  organizationId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: string;
  organizationId: string;
}
