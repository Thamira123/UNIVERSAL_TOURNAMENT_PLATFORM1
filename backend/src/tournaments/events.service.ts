import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { inputObject, optionalText, positiveInteger, textField } from "../common/input";
import { Neo4jService } from "../neo4j/neo4j.service";

const sports = new Set(["cricket", "high-jump"]);
const stageFormats = new Set(["GROUP_STAGE", "ROUND_ROBIN", "KNOCKOUT", "QUALIFIER", "FINAL"]);

@Injectable()
export class EventsService {
  constructor(private readonly neo4j: Neo4jService) {}

  async listForSport(sportKey: string) {
    if (!sports.has(sportKey)) throw new NotFoundException("Sport not found.");
    const result = await this.neo4j.run(`
      MATCH (sport:Sport {key:$sportKey})<-[:USES_SPORT]-(event:Event)<-[:HAS_EVENT]-(tournament:Tournament)
      WHERE tournament.sportKey IS NULL OR tournament.sportKey = $sportKey
      OPTIONAL MATCH (event)-[stageLink:HAS_STAGE]->(stage:Stage)
      WITH sport, event, tournament, stage, stageLink ORDER BY stageLink.order
      WITH sport, event, tournament,
        collect(CASE WHEN stage IS NULL THEN null ELSE {id:stage.id, name:stage.name, format:stage.format, order:stageLink.order} END) AS stages
      RETURN sport { .key, .name } AS sport,
        collect({event:{id:event.id, name:event.name, category:event.category, description:event.description, status:event.status}, tournament:{id:tournament.id, name:tournament.name, status:tournament.status, startDate:tournament.startDate}, stages:[stage IN stages WHERE stage IS NOT NULL]}) AS entries
      ORDER BY sport.name
    `, { sportKey });
    const record = result.records[0];
    return { sport: record?.get("sport") ?? { key: sportKey, name: sportKey === "cricket" ? "Cricket" : "High Jump" }, events: record?.get("entries") ?? [] };
  }

  async listTournamentsForSport(sportKey: string) {
    if (!sports.has(sportKey)) throw new NotFoundException("Sport not found.");
    const result = await this.neo4j.run(`
      MATCH (tournament:Tournament)
      WHERE tournament.sportKey = $sportKey OR (
        tournament.sportKey IS NULL
        AND EXISTS { MATCH (tournament)-[:HAS_EVENT]->(:Event {sportKey:$sportKey}) }
        AND NOT EXISTS { MATCH (tournament)-[:HAS_EVENT]->(other:Event) WHERE other.sportKey <> $sportKey }
      )
      OPTIONAL MATCH (organization:Organization)-[:ORGANIZES]->(tournament)
      CALL {
        WITH tournament
        OPTIONAL MATCH (tournament)-[:HAS_EVENT]->(event:Event)
        RETURN count(event) AS eventCount
      }
      RETURN tournament { .id, .name, .description, .status, .startDate, .sportKey, .format, .teamCount, .endDate, .venue, .category, .gender, .ageGroup } AS tournament,
        organization { .id, .name } AS organization, eventCount
      ORDER BY tournament.startDate ASC, tournament.createdAt DESC
    `, { sportKey });
    return result.records.map((record) => ({
      ...record.get("tournament"),
      organization: record.get("organization"),
      eventCount: record.get("eventCount").toNumber(),
    }));
  }

  async create(tournamentId: string, value: unknown, userId: string) {
    const body = inputObject(value);
    const name = textField(body, "name", 120);
    const sportKey = textField(body, "sportKey", 30).toLowerCase();
    if (!sports.has(sportKey)) throw new BadRequestException("Choose Cricket or High Jump.");
    const category = textField(body, "category", 80);
    const description = optionalText(body, "description", 1000);
    const id = randomUUID();
    const result = await this.neo4j.run(`
      MATCH (actor:User {id:$userId}), (t:Tournament {id:$tournamentId}), (sport:Sport {key:$sportKey})
      WHERE (t.sportKey IS NULL OR t.sportKey = $sportKey)
        AND (actor.role='ADMIN' OR EXISTS { MATCH (actor)-[:TOURNAMENT_ADMIN]->(t) }
          OR EXISTS { MATCH (org:Organization)-[:ORGANIZES]->(t), (actor)-[membership:ORG_MEMBER]->(org) WHERE membership.role IN ['OWNER','ADMIN'] })
      SET t.sportKey = coalesce(t.sportKey, $sportKey)
      CREATE (event:Event {id:$id, name:$name, sportKey:$sportKey, category:$category, description:$description, status:'DRAFT', createdAt:datetime()})
      CREATE (t)-[:HAS_EVENT]->(event)
      CREATE (event)-[:USES_SPORT]->(sport)
      RETURN event { .id, .name, .sportKey, .category, .description, .status } AS event
    `, { userId, tournamentId, sportKey, id, name, category, description }, "WRITE");
    const event = result.records[0]?.get("event");
    if (!event) throw new ForbiddenException("Tournament admin permission is required, and the event must match the tournament sport.");
    return event;
  }

