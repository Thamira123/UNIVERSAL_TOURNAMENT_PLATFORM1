import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AnalyticsModule } from "./analytics/analytics.module";
import { AuthModule } from "./auth/auth.module";
import { AdminModule } from "./admin/admin.module";
import { HealthModule } from "./health/health.module";
import { Neo4jModule } from "./neo4j/neo4j.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { TournamentsModule } from "./tournaments/tournaments.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ["../.env", ".env"] }), Neo4jModule, AuthModule, AdminModule, OrganizationsModule, TournamentsModule, AnalyticsModule, HealthModule],
})
export class AppModule {}
