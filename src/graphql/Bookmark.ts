import { extendType, inputObjectType, nonNull, objectType } from "nexus"
import { Bookmark as BookmarkModel } from "nexus-prisma"
import { Bookmark as BookmarkType } from "@prisma/client"

import { validateAuthenticity } from "../lib"
import {
  throwError,
  badInputErrMessage,
  notFoundErrMessage,
  unauthorizedErrMessage,
} from "./Error"
import { FETCH_QTY } from "../lib/constants"

/**
 * Bookmark type
 */
export const Bookmark = objectType({
  name: BookmarkModel.$name,
  definition(t) {
    t.field(BookmarkModel.id)
    t.field(BookmarkModel.createdAt)
    t.field(BookmarkModel.publishId)
    t.field(BookmarkModel.publish)
    t.field(BookmarkModel.profileId)
    t.field(BookmarkModel.profile)
  },
})

export const FetchBookmarkInput = inputObjectType({
  name: "FetchBookmarkInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.string("cursor")
    t.field("orderBy", { type: "PlaylistOrderBy" })
  },
})

export const BookmarkEdge = objectType({
  name: "BookmarkEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "Bookmark",
    })
  },
})

export const FetchBookmarkResponse = objectType({
  name: "FetchBookmarkResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "BookmarkEdge" })
  },
})

export const BookmarkQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Fetch bookmarks for preview
     */
    t.field("fetchPreviewBookmarks", {
      type: "FetchBookmarkResponse",
      args: { input: nonNull("FetchBookmarkInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
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

          // Get 2 bookmarks
          const bookmarks = await prisma.bookmark.findMany({
            where: {
              profileId,
            },
            take: 2, // Take only the last 2 items
            orderBy: {
              createdAt: "desc",
            },
          })

          // Get total watch later
          const count = await prisma.bookmark.count({
            where: {
              profileId,
            },
          })

          if (bookmarks.length < count) {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: true,
                count,
              },
              edges: bookmarks.map((bm) => ({
                cursor: bm.id,
                node: bm,
              })),
            }
          } else {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                count,
              },
              edges: bookmarks.map((bm) => ({
                cursor: bm.id,
                node: bm,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Fetch bookmarks
     */
    t.field("fetchBookmarks", {
      type: "FetchBookmarkResponse",
      args: { input: nonNull("FetchBookmarkInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
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

          let bookmarks: BookmarkType[] = []

          if (!cursor) {
            // A. First query
            bookmarks = await prisma.bookmark.findMany({
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
            bookmarks = await prisma.bookmark.findMany({
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

          // Get total bookmarks
          const count = await prisma.bookmark.count({
            where: {
              profileId,
            },
          })

          if (bookmarks.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = bookmarks[bookmarks.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.bookmark.findMany({
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
              edges: bookmarks.map((bm) => ({
                cursor: bm.id,
                node: bm,
              })),
            }
          } else {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                count,
              },
              edges: bookmarks.map((bm) => ({
                cursor: bm.id,
                node: bm,
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

/**
 * Book mark a post input
 */
export const BookmarkPostInput = inputObjectType({
  name: "BookmarkPostInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId") // A profile id of the requestor
    t.nonNull.string("publishId")
  },
})

export const RemoveAllBookmarksInput = inputObjectType({
  name: "RemoveAllBookmarksInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
  },
})

export const BookmarkMutation = extendType({
  type: "Mutation",
  definition(t) {
    /**
     * Book mark a post
     */
    t.field("bookmarkPost", {
      type: "WriteResult",
      args: { input: nonNull("BookmarkPostInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
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

          // Check if a bookmark exists
          const bookmark = await prisma.bookmark.findUnique({
            where: {
              identifier: {
                profileId,
                publishId,
              },
            },
          })

          if (!bookmark) {
            // Create a new bookmark
            await prisma.bookmark.create({
              data: {
                profileId,
                publishId,
              },
            })
          } else {
            // Remove the bookmark
            await prisma.bookmark.delete({
              where: {
                identifier: {
                  profileId,
                  publishId,
                },
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
     * Remove a bookmark
     */
    t.field("removeBookmark", {
      type: "WriteResult",
      args: { input: nonNull("BookmarkPostInput") },
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

          // Remove the bookmark
          await prisma.bookmark.delete({
            where: {
              identifier: {
                profileId,
                publishId,
              },
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Remove all bookmarks
     */
    t.field("removeAllBookmarks", {
      type: "WriteResult",
      args: { input: nonNull("RemoveAllBookmarksInput") },
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

          // Remove the bookmark
          await prisma.bookmark.deleteMany({
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
