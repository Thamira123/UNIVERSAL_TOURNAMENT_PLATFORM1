import { Controller, Get, Query } from "@nestjs/common";
import { AnalyticsService } from "./analytics.service";

@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get("overview") overview() { return this.analytics.overview(); }

  @Get("medals") medals(@Query("limit") limit?: string) {
    const parsedLimit = limit === undefined ? 30 : Number.parseInt(limit, 10);
    return this.analytics.medalTable(Number.isFinite(parsedLimit) ? parsedLimit : 30);
  }

  @Get("sports") sports() { return this.analytics.sports(); }
}
