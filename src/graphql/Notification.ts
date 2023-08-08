import {
  objectType,
  enumType,
  inputObjectType,
  extendType,
  nonNull,
} from "nexus"
import {
  Notification as NotificationModel,
  NotificationType as NotificationTypeEnum,
  ReadStatus as ReadStatusEnum,
} from "nexus-prisma"
import { Notification as NotificationType } from "@prisma/client"

import { validateAuthenticity } from "../lib"
import {
  throwError,
  badInputErrMessage,
  unauthorizedErrMessage,
  notFoundErrMessage,
} from "./Error"
import { FETCH_QTY } from "../lib/constants"
import { publishMessage } from "../lib/pubsub"

const { NEW_NOTIFICATION_TOPIC } = process.env

export const NotificationEnum = enumType(NotificationTypeEnum)
export const ReadStatus = enumType(ReadStatusEnum)

export const Notification = objectType({
  name: NotificationModel.$name,
  definition(t) {
    t.field(NotificationModel.id)
    t.field(NotificationModel.createdAt)
    t.field(NotificationModel.profileId)
    t.field(NotificationModel.profile)
    t.field(NotificationModel.receiverId)
    t.field(NotificationModel.receiver)
    t.field(NotificationModel.content)
    t.field(NotificationModel.status)
  },
})

export const FetchNotificationsInput = inputObjectType({
  name: "FetchNotificationsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.string("cursor")
  },
})

export const GetUnReadNotificationsInput = inputObjectType({
  name: "GetUnReadNotificationsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
  },
})

export const NotificationEdge = objectType({
  name: "NotificationEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "Notification",
    })
  },
})

export const FetchNotificationsResponse = objectType({
  name: "FetchNotificationsResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "NotificationEdge" })
  },
})

export const GetUnReadNotificationsResponse = objectType({
  name: "GetUnReadNotificationsResponse",
  definition(t) {
    t.nonNull.int("unread")
  },
})

export const NotificationQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Fetch notifications of a profile
     */
    t.field("fetchMyNotifications", {
      type: "FetchNotificationsResponse",
      args: { input: nonNull("FetchNotificationsInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, cursor } = input
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

          let notifications: NotificationType[] = []

          if (!cursor) {
            // A. First query
            notifications = await prisma.notification.findMany({
              where: {
                receiverId: profileId,
              },
              take: FETCH_QTY,
              orderBy: [
                {
                  status: "desc",
                },
                {
                  createdAt: "desc",
                },
              ],
            })
          } else {
            // B. Consecutive queries
            notifications = await prisma.notification.findMany({
              where: {
                receiverId: profileId,
              },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cursor
              orderBy: [
                {
                  status: "desc",
                },
                {
                  createdAt: "desc",
                },
              ],
            })
          }

          // Get total notifications
          const count = await prisma.notification.count({
            where: {
              receiverId: profileId,
            },
          })

          if (notifications.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = notifications[notifications.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.notification.findMany({
              where: {
                receiverId: profileId,
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cusor
              orderBy: [
                {
                  status: "desc",
                },
                {
                  createdAt: "desc",
                },
              ],
            })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
                count,
              },
              edges: notifications.map((noti) => ({
                cursor: noti.id,
                node: noti,
              })),
            }
          } else {
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                count,
              },
              edges: notifications.map((noti) => ({
                cursor: noti.id,
                node: noti,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Get unread notifications count
     */
    t.field("getUnReadNotifications", {
      type: "GetUnReadNotificationsResponse",
      args: { input: nonNull("GetUnReadNotificationsInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId } = input
          if (!owner || !accountId || !profileId) return null

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) return null

          // Find the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) return null

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            return null

          // Get total unread notifications
          const unread = await prisma.notification.count({
            where: {
              AND: [
                {
                  receiverId: profileId,
                },
                {
                  status: {
                    equals: "unread",
                  },
                },
              ],
            },
          })

          return { unread }
        } catch (error) {
          throw error
        }
      },
    })
  },
})

export const UpdateNotificationsInput = inputObjectType({
  name: "UpdateNotificationsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.list.nonNull.field("ids", { type: "String" })
  },
})

export const NotificationMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("updateNotificationsStatus", {
      type: "WriteResult",
      args: { input: nonNull("UpdateNotificationsInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, ids } = input
          if (!owner || !accountId || !profileId || !ids)
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

          if (ids.length === 0) return { status: "Ok" }

          await prisma.notification.updateMany({
            where: {
              receiverId: profileId,
              id: {
                in: ids,
              },
            },
            data: {
              status: "read",
            },
          })

          // Publish a message to pub/sub
          await publishMessage(NEW_NOTIFICATION_TOPIC!, profileId)

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })
  },
})
