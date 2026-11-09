import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";
import { CurrentUser, type SessionUser } from "./current-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get("me") @UseGuards(AuthGuard)
  getProfile(@CurrentUser() user: SessionUser) { return this.auth.profile(user.id); }

  @Post("claim-admin") @UseGuards(AuthGuard)
  claimAdmin(@Body() body: unknown, @CurrentUser() user: SessionUser) { return this.auth.claimPlatformAdmin(user.id, body); }
}
