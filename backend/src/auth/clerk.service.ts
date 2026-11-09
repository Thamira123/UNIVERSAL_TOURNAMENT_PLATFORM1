import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClerkClient, verifyToken } from "@clerk/backend";

@Injectable()
export class ClerkService {
  private readonly secretKey: string;
  private readonly authorizedParties: string[];
  private readonly client: ReturnType<typeof createClerkClient> | null;
  private readonly userCache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly userRequests = new Map<string, Promise<unknown>>();

  constructor(config: ConfigService) {
    this.secretKey = config.get<string>("CLERK_SECRET_KEY", "") ?? "";
    const configuredParties = config.get<string>("CLERK_AUTHORIZED_PARTIES", "") ?? "";
    this.authorizedParties = [...new Set([
      config.get<string>("FRONTEND_URL", "http://localhost:3000") ?? "http://localhost:3000",
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      ...configuredParties.split(",").map((value) => value.trim()).filter(Boolean),
    ])];
    this.client = this.secretKey ? createClerkClient({ secretKey: this.secretKey }) : null;
  }

  async verifySessionToken(token: string) {
    if (!this.secretKey) throw new ServiceUnavailableException("Clerk is not configured. Set CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, then restart the API.");
    try {
      return await verifyToken(token, { secretKey: this.secretKey, authorizedParties: this.authorizedParties });
    } catch {
      throw new UnauthorizedException("Your Clerk session is invalid or expired. Sign in again.");
    }
  }

  async getUser(clerkId: string) {
    if (!this.client) throw new ServiceUnavailableException("Clerk is not configured. Set CLERK_SECRET_KEY and NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, then restart the API.");
    const cached = this.userCache.get(clerkId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;
    const pending = this.userRequests.get(clerkId);
    if (pending) return pending;

    const request = this.client.users.getUser(clerkId)
      .then((user) => {
        this.userCache.set(clerkId, { value: user, expiresAt: Date.now() + 2 * 60 * 1000 });
        return user;
      })
      .catch(() => { throw new UnauthorizedException("Your Clerk account could not be verified. Sign in again."); })
      .finally(() => this.userRequests.delete(clerkId));
    this.userRequests.set(clerkId, request);
    return request;
  }
}
