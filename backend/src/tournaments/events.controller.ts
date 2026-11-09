import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser, type SessionUser } from "../auth/current-user.decorator";
import { EventsService } from "./events.service";

@UseGuards(AuthGuard)
@Controller()
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get("events/:id") getOne(@Param("id") id: string, @CurrentUser() user: SessionUser) { return this.events.getOne(id, user.id); }
  @Patch("events/:id") update(@Param("id") id: string, @Body() body: unknown, @CurrentUser() user: SessionUser) { return this.events.update(id, body, user.id); }
  @Post("events/:id/stages") addStage(@Param("id") id: string, @Body() body: unknown, @CurrentUser() user: SessionUser) { return this.events.addStage(id, body, user.id); }
  @Post("stages/:id/rounds") addRound(@Param("id") id: string, @Body() body: unknown, @CurrentUser() user: SessionUser) { return this.events.addRound(id, body, user.id); }
}

@Controller("sports")
export class SportsController {
  constructor(private readonly events: EventsService) {}

  @Get(":sportKey")
  getSport(@Param("sportKey") sportKey: string) {
    return this.events.listForSport(sportKey.toLowerCase());
  }

  @Get(":sportKey/tournaments")
  getTournaments(@Param("sportKey") sportKey: string) {
    return this.events.listTournamentsForSport(sportKey.toLowerCase());
  }
}