  async getOne(id: string, userId: string) {
    const access = await this.neo4j.run(`
      MATCH (user:User {id:$userId}), (event:Event {id:$id})<-[:HAS_EVENT]-(t:Tournament)
      WHERE user.role='ADMIN'
        OR EXISTS { MATCH (user)-[:TOURNAMENT_ADMIN]->(t) }
        OR EXISTS { MATCH (user)-[membership:ORG_MEMBER]->(:Organization)-[:ORGANIZES]->(t) WHERE membership.role IN ['OWNER','ADMIN'] }
        OR EXISTS { MATCH (user)-[:TOURNAMENT_REQUESTER]->(t) }
      RETURN event.id AS id
    `, { id, userId });
    if (!access.records.length) throw new ForbiddenException("You do not have access to this event.");
    const details = await this.neo4j.run(`
      MATCH (event:Event {id:$id})
      OPTIONAL MATCH (t:Tournament)-[:HAS_EVENT]->(event)
      CALL {
        WITH t OPTIONAL MATCH (admin:User)-[role:TOURNAMENT_ADMIN]->(t)
        RETURN collect(CASE WHEN admin IS NULL THEN null ELSE {id:admin.id, name:admin.name, email:admin.email, role:role.role} END) AS admins
      }
      RETURN event { .id, .name, .sportKey, .category, .description, .status, .createdAt } AS event,
        t { .id, .name } AS tournament, admins
    `, { id });
    const record = details.records[0];
    if (!record) throw new NotFoundException("Event not found.");
    const stageResult = await this.neo4j.run(`
      MATCH (event:Event {id:$id})
      OPTIONAL MATCH (event)-[stageLink:HAS_STAGE]->(stage:Stage)
      WITH event, stage, stageLink ORDER BY stageLink.order
      OPTIONAL MATCH (stage)-[groupLink:HAS_GROUP]->(group:Group)
      WITH event, stage, stageLink, collect(CASE WHEN group IS NULL THEN null ELSE {id:group.id, name:group.name, order:groupLink.order, capacity:group.capacity} END) AS groups
      OPTIONAL MATCH (stage)-[roundLink:HAS_ROUND]->(round:Round)
      WITH event, stage, stageLink, groups, collect(CASE WHEN round IS NULL THEN null ELSE {id:round.id, name:round.name, order:roundLink.order} END) AS rounds
      WITH event, collect(CASE WHEN stage IS NULL THEN null ELSE {stage:stage { .id, .name, .format, .order, .groupCount, .participantsPerGroup, .advanceCount }, groups:groups, rounds:rounds} END) AS stageEntries
      RETURN [entry IN stageEntries WHERE entry IS NOT NULL] AS stages
    `, { id });
    return { event: record.get("event"), tournament: record.get("tournament"), admins: record.get("admins"), stages: stageResult.records[0]?.get("stages") ?? [] };
  }

  async update(id: string, value: unknown, userId: string) {
    const body = inputObject(value);
    const name = body.name === undefined ? null : textField(body, "name", 120);
    const category = body.category === undefined ? null : textField(body, "category", 80);
    const description = body.description === undefined ? null : optionalText(body, "description", 1000);
    if (name === null && category === null && description === null) throw new BadRequestException("Provide at least one event field to update.");
    const result = await this.neo4j.run(`
      MATCH (actor:User {id:$userId}), (event:Event {id:$id})<-[:HAS_EVENT]-(t:Tournament)
      WHERE actor.role='ADMIN' OR EXISTS { MATCH (actor)-[:TOURNAMENT_ADMIN]->(t) }
        OR EXISTS { MATCH (org:Organization)-[:ORGANIZES]->(t), (actor)-[membership:ORG_MEMBER]->(org) WHERE membership.role IN ['OWNER','ADMIN'] }
      SET event.name=coalesce($name,event.name), event.category=coalesce($category,event.category), event.description=coalesce($description,event.description), event.updatedAt=datetime()
      RETURN event { .id, .name, .sportKey, .category, .description, .status } AS event
    `, { id, userId, name, category, description }, "WRITE");
    const event = result.records[0]?.get("event");
    if (!event) throw new ForbiddenException("Tournament admin permission is required to edit this event.");
    return event;
  }

