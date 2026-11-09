import { Injectable } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { Neo4jService } from "../neo4j/neo4j.service";
import { parseCsv } from "./csv";

type MedalCountry = { code: string; name: string; gold: number; silver: number; bronze: number; total: number };
type MedalAward = { id: string; countryCode: string; country: string; type: string; sport: string; event: string; date: string };
type OlympicEvent = { id: string; name: string; sport: string; sportCode: string };

@Injectable()
export class AnalyticsService {
  private ready = false;
  private loading: Promise<void> | null = null;

  constructor(private readonly neo4j: Neo4jService) {}

  async overview() {
    await this.ensureSeeded();
    const result = await this.neo4j.run(`
      MATCH (country:OlympicCountry)
      WITH count(country) AS countries
      MATCH (award:OlympicMedal)
      WITH countries, count(award) AS medalAwards
      MATCH (event:OlympicEvent)
      RETURN countries, medalAwards, count(event) AS events
    `);
    const row = result.records[0];
    const sports = await this.neo4j.run("MATCH (event:OlympicEvent) RETURN count(DISTINCT event.sport) AS count");
    return {
      edition: "Paris 2024",
      source: "Paris 2024 Olympics results dataset",
      countries: this.number(row?.get("countries")),
      medalAwards: this.number(row?.get("medalAwards")),
      events: this.number(row?.get("events")),
      sports: this.number(sports.records[0]?.get("count")),
    };
  }

  async medalTable(limit = 30) {
    await this.ensureSeeded();
    const boundedLimit = Math.max(1, Math.min(Math.trunc(limit) || 30, 100));
    const result = await this.neo4j.run(`
      MATCH (country:OlympicCountry)
      RETURN country { .code, .name, .gold, .silver, .bronze, .total } AS country
      ORDER BY country.gold DESC, country.silver DESC, country.bronze DESC, country.name ASC
      LIMIT $limit
    `, { limit: boundedLimit });
    return result.records.map((record, index) => {
      const country = record.get("country") as Record<string, unknown>;
      return {
        rank: index + 1,
        code: country.code,
        name: country.name,
        gold: this.number(country.gold),
        silver: this.number(country.silver),
        bronze: this.number(country.bronze),
        total: this.number(country.total),
      };
    });
  }

  async sports() {
    await this.ensureSeeded();
    const result = await this.neo4j.run(`
      MATCH (award:OlympicMedal)
      WITH award.sport AS sport, count(award) AS awards,
        count(DISTINCT award.event) AS events, count(DISTINCT award.countryCode) AS countries
      RETURN sport, awards, events, countries ORDER BY awards DESC, sport ASC
    `);
    return result.records.map((record) => ({
      sport: record.get("sport") as string,
      medalAwards: this.number(record.get("awards")),
      events: this.number(record.get("events")),
      countries: this.number(record.get("countries")),
    }));
  }

  private async ensureSeeded() {
    if (this.ready) return;
    if (!this.loading) {
      this.loading = this.seed().then(() => { this.ready = true; }).finally(() => { this.loading = null; });
    }
    await this.loading;
  }

  private async seed() {
    const dataDirectory = join(__dirname, "..", "..", "data", "olympics");
    const [countryCsv, medalCsv, eventCsv] = await Promise.all([
      readFile(join(dataDirectory, "medals_total.csv"), "utf8"),
      readFile(join(dataDirectory, "medals.csv"), "utf8"),
      readFile(join(dataDirectory, "events.csv"), "utf8"),
    ]);
    const countries: MedalCountry[] = parseCsv(countryCsv).map((row) => ({
      code: row.country_code, name: row.country, gold: Number(row["Gold Medal"]), silver: Number(row["Silver Medal"]),
      bronze: Number(row["Bronze Medal"]), total: Number(row.Total),
    })).filter((country) => country.code && Number.isFinite(country.total));
    const awards: MedalAward[] = parseCsv(medalCsv).map((row) => ({
      id: [row.country_code, row.url_event, row.medal_type].join("|"), countryCode: row.country_code,
      country: row.country, type: row.medal_type.replace(" Medal", ""), sport: row.discipline,
      event: row.event, date: row.medal_date,
    })).filter((award) => award.countryCode && award.id && award.sport && award.event);
    const events: OlympicEvent[] = parseCsv(eventCsv).map((row) => ({
      id: [row.sport_code, row.tag, row.event].join("|"), name: row.event, sport: row.sport, sportCode: row.sport_code,
    })).filter((event) => event.name && event.sport);

    await this.neo4j.run(`
      CREATE CONSTRAINT olympic_country_code_unique IF NOT EXISTS FOR (country:OlympicCountry) REQUIRE country.code IS UNIQUE
    `, {}, "WRITE");
    await this.neo4j.run(`
      CREATE CONSTRAINT olympic_medal_id_unique IF NOT EXISTS FOR (medal:OlympicMedal) REQUIRE medal.id IS UNIQUE
    `, {}, "WRITE");
    await this.neo4j.run(`
      CREATE CONSTRAINT olympic_event_id_unique IF NOT EXISTS FOR (event:OlympicEvent) REQUIRE event.id IS UNIQUE
    `, {}, "WRITE");
    await this.neo4j.run(`
      UNWIND $countries AS row
      MERGE (country:OlympicCountry {code:row.code})
      SET country.name=row.name, country.gold=row.gold, country.silver=row.silver,
          country.bronze=row.bronze, country.total=row.total
    `, { countries }, "WRITE");
    await this.neo4j.run(`
      UNWIND $awards AS row
      MERGE (medal:OlympicMedal {id:row.id})
      SET medal.type=row.type, medal.sport=row.sport, medal.event=row.event,
          medal.date=row.date, medal.countryCode=row.countryCode
      WITH medal, row
      MATCH (country:OlympicCountry {code:row.countryCode})
      MERGE (country)-[:WON]->(medal)
    `, { awards }, "WRITE");
    await this.neo4j.run(`
      UNWIND $events AS row
      MERGE (event:OlympicEvent {id:row.id})
      SET event.name=row.name, event.sport=row.sport, event.sportCode=row.sportCode
    `, { events }, "WRITE");
  }

  private number(value: unknown): number {
    if (value && typeof value === "object" && "toNumber" in value && typeof value.toNumber === "function") return value.toNumber();
    return Number(value ?? 0);
  }
}
