import {
  enumType,
  extendType,
  inputObjectType,
  nonNull,
  objectType,
} from "nexus"
import { WatchLater as WatchLaterModel } from "nexus-prisma"
import { WatchLater as WatchLaterType } from "@prisma/client"

import { validateAuthenticity } from "../lib"
import {
  throwError,
  badInputErrMessage,
  notFoundErrMessage,
  unauthorizedErrMessage,
} from "./Error"
import { FETCH_QTY } from "../lib/constants"

/**
 * The WathLater type that map to the database model
 */
export const WatchLater = objectType({
  name: WatchLaterModel.$name,
  definition(t) {
    t.field(WatchLaterModel.id)
    t.field(WatchLaterModel.createdAt)
    t.field(WatchLaterModel.profileId)
    t.field(WatchLaterModel.profile)
    t.field(WatchLaterModel.publishId)
    t.field(WatchLaterModel.publish)
  },
})

export const PlaylistOrderBy = enumType({
  name: "PlaylistOrderBy",
  members: ["oldest", "newest"],
})

export const FetchWatchLaterInput = inputObjectType({
  name: "FetchWatchLaterInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.string("cursor")
    t.field("orderBy", { type: "PlaylistOrderBy" })
  },
})

export const WatchLaterEdge = objectType({
  name: "WatchLaterEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "WatchLater",
    })
  },
})

export const FetchWatchLaterResponse = objectType({
  name: "FetchWatchLaterResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "WatchLaterEdge" })
  },
})

export const WatchLaterQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Fetch watch later for preview
     */
    t.field("fetchPreviewWatchLater", {
      type: "FetchWatchLaterResponse",
      args: { input: nonNull("FetchWatchLaterInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId } = input
          if (!owner || !accountId || !profileId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          const watchLater = await prisma.watchLater.findMany({
            where: {
              profileId,
            },
            take: 10, // Take only 10 items
            orderBy: {
              createdAt: "desc",
            },
          })

          // Get total watch later
          const count = await prisma.watchLater.count({
            where: {
              profileId,
            },
          })

          if (watchLater.length < count) {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: true,
                count,
              },
              edges: watchLater.map((wl) => ({
                cursor: wl.id,
                node: wl,
              })),
            }
          } else {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                count,
              },
              edges: watchLater.map((wl) => ({
                cursor: wl.id,
                node: wl,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Fetch watch later list of a profile
     */
    t.field("fetchWatchLater", {
      type: "FetchWatchLaterResponse",
      args: { input: nonNull("FetchWatchLaterInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, cursor, orderBy } = input
          if (!owner || !accountId || !profileId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          let watchLater: WatchLaterType[] = []

          if (!cursor) {
            // A. First query
            watchLater = await prisma.watchLater.findMany({
              where: {
                profileId,
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: orderBy === "oldest" ? "asc" : "desc",
              },
            })
          } else {
            // B. Consecutive queries
            watchLater = await prisma.watchLater.findMany({
              where: {
                profileId,
              },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cursor
              orderBy: {
                createdAt: orderBy === "oldest" ? "asc" : "desc",
              },
            })
          }

          // Get total watch later
          const count = await prisma.watchLater.count({
            where: {
              profileId,
            },
          })

          if (watchLater.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = watchLater[watchLater.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.watchLater.findMany({
              where: {
                profileId,
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cusor
              orderBy: {
                createdAt: orderBy === "oldest" ? "asc" : "desc",
              },
            })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
                count,
              },
              edges: watchLater.map((wl) => ({
                cursor: wl.id,
                node: wl,
              })),
            }
          } else {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                count,
              },
              edges: watchLater.map((wl) => ({
                cursor: wl.id,
                node: wl,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })
  },
})

export const AddToWatchLaterInput = inputObjectType({
  name: "AddToWatchLaterInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
  },
})

export const RemoveFromWatchLaterInput = inputObjectType({
  name: "RemoveFromWatchLaterInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
    t.string("id") // the id of the item to be removed, if null, remove all items of this publish from the profile watch later
  },
})

export const RemoveAllWatchLaterInput = inputObjectType({
  name: "RemoveAllWatchLaterInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
  },
})

export const WatchLaterMutation = extendType({
  type: "Mutation",
  definition(t) {
    /**
     * Add to watch later
     */
    t.field("addToWatchLater", {
      type: "WriteResult",
      args: { input: nonNull("AddToWatchLaterInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, publishId } = input
          if (!owner || !accountId || !profileId || !publishId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Get the publish
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
          })
          if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

          await prisma.watchLater.create({
            data: {
              profileId,
              publishId,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Remove from watch later
     */
    t.field("removeFromWatchLater", {
      type: "WriteResult",
      args: { input: nonNull("RemoveFromWatchLaterInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, publishId, id } = input
          if (!owner || !accountId || !profileId || !publishId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // If the `id` is not null, remove that item
          if (id) {
            // Check if the given profile id owns the item
            const item = await prisma.watchLater.findUnique({
              where: {
                id,
              },
            })
            if (!item) throwError(notFoundErrMessage, "NOT_FOUND")
            if (item?.profileId !== profileId)
              throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

            await prisma.watchLater.delete({
              where: {
                id,
              },
            })
          } else {
            // Remove all items of this publish from the profile watch later
            await prisma.watchLater.deleteMany({
              where: {
                AND: [
                  {
                    publishId,
                  },
                  {
                    profileId,
                  },
                ],
              },
            })
          }

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Remove all from watch later
     */
    t.field("removeAllWatchLater", {
      type: "WriteResult",
      args: { input: nonNull("RemoveAllWatchLaterInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId } = input
          if (!owner || !accountId || !profileId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.watchLater.deleteMany({
            where: {
              profileId,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })
  },
})
