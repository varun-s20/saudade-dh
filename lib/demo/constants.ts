/**
 * Fixed identifiers of the demo units (tiny module so product code never pulls in the seed data).
 *   SAUD-3K7M  valid, unclaimed: the "hero" unit the showcase claims and fills
 *   SAUD-9PXR  already claimed by another sender
 */
export const HERO = {
  id: "unit_hero",
  code: "SAUD-3K7M",
  slug: "h4kqzm2xv7pt",
  token: "q7t2vd5kz3hxn6wy4jprb2mfa7ce5ugs",
} as const;

export const CLAIMED_ELSEWHERE = {
  id: "unit_9pxr",
  code: "SAUD-9PXR",
  slug: "p2nw7xk5rq3m",
  token: "m3kd7wq2zn5xv4tr6pb2hjc7ya5feg3s",
  email: "jo.alvarez@example.com",
} as const;

export const LAUNCH_BATCH_ID = "batch_launch";
