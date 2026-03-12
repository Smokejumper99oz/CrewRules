export const WAITLIST_STATUSES = ["pending", "contacted", "launched", "closed"] as const;
export type WaitlistStatus = (typeof WAITLIST_STATUSES)[number];
