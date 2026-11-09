import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type SessionUser } from "../auth/current-user.decorator";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminService } from "./admin.service";

@Controller()
@UseGuards(AuthGuard)
export class TournamentRequestsController {
  constructor(private readonly admin: AdminService) {}

  @Get("tournament-requests/mine") mine(@CurrentUser() user: SessionUser) { return this.admin.myRequests(user.id); }
  @Post("tournament-requests") create(@Body() body: unknown, @CurrentUser() user: SessionUser) { return this.admin.createRequest(body, user); }
}

@Controller("admin")
@UseGuards(AuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("users") users() { return this.admin.listUsers(); }
  @Get("organizations") organizations() { return this.admin.listOrganizations(); }
  @Get("tournaments") tournaments() { return this.admin.listTournaments(); }
  @Get("tournament-requests") requests() { return this.admin.listRequests(); }
  @Patch("organizations/:id") updateOrganization(@Param("id") id: string, @Body() body: unknown) { return this.admin.updateOrganization(id, body); }
  @Delete("organizations/:id") deleteOrganization(@Param("id") id: string) { return this.admin.deleteOrganization(id); }
  @Patch("tournaments/:id") updateTournament(@Param("id") id: string, @Body() body: unknown) { return this.admin.updateTournament(id, body); }
  @Delete("tournaments/:id") deleteTournament(@Param("id") id: string) { return this.admin.deleteTournament(id); }
  @Patch("tournament-requests/:id/approve") approve(@Param("id") id: string, @CurrentUser() user: SessionUser) { return this.admin.approveRequest(id, user); }
  @Patch("tournament-requests/:id/reject") reject(@Param("id") id: string, @Body() body: unknown) { return this.admin.rejectRequest(id, body); }
}
