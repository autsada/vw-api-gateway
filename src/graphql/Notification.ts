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
    t.int("unread")
    t.nonNull.list.nonNull.field("edges", { type: "NotificationEdge" })
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
              orderBy: {
                createdAt: "desc",
              },
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
              orderBy: {
                createdAt: "desc",
              },
            })
          }

          // Get total notifications
          const count = await prisma.notification.count({
            where: {
              receiverId: profileId,
            },
          })

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
              orderBy: {
                createdAt: "desc",
              },
            })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
                count,
              },
              unread,
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
              unread,
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
  },
})
