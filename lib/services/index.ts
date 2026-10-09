/**
 * Service registry: the ONLY import screens use for data.
 *
 *   import { services } from "@/lib/services";
 *   const res = await services.units.claim(code);
 *   if (!res.ok) showError(res.error.code);
 *
 * NEXT_PUBLIC_DATA_SOURCE=api switches to the Phase 3 HTTP implementations (lib/services/api).
 */
import { apiServices } from "./api";
import { mockServices } from "./mock";
import type { Services } from "./types";

export const dataSource: "mock" | "api" = process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api" : "mock";

export const services: Services = dataSource === "api" ? apiServices : mockServices;

export * from "./types";
