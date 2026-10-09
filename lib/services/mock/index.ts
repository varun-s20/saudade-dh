import type { Services } from "@/lib/services/types";
import { adminService } from "./admin";
import { contentService } from "./content";
import { emailService } from "./email";
import { mediaService } from "./media";
import { revealService } from "./reveal";
import { unitService } from "./units";

export const mockServices: Services = {
  units: unitService,
  content: contentService,
  media: mediaService,
  reveal: revealService,
  admin: adminService,
  email: emailService,
};

export { DEMO_ADMIN } from "./admin";
