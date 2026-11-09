import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";
import type { SessionUser } from "./current-user.decorator";

@Injectable()
export class PlatformAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: SessionUser }>();
    if (!request.user) throw new UnauthorizedException("Sign in to continue.");
    if (request.user.role !== "ADMIN") throw new ForbiddenException("Platform administrator access is required.");
    return true;
  }
}
