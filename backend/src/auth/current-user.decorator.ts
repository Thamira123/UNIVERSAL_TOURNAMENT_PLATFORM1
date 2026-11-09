import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
}

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): SessionUser => {
  const request = context.switchToHttp().getRequest<Request & { user: SessionUser }>();
  return request.user;
});
