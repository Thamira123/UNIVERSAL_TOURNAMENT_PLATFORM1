import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import { AuthService } from "./auth.service";
import { ClerkService } from "./clerk.service";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly auth: AuthService, private readonly clerk: ClerkService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) throw new UnauthorizedException("Sign in to continue.");
    const claims = await this.clerk.verifySessionToken(header.slice(7));
    if (!claims.sub) throw new UnauthorizedException("The Clerk session does not include a user ID.");
    request.user = await this.auth.syncClerkUser(claims.sub);
    return true;
  }
}
