import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const addAuthorizedUser = mutation({
  args: {
    email: v.string(),
    isAdmin: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    // Check if the current user is an admin
    const currentUserAuth = await ctx.db
      .query("authorizedUsers")
      .withIndex("by_email", q => q.eq("email", user?.email ?? ""))
      .unique();

    if (!currentUserAuth?.isAdmin) {
      throw new Error("Only administrators can add new users");
    }

    // Add the new authorized user
    await ctx.db.insert("authorizedUsers", {
      email: args.email,
      isAdmin: args.isAdmin,
      addedBy: userId,
      addedAt: Date.now(),
    });
  },
});

export const removeAuthorizedUser = mutation({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    // Check if the current user is an admin
    const currentUserAuth = await ctx.db
      .query("authorizedUsers")
      .withIndex("by_email", q => q.eq("email", user?.email ?? ""))
      .unique();

    if (!currentUserAuth?.isAdmin) {
      throw new Error("Only administrators can remove users");
    }

    // Find and delete the authorized user
    const userToRemove = await ctx.db
      .query("authorizedUsers")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique();

    if (userToRemove) {
      await ctx.db.delete(userToRemove._id);
    }
  },
});

export const listAuthorizedUsers = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db.get(userId);
    // Check if the current user is an admin
    const currentUserAuth = await ctx.db
      .query("authorizedUsers")
      .withIndex("by_email", q => q.eq("email", user?.email ?? ""))
      .unique();

    if (!currentUserAuth?.isAdmin) {
      throw new Error("Only administrators can view the user list");
    }

    return await ctx.db
      .query("authorizedUsers")
      .collect();
  },
});

// Internal function to check if a user is authorized
export const checkAuthorized = query({
  args: {
    email: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("authorizedUsers")
      .withIndex("by_email", q => q.eq("email", args.email))
      .unique();
  },
});

// Internal function to create or update a user
export const createOrUpdateUser = mutation({
  args: {
    userId: v.id("users"),
    email: v.string(),
    name: v.optional(v.string()),
    pictureUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      email: args.email,
      name: args.name,
      image: args.pictureUrl,
    });
  },
});
