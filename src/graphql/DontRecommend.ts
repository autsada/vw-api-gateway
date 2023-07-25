import { extendType, inputObjectType, nonNull, objectType } from "nexus"
import { DontRecommend as DontRecommendModel } from "nexus-prisma"
import type { DontRecommend as DontRecommendType } from "@prisma/client"

import {
  throwError,
  badInputErrMessage,
  badRequestErrMessage,
  unauthorizedErrMessage,
  notFoundErrMessage,
} from "./Error"
import { validateAuthenticity } from "../lib"
import { FETCH_QTY } from "../lib/constants"

/**
 * The DontRecommend type that map to the database model
 */
export const DontRecommend = objectType({
  name: DontRecommendModel.$name,
  definition(t) {
    t.field(DontRecommendModel.createdAt)
    t.field(DontRecommendModel.requestorId)
    t.field(DontRecommendModel.targetId)
    t.field(DontRecommendModel.target)
  },
})

export const DontRecommendEdge = objectType({
  name: "DontRecommendEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "DontRecommend",
    })
  },
})

export const FetchDontRecommendsResponse = objectType({
  name: "FetchDontRecommendsResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "DontRecommendEdge" })
  },
})

export const FetchDontRecommendsInput = inputObjectType({
  name: "FetchDontRecommendsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("requestorId") // Creator profile id
    t.string("cursor") // A point in the database to start query from --> uses `id` column
  },
})

export const DontRecommendQuery = extendType({
  type: "Query",
  definition(t) {
    t.field("fetchDontRecommends", {
      type: "FetchDontRecommendsResponse",
      args: { input: nonNull("FetchDontRecommendsInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, requestorId, cursor } = input
          if (!owner || !accountId || !requestorId)
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
              id: requestorId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          let dontRecommends: DontRecommendType[] = []

          if (!cursor) {
            // A. First query
            dontRecommends = await prisma.dontRecommend.findMany({
              where: {
                requestorId,
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
            })
          } else {
            // B. Consecutive queries
            dontRecommends = await prisma.dontRecommend.findMany({
              where: {
                requestorId,
              },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cursor
              orderBy: {
                createdAt: "desc",
              },
            })
          }

          if (dontRecommends.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor =
              dontRecommends[dontRecommends.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.dontRecommend.findMany({
              where: {
                requestorId,
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cusor
              orderBy: {
                createdAt: "desc",
              },
            })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: dontRecommends.map((drc) => ({
                cursor: drc.id,
                node: drc,
              })),
            }
          } else {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              edges: dontRecommends.map((drc) => ({
                cursor: drc.id,
                node: drc,
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

export const DontRecommendInput = inputObjectType({
  name: "DontRecommendInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("targetId") // A target profile to add to don't recommend list of the requestor
  },
})

export const DontRecommendMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("dontRecommend", {
      type: "WriteResult",
      args: { input: nonNull("DontRecommendInput") },
      resolve: async (
        parent,
        { input },
        { dataSources, signature, prisma }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, targetId } = input
          if (!owner || !accountId || !profileId || !targetId)
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

          if (profileId === targetId)
            throwError(badRequestErrMessage, "BAD_REQUEST")

          // Check if the the target id is already in the list or not
          const target = await prisma.dontRecommend.findUnique({
            where: {
              identifier: {
                requestorId: profileId,
                targetId,
              },
            },
          })

          if (target) return { status: "Ok" }

          await prisma.dontRecommend.create({
            data: {
              requestorId: profileId,
              targetId,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("removeDontRecommend", {
      type: "WriteResult",
      args: { input: nonNull("DontRecommendInput") },
      resolve: async (
        parent,
        { input },
        { dataSources, signature, prisma }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, targetId } = input
          if (!owner || !accountId || !profileId || !targetId)
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

          // Check if the the target id is already in the list or not
          const target = await prisma.dontRecommend.findUnique({
            where: {
              identifier: {
                requestorId: profileId,
                targetId,
              },
            },
          })

          if (!target) return { status: "Ok" }

          await prisma.dontRecommend.delete({
            where: {
              identifier: {
                requestorId: profileId,
                targetId,
              },
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
