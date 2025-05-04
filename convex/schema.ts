import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  garageConfig: defineTable({
    shellyDeviceId: v.string(),
    latitude: v.number(),
    longitude: v.number(),
    autoCloseDelayMs: v.number(),
  }),
  accessLogs: defineTable({
    userId: v.id("users"),
    action: v.string(),
    timestamp: v.number(),
    latitude: v.number(),
    longitude: v.number(),
    success: v.boolean(),
  }).index("by_user", ["userId"]),
  authorizedUsers: defineTable({
    email: v.string(),
    isAdmin: v.boolean(),
    addedBy: v.id("users"),
    addedAt: v.number(),
  }).index("by_email", ["email"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
