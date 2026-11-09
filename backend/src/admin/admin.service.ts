import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { inputObject, isValidDateOnly, optionalText, textField } from "../common/input";
import type { SessionUser } from "../auth/current-user.decorator";
import { Neo4jService } from "../neo4j/neo4j.service";

const supportedSports = new Set(["cricket", "high-jump"]);

@Injectable()
export class AdminService {
  constructor(private readonly neo4j: Neo4jService) {}

  async listUsers() {
    const result = await this.neo4j.run(`
      MATCH (user:User)
      OPTIONAL MATCH (user)-[:ORG_MEMBER]->(organization:Organization)
      WITH user, count(DISTINCT organization) AS organizationCount
      OPTIONAL MATCH (user)-[:SUBMITTED_REQUEST]->(request:TournamentRequest)
      RETURN user { .id, .name, .email, .role, .createdAt } AS user,
        organizationCount, count(DISTINCT request) AS requestCount
      ORDER BY user.createdAt DESC
    `);
    return result.records.map((record) => ({ ...record.get("user"), role: record.get("user").role ?? "USER", organizationCount: record.get("organizationCount").toNumber(), requestCount: record.get("requestCount").toNumber() }));
  }

  async listOrganizations() {
    const result = await this.neo4j.run(`
      MATCH (organization:Organization)
      OPTIONAL MATCH (organization)-[:ORGANIZES]->(tournament:Tournament)
      RETURN organization { .id, .name, .slug, .createdAt } AS organization,
        count(DISTINCT tournament) AS tournamentCount
      ORDER BY organization.name
    `);
    return result.records.map((record) => ({ ...record.get("organization"), tournamentCount: record.get("tournamentCount").toNumber() }));
  }

  async listTournaments() {
    const result = await this.neo4j.run(`
      MATCH (tournament:Tournament)
      OPTIONAL MATCH (organization:Organization)-[:ORGANIZES]->(tournament)
      OPTIONAL MATCH (tournament)-[:HAS_EVENT]->(event:Event)
      RETURN tournament { .id, .name, .sportKey, .status, .startDate, .venue } AS tournament,
        organization { .id, .name } AS organization, count(DISTINCT event) AS eventCount
      ORDER BY tournament.startDate ASC, tournament.createdAt DESC
    `);
    return result.records.map((record) => ({ ...record.get("tournament"), organization: record.get("organization"), eventCount: record.get("eventCount").toNumber() }));
  }

