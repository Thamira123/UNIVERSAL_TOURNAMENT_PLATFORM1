import { Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { ClerkService } from "./clerk.service";
import { PlatformAdminGuard } from "./platform-admin.guard";

@Module({ controllers: [AuthController], providers: [AuthService, ClerkService, AuthGuard, PlatformAdminGuard], exports: [AuthService, ClerkService, AuthGuard, PlatformAdminGuard] })
export class AuthModule {}