  async addStage(eventId: string, value: unknown, userId: string) {
    const body = inputObject(value);
    const name = textField(body, "name", 100);
    const format = textField(body, "format", 30).toUpperCase().replaceAll(" ", "_");
    if (!stageFormats.has(format)) throw new BadRequestException("Choose Group Stage, Round Robin, Knockout, Qualifier or Final.");
    const eventRecord = await this.neo4j.run("MATCH (event:Event {id:$eventId}) RETURN event.sportKey AS sportKey", { eventId });
    const sportKey = eventRecord.records[0]?.get("sportKey");
    if (!sportKey) throw new NotFoundException("Event not found.");
    if (sportKey === "high-jump" && !["QUALIFIER", "FINAL"].includes(format)) {
      throw new BadRequestException("High Jump events support Qualifier and Final stages. Group formats are for Cricket.");
    }
    const order = positiveInteger(body, "order");
    const groupCount = format === "GROUP_STAGE" ? positiveInteger(body, "groupCount") : 0;
    const participantsPerGroup = format === "GROUP_STAGE" ? positiveInteger(body, "participantsPerGroup") : 0;
    if (format === "GROUP_STAGE" && participantsPerGroup < 2) throw new BadRequestException("Each group needs at least two participants.");
    const advanceCount = format === "GROUP_STAGE" ? positiveInteger(body, "advanceCount", 2) : 0;
    if (format === "GROUP_STAGE" && advanceCount > participantsPerGroup) throw new BadRequestException("Advancing participants cannot exceed group size.");
    const id = randomUUID();
    const result = await this.neo4j.run(`
      MATCH (actor:User {id:$userId}), (event:Event {id:$eventId})<-[:HAS_EVENT]-(t:Tournament)
      WHERE (actor.role='ADMIN' OR EXISTS { MATCH (actor)-[:TOURNAMENT_ADMIN]->(t) }
        OR EXISTS { MATCH (org:Organization)-[:ORGANIZES]->(t), (actor)-[membership:ORG_MEMBER]->(org) WHERE membership.role IN ['OWNER','ADMIN'] })
        AND NOT EXISTS { MATCH (event)-[:HAS_STAGE {order:$order}]->(:Stage) }
      CREATE (stage:Stage {id:$id, name:$name, format:$format, order:$order, groupCount:$groupCount, participantsPerGroup:$participantsPerGroup, advanceCount:$advanceCount, createdAt:datetime()})
      CREATE (event)-[:HAS_STAGE {order:$order}]->(stage)
      FOREACH (groupOrder IN CASE WHEN $groupCount > 0 THEN range(1,$groupCount) ELSE [] END |
        CREATE (group:Group {id:randomUUID(), name:'Group ' + toString(groupOrder), order:groupOrder, capacity:$participantsPerGroup})
        CREATE (stage)-[:HAS_GROUP {order:groupOrder}]->(group))
      RETURN stage { .id, .name, .format, .order, .groupCount, .participantsPerGroup, .advanceCount } AS stage
    `, { userId, eventId, id, name, format, order, groupCount, participantsPerGroup, advanceCount }, "WRITE");
    const stage = result.records[0]?.get("stage");
    if (!stage) throw new ForbiddenException("You cannot add a stage here, or this stage order is already in use.");
    return stage;
  }

  async addRound(stageId: string, value: unknown, userId: string) {
    const body = inputObject(value);
    const name = textField(body, "name", 100);
    const order = positiveInteger(body, "order");

    return this.neo4j.run(
      `MATCH (event:Event)-[:HAS_STAGE]->(stage:Stage {id: $stageId}), (tournament:Tournament)-[:HAS_EVENT]->(event)
       WHERE (EXISTS { MATCH (user:User {id:$userId, role:'ADMIN'}) }
         OR EXISTS { MATCH (user:User {id: $userId})-[:TOURNAMENT_ADMIN]->(tournament) }
         OR EXISTS { MATCH (user:User {id: $userId})-[membership:ORG_MEMBER]->(:Organization)-[:ORGANIZES]->(tournament) WHERE membership.role IN ['OWNER', 'ADMIN'] })
         AND NOT EXISTS { MATCH (stage)-[:HAS_ROUND]->(:Round {order: $order}) }
       CREATE (round:Round {id: randomUUID(), name: $name, order: $order})
       CREATE (stage)-[:HAS_ROUND]->(round)
       RETURN round { .id, .name, .order } AS round`,
      { stageId, userId, name, order },
      'WRITE',
    ).then((result) => {
      if (!result.records.length) throw new NotFoundException('Stage not found, order already used, or you do not have permission.');
      return result.records[0].get('round');
    });
  }
}




