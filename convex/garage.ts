import { v } from "convex/values";
import { action, mutation, query, internalQuery } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

export const getConfig = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    
    const config = await ctx.db
      .query("garageConfig")
      .first();
    if (!config) return null;
    
    // Only return location for distance calculation
    return {
      latitude: config.latitude,
      longitude: config.longitude,
    };
  },
});

export const openDoor = mutation({
  args: {
    latitude: v.number(),
    longitude: v.number(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const config = await ctx.db
      .query("garageConfig")
      .first();
    if (!config) throw new Error("Garage not configured");

    const distance = calculateDistance(
      args.latitude,
      args.longitude,
      config.latitude,
      config.longitude
    );

    const success = distance <= 2000; // Temporarily increased to 2km
    
    // Log the access attempt
    await ctx.db.insert("accessLogs", {
      userId,
      action: "open",
      timestamp: Date.now(),
      latitude: args.latitude,
      longitude: args.longitude,
      success,
    });

    if (!success) {
      throw new Error("You must be within 2 kilometers of the garage to open it");
    }

    // Call Shelly API to open door
    await ctx.scheduler.runAfter(0, api.garage.controlDoor, {
      command: "open",
    });

    // Schedule auto-close
    await ctx.scheduler.runAfter(
      config.autoCloseDelayMs,
      api.garage.controlDoor,
      { command: "close" }
    );

    return { success: true };
  },
});

export const controlDoor = action({
  args: {
    command: v.union(v.literal("open"), v.literal("close")),
  },
  handler: async (ctx, args) => {
    const config = await ctx.runQuery(api.garage.getFullConfig);
    
    const apiKey = process.env.SHELLY_API_KEY;
    if (!apiKey) {
      throw new Error("SHELLY_API_KEY environment variable not configured");
    }

    console.log("Controlling door:", {
      command: args.command,
      deviceId: config.shellyDeviceId
    });

    // For Gen2 devices, use the v1 API with auth_key
    const url = `https://shelly-25-eu.shelly.cloud/device/relay/control`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        "auth_key": apiKey,
        "id": config.shellyDeviceId,
        "channel": "0",
        "turn": args.command === "open" ? "on" : "off",
        "timer": "1" // Add a 1-second timer to create a pulse
      }).toString()
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shelly API error:", errorText);
      throw new Error(`Failed to ${args.command} garage door: ${errorText}`);
    }

    const result = await response.json();
    console.log("Shelly API response:", result);
  },
});

export const getFullConfig = query({
  handler: async (ctx) => {
    const config = await ctx.db
      .query("garageConfig")
      .first();
    if (!config) throw new Error("Garage not configured");
    return config;
  },
});
