import { Module } from "@nestjs/common";
import { ApiController, HealthController } from "./health.controller";

@Module({ controllers: [ApiController, HealthController] })
export class HealthModule {}
