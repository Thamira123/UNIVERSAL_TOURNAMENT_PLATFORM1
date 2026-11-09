import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { inputObject, textField } from "../common/input";
import { Neo4jService } from "../neo4j/neo4j.service";

@Injectable()
export class TournamentsService {
  constructor(private readonly neo4j: Neo4jService) {}

  async getOne(id: string, userId: string) {
    const result = await this.neo4j.run(`
      MATCH (t:Tournament {id:$id})
      CALL {
        WITH t OPTIONAL MATCH (admin:User)-[role:TOURNAMENT_ADMIN]->(t)
        RETURN collect(CASE WHEN admin IS NULL THEN null ELSE {id:admin.id, name:admin.name, email:admin.email, role:role.role} END) AS admins
      }
      CALL {
        WITH t OPTIONAL MATCH (t)-[:HAS_EVENT]->(event:Event)
        RETURN collect(CASE WHEN event IS NULL THEN null ELSE {id:event.id, name:event.name, sport:event.sportKey, category:event.category, status:event.status} END) AS events
      }
      OPTIONAL MATCH (organization:Organization)-[:ORGANIZES]->(t)
      RETURN t { .id, .name, .description, .sportKey, .format, .teamCount, .endDate, .venue, .category, .gender, .ageGroup, .status, .startDate, .createdAt } AS tournament,
        organization { .id, .name } AS organization, admins, events,
        (EXISTS { MATCH (:User {id:$userId, role:'ADMIN'}) }
          OR EXISTS { MATCH (:User {id:$userId})-[:TOURNAMENT_ADMIN]->(t) }
          OR EXISTS { MATCH (:User {id:$userId})-[membership:ORG_MEMBER]->(organization) WHERE membership.role IN ['OWNER','ADMIN'] }) AS canManage,
        (EXISTS { MATCH (:User {id:$userId, role:'ADMIN'}) }
          OR EXISTS { MATCH (:User {id:$userId})-[orgRole:ORG_MEMBER]->(organization) WHERE orgRole.role IN ['OWNER','ADMIN'] }) AS canAssignAdmins,
        true AS canView
    `, { id, userId });
    const record = result.records[0];
    if (!record) throw new NotFoundException("Tournament not found.");
    if (!record.get("canView")) throw new ForbiddenException("You do not have access to this tournament.");
    return { tournament: record.get("tournament"), organization: record.get("organization"), admins: record.get("canManage") ? record.get("admins") : [], events: record.get("events"), canManage: record.get("canManage"), canAssignAdmins: record.get("canAssignAdmins") };
  }

  async addAdmin(id: string, value: unknown, userId: string) {
    const body = inputObject(value);
    const email = textField(body, "email", 254).toLowerCase();
    const result = await this.neo4j.run(`
      MATCH (actor:User {id:$userId}), (org:Organization)-[:ORGANIZES]->(t:Tournament {id:$id})
      WHERE actor.role='ADMIN' OR EXISTS { MATCH (actor)-[membership:ORG_MEMBER]->(org) WHERE membership.role IN ['OWNER','ADMIN'] }
      MATCH (member:User {email:$email})
      MERGE (member)-[role:TOURNAMENT_ADMIN]->(t)
      ON CREATE SET role.role='ADMIN', role.assignedAt=datetime()
      ON MATCH SET role.role=CASE WHEN role.role='OWNER' THEN 'OWNER' ELSE 'ADMIN' END
      RETURN member { .id, .name, .email } AS admin
    `, { userId, id, email }, "WRITE");
    const admin = result.records[0]?.get("admin");
    if (!admin) throw new ForbiddenException("Only an organization admin can assign tournament admins; check the email exists.");
    return admin;
  }
}
