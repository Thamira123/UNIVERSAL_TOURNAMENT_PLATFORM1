import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { Neo4jService } from "../neo4j/neo4j.service";
import { inputObject, textField } from "../common/input";
import type { SessionUser } from "./current-user.decorator";
import { ClerkService } from "./clerk.service";

type ClerkIdentity = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  username: string | null;
  primaryEmailAddressId: string | null;
  emailAddresses: { id: string; emailAddress: string; verification: { status: string } | null }[];
};

@Injectable()
export class AuthService {
  private readonly platformAdminEmails: Set<string>;
  private readonly platformAdminInviteCode: string;

  constructor(private readonly neo4j: Neo4jService, private readonly clerk: ClerkService, config: ConfigService) {
    this.platformAdminEmails = new Set((config.get<string>("PLATFORM_ADMIN_EMAILS", "") ?? "").split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
    this.platformAdminInviteCode = config.get<string>("PLATFORM_ADMIN_INVITE_CODE", "") ?? "";
    if (this.platformAdminEmails.size && this.platformAdminInviteCode.length < 32) throw new Error("PLATFORM_ADMIN_INVITE_CODE must be configured with at least 32 characters when PLATFORM_ADMIN_EMAILS is set.");
  }

  async syncClerkUser(clerkId: string): Promise<SessionUser> {
    const clerkUser = await this.clerk.getUser(clerkId) as unknown as ClerkIdentity;
    const primaryEmail = clerkUser.emailAddresses.find((entry) => entry.id === clerkUser.primaryEmailAddressId);
    if (!primaryEmail || primaryEmail.verification?.status !== "verified") {
      throw new ForbiddenException("Verify your primary email address in Clerk before using your UTMP workspace.");
    }

    const email = primaryEmail.emailAddress.trim().toLowerCase();
    const name = (clerkUser.fullName || [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || clerkUser.username || email.split("@")[0]).slice(0, 80);
    const linked = await this.neo4j.run("MATCH (user:User {clerkId:$clerkId}) RETURN user { .id, .name, .email, .role } AS user", { clerkId });
    if (linked.records[0]) {
      const account = this.sessionUser(linked.records[0].get("user"));
      if (account.name !== name || account.email !== email) {
        try {
          await this.neo4j.run("MATCH (user:User {id:$id}) SET user.name=$name, user.email=$email, user.updatedAt=datetime()", {
            id: account.id, name, email,
          }, "WRITE");
        } catch (error) {
          if (String((error as { code?: string }).code ?? "").includes("ConstraintValidationFailed")) {
            throw new ConflictException("This email is already attached to another UTMP account.");
          }
          throw error;
        }
        account.name = name;
        account.email = email;
      }
      return account;
    }

    const existing = await this.neo4j.run("MATCH (user:User {email:$email}) RETURN user { .id, .name, .email, .role, .clerkId } AS user", { email });
    const legacyAccount = existing.records[0]?.get("user") as (SessionUser & { clerkId?: string }) | undefined;

    if (legacyAccount?.clerkId && legacyAccount.clerkId !== clerkId) {
      throw new ConflictException("This email is already linked to a different Clerk account. Contact a UTMP administrator.");
    }

    if (legacyAccount) {
      await this.neo4j.run("MATCH (user:User {id:$id}) SET user.clerkId=$clerkId, user.name=$name, user.email=$email, user.updatedAt=datetime()", {
        id: legacyAccount.id, clerkId, name, email,
      }, "WRITE");
      return { id: legacyAccount.id, name, email, role: legacyAccount.role === "ADMIN" ? "ADMIN" : "USER" };
    }

    const id = randomUUID();
    try {
      const created = await this.neo4j.run(`
        CREATE (user:User {id:$id, clerkId:$clerkId, name:$name, email:$email, role:'USER', createdAt:datetime()})
        RETURN user { .id, .name, .email, .role } AS user
      `, { id, clerkId, name, email }, "WRITE");
      return this.sessionUser(created.records[0]?.get("user"));
    } catch (error) {
      if (String((error as { code?: string }).code ?? "").includes("ConstraintValidationFailed")) {
        const linkedDuringRequest = await this.neo4j.run("MATCH (user:User {clerkId:$clerkId}) RETURN user { .id, .name, .email, .role } AS user", { clerkId });
        if (linkedDuringRequest.records[0]) return this.sessionUser(linkedDuringRequest.records[0].get("user"));
        throw new ConflictException("This Clerk account or email is already linked to another UTMP account.");
      }
      throw error;
    }
  }

  async profile(userId: string) {
    const result = await this.neo4j.run(`
      MATCH (u:User {id:$userId})
      OPTIONAL MATCH (u)-[membership:ORG_MEMBER]->(o:Organization)
      WITH u, collect(CASE WHEN o IS NULL THEN null ELSE {id:o.id, name:o.name, role:membership.role} END) AS organizations
      OPTIONAL MATCH (u)-[tournamentRole:TOURNAMENT_ADMIN]->(t:Tournament)
      OPTIONAL MATCH (org:Organization)-[:ORGANIZES]->(t)
      WITH u, organizations, collect(DISTINCT CASE WHEN t IS NULL THEN null ELSE {id:t.id, name:t.name, role:tournamentRole.role, organization:org.name} END) AS managedTournaments
      OPTIONAL MATCH (u)-[:TOURNAMENT_REQUESTER]->(requested:Tournament)
      OPTIONAL MATCH (requestedOrg:Organization)-[:ORGANIZES]->(requested)
      WITH u, organizations, managedTournaments, collect(DISTINCT CASE WHEN requested IS NULL THEN null ELSE {id:requested.id, name:requested.name, role:'REQUESTER', organization:requestedOrg.name} END) AS requestedTournaments
      RETURN u { .id, .name, .email, .role, .createdAt } AS user, organizations,
        [item IN managedTournaments + requestedTournaments WHERE item IS NOT NULL] AS tournaments
    `, { userId });
    const record = result.records[0];
    if (!record) throw new UnauthorizedException("Account no longer exists.");
    const user = this.sessionUser(record.get("user"));
    return { user, organizations: record.get("organizations"), tournaments: record.get("tournaments") };
  }

  async claimPlatformAdmin(userId: string, value: unknown) {
    const body = inputObject(value);
    const adminCode = textField(body, "adminCode", 256);
    const userResult = await this.neo4j.run("MATCH (user:User {id:$userId}) RETURN user.email AS email", { userId });
    const email = userResult.records[0]?.get("email") as string | undefined;
    if (!email) throw new UnauthorizedException("Account no longer exists.");
    if (!this.platformAdminEmails.has(email.toLowerCase()) || !this.matchesAdminCode(adminCode)) {
      throw new ForbiddenException("This account is not authorized for platform administrator access.");
    }
    await this.neo4j.run("MATCH (user:User {id:$userId}) SET user.role='ADMIN'", { userId }, "WRITE");
    return { role: "ADMIN" as const };
  }

  private sessionUser(value: unknown): SessionUser {
    const user = value as SessionUser | undefined;
    if (!user?.id || !user.email) throw new UnauthorizedException("Your UTMP account could not be loaded.");
    return { id: user.id, name: user.name, email: user.email, role: user.role === "ADMIN" ? "ADMIN" : "USER" };
  }

  private matchesAdminCode(candidate: string): boolean {
    if (!candidate || !this.platformAdminInviteCode) return false;
    const supplied = Buffer.from(candidate, "utf8");
    const expected = Buffer.from(this.platformAdminInviteCode, "utf8");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  }
}
