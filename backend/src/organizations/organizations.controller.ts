import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type SessionUser } from "../auth/current-user.decorator";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { OrganizationsService } from "./organizations.service";

@UseGuards(AuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Post() @UseGuards(AuthGuard, PlatformAdminGuard) create(@Body() body: unknown, @CurrentUser() user: SessionUser) { return this.organizations.create(body, user); }
  @Get("mine") mine(@CurrentUser() user: SessionUser) { return this.organizations.mine(user.id); }
  @Get(":id") getOne(@Param("id") id: string, @CurrentUser() user: SessionUser) { return this.organizations.getOne(id, user.id); }
  @Post(":id/admins") addAdmin(@Param("id") id: string, @Body() body: unknown, @CurrentUser() user: SessionUser) { return this.organizations.addAdmin(id, body, user.id); }
  @Get(":id/tournaments") tournaments(@Param("id") id: string, @CurrentUser() user: SessionUser) { return this.organizations.tournaments(id, user.id); }
  @Post(":id/tournaments") @UseGuards(AuthGuard, PlatformAdminGuard) createTournament(@Param("id") id: string, @Body() body: unknown, @CurrentUser() user: SessionUser) { return this.organizations.createTournament(id, body, user.id); }
}
