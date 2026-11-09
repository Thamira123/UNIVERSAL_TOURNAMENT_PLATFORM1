import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminController, TournamentRequestsController } from "./admin.controller";
import { AdminService } from "./admin.service";

@Module({ imports: [AuthModule], controllers: [AdminController, TournamentRequestsController], providers: [AdminService] })
export class AdminModule {}