  async updateOrganization(id: string, value: unknown) {
    const body = inputObject(value);
    const name = textField(body, "name", 100);
    const result = await this.neo4j.run(`
      MATCH (organization:Organization {id:$id})
      SET organization.name=$name,
          organization.slug=$slug,
          organization.updatedAt=datetime()
      RETURN organization { .id, .name, .slug, .createdAt } AS organization
    `, { id, name, slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${id.slice(0, 6)}` }, "WRITE");
    const organization = result.records[0]?.get("organization");
    if (!organization) throw new NotFoundException("Organization not found.");
    return organization;
  }

  async deleteOrganization(id: string) {
    const existing = await this.neo4j.run(`
      MATCH (organization:Organization {id:$id})
      OPTIONAL MATCH (organization)-[:ORGANIZES]->(tournament:Tournament)
      RETURN count(tournament) AS tournamentCount
    `, { id });
    if (!existing.records.length) throw new NotFoundException("Organization not found.");
    const tournamentCount = existing.records[0].get("tournamentCount").toNumber();
    if (tournamentCount > 0) throw new ConflictException("Delete this organization's tournaments before deleting the organization.");
    const result = await this.neo4j.run(`
      MATCH (organization:Organization {id:$id})
      WITH organization
      DETACH DELETE organization
      RETURN $id AS id
    `, { id }, "WRITE");
    if (!result.records.length) throw new NotFoundException("Organization not found.");
    return { id, deleted: true };
  }

  async updateTournament(id: string, value: unknown) {
    const body = inputObject(value);
    const name = body.name === undefined ? null : textField(body, "name", 120);
    const status = body.status === undefined ? null : textField(body, "status", 20).toUpperCase();
    const startDate = body.startDate === undefined ? null : textField(body, "startDate", 10);
    const venue = body.venue === undefined ? null : optionalText(body, "venue", 160);
    const validStatuses = new Set(["UPCOMING", "ONGOING", "LIVE", "COMPLETED", "CANCELLED"]);
    if (status !== null && !validStatuses.has(status)) throw new BadRequestException("Choose a valid tournament status.");
    if (startDate !== null && !isValidDateOnly(startDate)) {
      throw new BadRequestException("startDate must use YYYY-MM-DD format.");
    }
    if (name === null && status === null && startDate === null && venue === null) throw new BadRequestException("Provide at least one tournament field to update.");
    const result = await this.neo4j.run(`
      MATCH (tournament:Tournament {id:$id})
      SET tournament.name=coalesce($name,tournament.name),
          tournament.status=coalesce($status,tournament.status),
          tournament.startDate=coalesce($startDate,tournament.startDate),
          tournament.venue=coalesce($venue,tournament.venue),
          tournament.updatedAt=datetime()
      RETURN tournament { .id, .name, .status, .startDate, .venue } AS tournament
    `, { id, name, status, startDate, venue }, "WRITE");
    const tournament = result.records[0]?.get("tournament");
    if (!tournament) throw new NotFoundException("Tournament not found.");
    return tournament;
  }

  async deleteTournament(id: string) {
    const result = await this.neo4j.run(`
      MATCH (tournament:Tournament {id:$id})
      OPTIONAL MATCH (tournament)-[:HAS_EVENT]->(event:Event)
      OPTIONAL MATCH (event)-[:HAS_STAGE]->(stage:Stage)
      OPTIONAL MATCH (stage)-[:HAS_GROUP|HAS_ROUND]->(child)
      WITH tournament,
        collect(DISTINCT event) + collect(DISTINCT stage) + collect(DISTINCT child) AS dependents
      OPTIONAL MATCH (request:TournamentRequest {tournamentId:$id})
      WITH tournament, dependents, collect(request) AS requests
      FOREACH (request IN requests |
        SET request.status='CANCELLED', request.adminNote='Tournament deleted by a platform administrator.', request.tournamentId=null, request.updatedAt=datetime())
      WITH tournament, dependents
      UNWIND dependents + [tournament] AS node
      WITH DISTINCT node
      DETACH DELETE node
      RETURN count(node) AS deletedCount
    `, { id }, "WRITE");
    if (!result.records.length || result.records[0].get("deletedCount").toNumber() === 0) throw new NotFoundException("Tournament not found.");
    return { id, deleted: true };
  }

  async listRequests() {
    const result = await this.neo4j.run(`
      MATCH (user:User)-[:SUBMITTED_REQUEST]->(request:TournamentRequest)
      OPTIONAL MATCH (tournament:Tournament {id:request.tournamentId})
      RETURN request { .id, .name, .sportKey, .organizationName, .description, .startDate, .venue, .status, .adminNote, .createdAt, .updatedAt } AS request,
        user { .id, .name, .email } AS user, tournament { .id, .name } AS tournament
      ORDER BY CASE request.status WHEN 'PENDING' THEN 0 ELSE 1 END, request.createdAt DESC
    `);
    return result.records.map((record) => ({ ...record.get("request"), user: record.get("user"), tournament: record.get("tournament") }));
  }

  async myRequests(userId: string) {
    const result = await this.neo4j.run(`
      MATCH (:User {id:$userId})-[:SUBMITTED_REQUEST]->(request:TournamentRequest)
      OPTIONAL MATCH (tournament:Tournament {id:request.tournamentId})
      RETURN request { .id, .name, .sportKey, .organizationName, .description, .startDate, .venue, .status, .adminNote, .createdAt, .updatedAt } AS request,
        tournament { .id, .name } AS tournament
      ORDER BY request.createdAt DESC
    `, { userId });
    return result.records.map((record) => ({ ...record.get("request"), tournament: record.get("tournament") }));
  }

  async createRequest(value: unknown, user: SessionUser) {
    const body = inputObject(value);
    const name = textField(body, "name", 120);
    const sportKey = textField(body, "sportKey", 30).toLowerCase();
    if (!supportedSports.has(sportKey)) throw new BadRequestException("Choose Cricket or High Jump.");
    const organizationName = textField(body, "organizationName", 100);
    const description = optionalText(body, "description", 1000);
    const startDate = textField(body, "startDate", 10);
    if (!isValidDateOnly(startDate)) {
      throw new BadRequestException("Choose a valid tournament start date.");
    }
    const venue = optionalText(body, "venue", 160);
    const id = randomUUID();
    await this.neo4j.run(`
      MATCH (user:User {id:$userId})
      CREATE (request:TournamentRequest {id:$id, name:$name, sportKey:$sportKey, organizationName:$organizationName,
        description:$description, startDate:$startDate, venue:$venue, status:'PENDING', createdAt:datetime()})
      CREATE (user)-[:SUBMITTED_REQUEST]->(request)
      RETURN request { .id, .name, .sportKey, .organizationName, .description, .startDate, .venue, .status, .createdAt } AS request
    `, { userId: user.id, id, name, sportKey, organizationName, description, startDate, venue }, "WRITE");
    const result = await this.neo4j.run(`MATCH (request:TournamentRequest {id:$id}) RETURN request { .id, .name, .sportKey, .organizationName, .description, .startDate, .venue, .status, .createdAt } AS request`, { id });
    return result.records[0]?.get("request");
  }

  async approveRequest(requestId: string, admin: SessionUser) {
    const organizationId = randomUUID();
    const tournamentId = randomUUID();
    const slugBase = `request-${organizationId.slice(0, 8)}`;
    const result = await this.neo4j.run(`
      MATCH (admin:User {id:$adminId, role:'ADMIN'})
      MATCH (requester:User)-[:SUBMITTED_REQUEST]->(request:TournamentRequest {id:$requestId, status:'PENDING'})
      CREATE (organization:Organization {id:$organizationId, name:request.organizationName, slug:$slug,
        description:request.description, createdAt:datetime()})
      CREATE (requester)-[:ORG_MEMBER {role:'OWNER', joinedAt:datetime()}]->(organization)
      CREATE (tournament:Tournament {id:$tournamentId, name:request.name, description:request.description,
        sportKey:request.sportKey, status:'UPCOMING', startDate:request.startDate, venue:request.venue, createdAt:datetime()})
      CREATE (organization)-[:ORGANIZES]->(tournament)
      CREATE (requester)-[:TOURNAMENT_ADMIN {role:'OWNER', assignedAt:datetime()}]->(tournament)
      SET request.status='APPROVED', request.adminNote='', request.tournamentId=$tournamentId, request.updatedAt=datetime()
      RETURN request { .id, .name, .sportKey, .organizationName, .status, .startDate, .updatedAt } AS request,
        tournament { .id, .name } AS tournament
    `, { adminId: admin.id, requestId, organizationId, tournamentId, slug: slugBase }, "WRITE");
    const record = result.records[0];
    if (!record) {
      const exists = await this.neo4j.run("MATCH (request:TournamentRequest {id:$requestId}) RETURN request.status AS status", { requestId });
      if (!exists.records.length) throw new NotFoundException("Tournament request not found.");
      throw new ConflictException("This request has already been reviewed.");
    }
    return { ...record.get("request"), tournament: record.get("tournament") };
  }

  async rejectRequest(requestId: string, value: unknown) {
    const body = inputObject(value);
    const adminNote = optionalText(body, "adminNote", 500);
    const result = await this.neo4j.run(`
      MATCH (request:TournamentRequest {id:$requestId, status:'PENDING'})
      SET request.status='REJECTED', request.adminNote=$adminNote, request.updatedAt=datetime()
      RETURN request { .id, .name, .status, .adminNote, .updatedAt } AS request
    `, { requestId, adminNote }, "WRITE");
    if (!result.records.length) {
      const exists = await this.neo4j.run("MATCH (request:TournamentRequest {id:$requestId}) RETURN request.status AS status", { requestId });
      if (!exists.records.length) throw new NotFoundException("Tournament request not found.");
      throw new ConflictException("This request has already been reviewed.");
    }
    return result.records[0].get("request");
  }
}
