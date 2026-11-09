import { Injectable, Logger, OnApplicationShutdown, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import neo4j, { Driver, QueryResult } from "neo4j-driver";

@Injectable()
export class Neo4jService implements OnApplicationShutdown, OnModuleInit {
  private readonly driver: Driver;
  private readonly database: string;
  private schemaReady = false;
  private schemaPromise: Promise<void> | null = null;
  private readonly logger = new Logger(Neo4jService.name);

  constructor(config: ConfigService) {
    this.driver = neo4j.driver(
      config.get<string>("NEO4J_URI", "bolt://localhost:7687"),
      neo4j.auth.basic(config.get<string>("NEO4J_USERNAME", "neo4j"), config.get<string>("NEO4J_PASSWORD", "change-me-before-production")),
    );
    this.database = config.get<string>("NEO4J_DATABASE", "neo4j");
  }

  async onModuleInit() {
    try {
      await this.ensureSchema();
      this.logger.log("Neo4j connected; schema and sports are ready.");
    } catch {
      this.logger.warn("Neo4j is not available yet. The API will start, and database requests will return 503 until Neo4j is reachable.");
    }
  }

  private async ensureSchema() {
    if (this.schemaReady) return;
    if (!this.schemaPromise) {
      this.schemaPromise = this.initializeSchema()
        .then(() => { this.schemaReady = true; })
        .catch((error: unknown) => {
          this.schemaPromise = null;
          throw this.databaseUnavailable(error);
        });
    }
    await this.schemaPromise;
  }

  private async initializeSchema() {
    const session = this.driver.session({ database: this.database });
    try {
      await session.run("CREATE CONSTRAINT user_email_unique IF NOT EXISTS FOR (u:User) REQUIRE u.email IS UNIQUE");
      await session.run("CREATE CONSTRAINT user_clerk_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.clerkId IS UNIQUE");
      await session.run("CREATE CONSTRAINT organization_id_unique IF NOT EXISTS FOR (o:Organization) REQUIRE o.id IS UNIQUE");
      await session.run("CREATE CONSTRAINT tournament_id_unique IF NOT EXISTS FOR (t:Tournament) REQUIRE t.id IS UNIQUE");
      await session.run("CREATE CONSTRAINT event_id_unique IF NOT EXISTS FOR (e:Event) REQUIRE e.id IS UNIQUE");
      await session.run("CREATE CONSTRAINT stage_id_unique IF NOT EXISTS FOR (s:Stage) REQUIRE s.id IS UNIQUE");
      await session.run("CREATE CONSTRAINT sport_key_unique IF NOT EXISTS FOR (s:Sport) REQUIRE s.key IS UNIQUE");
      await session.run("CREATE CONSTRAINT tournament_request_id_unique IF NOT EXISTS FOR (r:TournamentRequest) REQUIRE r.id IS UNIQUE");
      await session.run("MERGE (s:Sport {key:'cricket'}) SET s.name='Cricket', s.type='TEAM'");
      await session.run("MERGE (s:Sport {key:'high-jump'}) SET s.name='High Jump', s.type='INDIVIDUAL'");
    } finally {
      await session.close();
    }
  }

  async run(cypher: string, params: Record<string, unknown> = {}, mode: "READ" | "WRITE" = "READ"): Promise<QueryResult> {
    await this.ensureSchema();
    const session = this.driver.session({ database: this.database, defaultAccessMode: mode });
    try {
      return mode === "WRITE"
        ? await session.executeWrite((tx) => tx.run(cypher, params))
        : await session.executeRead((tx) => tx.run(cypher, params));
    } catch (error) {
      throw this.databaseUnavailable(error);
    } finally {
      await session.close();
    }
  }

  private databaseUnavailable(error: unknown) {
    if (error instanceof ServiceUnavailableException) return error;
    const code = String((error as { code?: string })?.code ?? "");
    if (["ServiceUnavailable", "SessionExpired", "Neo.ClientError.Security.Unauthorized"].some((value) => code.includes(value))) {
      return new ServiceUnavailableException("Neo4j is unavailable. Start the database and check NEO4J_URI, NEO4J_USERNAME, and NEO4J_PASSWORD in the root .env file.");
    }
    return error instanceof Error ? error : new Error("Neo4j request failed.");
  }

  get databaseName() { return this.database; }
  verifyConnectivity() { return this.driver.verifyConnectivity({ database: this.database }); }
  async onApplicationShutdown() { await this.driver.close(); }
}
