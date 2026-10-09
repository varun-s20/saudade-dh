/**
 * Phase 3 HTTP implementations of the service interfaces (NEXT_PUBLIC_DATA_SOURCE=api).
 * Endpoint contracts: docs/ARCHITECTURE.md §6. Every call goes through `request()` in ./http,
 * which maps HTTP status + `{ code }` bodies to ServiceErrorCode and never throws.
 *
 * Phase 2 status: these clients are complete, but the REST endpoints they call (except
 * POST /api/song/resolve) do not exist yet, so the default data source stays "mock"
 * (lib/services/index.ts).
 */
import type { Services } from "@/lib/services/types";
import { apiAdminService } from "./admin";
import { apiContentService } from "./content";
import { apiEmailService } from "./email";
import { apiMediaService } from "./media";
import { apiRevealService } from "./reveal";
import { apiUnitService } from "./units";

export const apiServices: Services = {
  units: apiUnitService,
  content: apiContentService,
  media: apiMediaService,
  reveal: apiRevealService,
  admin: apiAdminService,
  email: apiEmailService,
};
