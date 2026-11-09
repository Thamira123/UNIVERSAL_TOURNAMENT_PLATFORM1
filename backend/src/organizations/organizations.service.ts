import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { inputObject, isValidDateOnly, optionalText, textField } from "../common/input";
import type { SessionUser } from "../auth/current-user.decorator";
import { Neo4jService } from "../neo4j/neo4j.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly neo4j: Neo4jService) {}

  async create(value: unknown, user: SessionUser) {
    const body = inputObject(value);
    const name = textField(body, "name", 100);
    const description = optionalText(body, "description", 500);
    const id = randomUUID();
    const slug = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${id.slice(0, 6)}`;
    const result = await this.neo4j.run(`
      MATCH (u:User {id:$userId})
      CREATE (o:Organization {id:$id, name:$name, slug:$slug, description:$description, createdAt:datetime()})
      CREATE (u)-[:ORG_MEMBER {role:'OWNER', joinedAt:datetime()}]->(o)
      RETURN o { .id, .name, .slug, .description, .createdAt } AS organization
    `, { userId: user.id, id, name, slug, description }, "WRITE");
    const organization = result.records[0]?.get("organization");
    if (!organization) throw new NotFoundException("User account was not found.");
    return organization;
  }

  async mine(userId: string) {
    const result = await this.neo4j.run(`
      MATCH (u:User {id:$userId})-[membership:ORG_MEMBER]->(o:Organization)
      RETURN o { .id, .name, .slug, .description, .createdAt } AS organization, membership.role AS role
      ORDER BY o.name
    `, { userId });
    return result.records.map((record) => ({ ...record.get("organization"), role: record.get("role") }));
  }

  async getOne(id: string, userId: string) {
    const result = await this.neo4j.run(`
      MATCH (o:Organization {id:$id})
      CALL {
        WITH o OPTIONAL MATCH (member:User)-[membership:ORG_MEMBER]->(o)
        RETURN collect(CASE WHEN member IS NULL THEN null ELSE {id:member.id, name:member.name, email:member.email, role:membership.role} END) AS members
      }
      CALL {
        WITH o OPTIONAL MATCH (o)-[:ORGANIZES]->(t:Tournament)
        RETURN collect(CASE WHEN t IS NULL THEN null ELSE {id:t.id, name:t.name, status:t.status, startDate:t.startDate, sportKey:t.sportKey} END) AS tournaments
      }
      RETURN o { .id, .name, .slug, .description, .createdAt } AS organization, members, tournaments
    `, { id });
    const record = result.records[0];
    if (!record) throw new NotFoundException("Organization not found.");
    const membership = await this.neo4j.run("MATCH (u:User {id:$userId})-[r:ORG_MEMBER]->(o:Organization {id:$id}) RETURN r.role AS role", { userId, id });
    const platformAdmin = await this.isPlatformAdmin(userId);
    if (!membership.records.length && !platformAdmin) throw new ForbiddenException("You need to belong to this organization to view its workspace.");
    return { organization: record.get("organization"), role: platformAdmin ? "ADMIN" : membership.records[0].get("role"), isPlatformAdmin: platformAdmin, admins: (record.get("members") as { role: string }[]).filter((member) => ["OWNER", "ADMIN"].includes(member.role)), tournaments: record.get("tournaments") };
  }

  async addAdmin(id: string, value: unknown, userId: string) {
    const body = inputObject(value);
    const email = textField(body, "email", 254).toLowerCase();
    const result = await this.neo4j.run(`
      MATCH (actor:User {id:$userId}), (o:Organization {id:$id})
      WHERE actor.role='ADMIN' OR EXISTS { MATCH (actor)-[actorRole:ORG_MEMBER]->(o) WHERE actorRole.role IN ['OWNER','ADMIN'] }
      MATCH (member:User {email:$email})
      MERGE (member)-[membership:ORG_MEMBER]->(o)
      ON CREATE SET membership.role='ADMIN', membership.joinedAt=datetime()
      ON MATCH SET membership.role=CASE WHEN membership.role='OWNER' THEN 'OWNER' ELSE 'ADMIN' END
      RETURN member { .id, .name, .email } AS user
    `, { userId, id, email }, "WRITE");
    const added = result.records[0]?.get("user");
    if (!added) throw new NotFoundException("Organization or account not found, or you do not have admin permission.");
    return added;
  }

  async tournaments(id: string, userId: string) {
    await this.requireOrganizationMember(userId, id);
    const result = await this.neo4j.run(`
      MATCH (o:Organization {id:$id})-[:ORGANIZES]->(t:Tournament)
      OPTIONAL MATCH (t)-[:HAS_EVENT]->(e:Event)
      RETURN t { .id, .name, .description, .sportKey, .status, .startDate, .createdAt } AS tournament, count(e) AS eventCount
      ORDER BY t.createdAt DESC
    `, { id });
    return result.records.map((record) => ({ ...record.get("tournament"), eventCount: record.get("eventCount").toNumber() }));
  }

  async createTournament(organizationId: string, value: unknown, userId: string) {
    const body = inputObject(value);
    const name = textField(body, "name", 120);
    const description = optionalText(body, "description", 1000);
    const sportKey = optionalText(body, "sportKey", 30).toLowerCase();
    if (sportKey && !["cricket", "high-jump"].includes(sportKey)) throw new BadRequestException("Choose Cricket or High Jump.");
    const startDate = textField(body, "startDate", 10);
    if (!isValidDateOnly(startDate)) throw new BadRequestException("startDate must use YYYY-MM-DD format.");
    const endDate = optionalText(body, "endDate", 10);
    if (endDate && !isValidDateOnly(endDate)) throw new BadRequestException("endDate must use YYYY-MM-DD format.");
    if (endDate && endDate < startDate) throw new BadRequestException("endDate must be on or after startDate.");
    const format = optionalText(body, "format", 40);
    const venue = optionalText(body, "venue", 160);
    const category = optionalText(body, "category", 80);
    const gender = optionalText(body, "gender", 40);
    const ageGroup = optionalText(body, "ageGroup", 40);
    const teamCount = body.teamCount === undefined || body.teamCount === null || body.teamCount === "" ? null : Number(body.teamCount);
    if (teamCount !== null && (!Number.isInteger(teamCount) || teamCount < 2 || teamCount > 1000)) throw new BadRequestException("teamCount must be a whole number between 2 and 1000.");
    const id = randomUUID();
    const result = await this.neo4j.run(`
      MATCH (actor:User {id:$userId}), (o:Organization {id:$organizationId})
      WHERE actor.role='ADMIN'
      CREATE (t:Tournament {id:$id, name:$name, description:$description, sportKey:$sportKey, format:$format, teamCount:$teamCount, endDate:$endDate, venue:$venue, category:$category, gender:$gender, ageGroup:$ageGroup, status:'UPCOMING', startDate:$startDate, createdAt:datetime()})
      CREATE (o)-[:ORGANIZES]->(t)
      CREATE (actor)-[:TOURNAMENT_ADMIN {role:'OWNER', assignedAt:datetime()}]->(t)
      RETURN t { .id, .name, .description, .sportKey, .format, .teamCount, .endDate, .venue, .category, .gender, .ageGroup, .status, .startDate, .createdAt } AS tournament
    `, { userId, organizationId, id, name, description, sportKey: sportKey || null, format: format || null, teamCount, endDate: endDate || null, venue: venue || null, category: category || null, gender: gender || null, ageGroup: ageGroup || null, startDate }, "WRITE");
    const tournament = result.records[0]?.get("tournament");
    if (!tournament) throw new ForbiddenException("Only an organization admin can create its tournaments.");
    return tournament;
  }

  async requireOrganizationAdmin(userId: string, organizationId: string) {
    const result = await this.neo4j.run("MATCH (u:User {id:$userId}), (o:Organization {id:$organizationId}) WHERE u.role='ADMIN' OR EXISTS { MATCH (u)-[r:ORG_MEMBER]->(o) WHERE r.role IN ['OWNER','ADMIN'] } RETURN o.id AS id", { userId, organizationId });
    if (!result.records.length) throw new ForbiddenException("Organization admin permission is required.");
  }

  private async isOrganizationMember(userId: string, organizationId: string) {
    if (await this.isPlatformAdmin(userId)) return true;
    const result = await this.neo4j.run("MATCH (u:User {id:$userId})-[:ORG_MEMBER]->(o:Organization {id:$organizationId}) RETURN count(o) > 0 AS member", { userId, organizationId });
    return result.records[0]?.get("member") === true;
  }

  private async isPlatformAdmin(userId: string) {
    const result = await this.neo4j.run("MATCH (user:User {id:$userId, role:'ADMIN'}) RETURN user.id AS id", { userId });
    return result.records.length > 0;
  }

  private async requireOrganizationMember(userId: string, organizationId: string) {
    if (!(await this.isOrganizationMember(userId, organizationId))) throw new ForbiddenException("Organization membership is required.");
  }
}



