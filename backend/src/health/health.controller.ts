import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Neo4jService } from "../neo4j/neo4j.service";

@Controller()
export class ApiController {
  @Get()
  getApiInfo() {
    return {
      service: "tournament-api",
      status: "ok",
      health: "/api/health",
      databaseHealth: "/api/health/neo4j",
    };
  }
}

@Controller("health")
export class HealthController {
  constructor(private readonly neo4j: Neo4jService) {}

  @Get()
  getHealth() {
    return { status: "ok", service: "tournament-api" };
  }

  @Get("neo4j")
  async getNeo4jHealth() {
    try {
      await this.neo4j.verifyConnectivity();
      return { status: "ok", database: this.neo4j.databaseName };
    } catch {
      throw new ServiceUnavailableException({ status: "error", database: this.neo4j.databaseName });
    }
  }
}
