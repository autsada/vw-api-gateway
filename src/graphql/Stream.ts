import {
  enumType,
  extendType,
  inputObjectType,
  nonNull,
  objectType,
} from "nexus"
import { Publish as PublishType } from "@prisma/client"

import { validateAuthenticity } from "../lib"
import {
  throwError,
  badInputErrMessage,
  unauthorizedErrMessage,
  notFoundErrMessage,
} from "./Error"
import { FETCH_QTY } from "../lib/constants"

const {
  DEFAULT_LIVE_STREAM_THUMBNAIL,
  CLOUDFLARE_LIVE_STREAM_PLAYBACK_BASEURL,
} = process.env

export const GetLiveStreamPublishInput = inputObjectType({
  name: "GetLiveStreamPublishInput",
  definition(t) {
    t.nonNull.string("accountId")
    t.nonNull.string("owner")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
  },
})

export const GetLiveStreamPublishRespnse = objectType({
  name: "GetLiveStreamPublishRespnse",
  definition(t) {
    t.field("publish", { type: "Publish" })
    t.field("liveInput", { type: "CreateLiveInputResponse" })
  },
})

export const StreamQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Fetch user's live stream publishes
     */
    t.field("fetchMyLiveStream", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchMyPublishesInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, creatorId, cursor } = input
          if (!owner || !accountId || !creatorId)
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

          // Find the creator
          const creator = await prisma.profile.findUnique({
            where: {
              id: creatorId,
            },
          })
          if (!creator) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the creator
          if (account?.owner?.toLowerCase() !== creator?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Query publises by creator id
          let publishes: PublishType[] = []

          if (!cursor) {
            // A. First query
            publishes = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    creatorId,
                  },
                  {
                    publishType: "Video",
                  },
                  {
                    streamType: "Live",
                  },
                ],
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
              include: {
                playback: true,
              },
            })
          } else {
            // B. Consecutive queries
            publishes = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    creatorId,
                  },
                  {
                    publishType: "Video",
                  },
                  {
                    streamType: "Live",
                  },
                ],
              },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cusor
              orderBy: {
                createdAt: "desc",
              },
              include: {
                playback: true,
              },
            })
          }

          if (publishes.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = publishes[publishes.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    creatorId,
                  },
                  {
                    publishType: "Video",
                  },
                  {
                    streamType: "Live",
                  },
                ],
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cusor
              orderBy: {
                createdAt: "desc",
              },
              include: {
                playback: true,
              },
            })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: publishes.map((pub) => ({
                cursor: pub.id,
                node: pub,
              })),
            }
          } else {
            // No more items to be fetched
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              edges: publishes.map((pub) => ({
                cursor: pub.id,
                node: pub,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("getLiveStreamPublish", {
      type: "GetLiveStreamPublishRespnse",
      args: { input: nonNull("GetLiveStreamPublishInput") },
      resolve: async (
        parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { accountId, owner, profileId, publishId } = input
          if (!accountId || !owner || !profileId || !publishId)
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

          // Find the publish
          let publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
            include: {
              playback: true,
            },
          })
          if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the publish
          if (publish?.creatorId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          if (!publish?.liveInputUID)
            throwError(badInputErrMessage, "BAD_REQUEST")

          // Fetch the live input from Cloudflare
          const liveInput = await dataSources.cloudflareAPI.getLiveInput(
            publish?.liveInputUID!
          )

          return { publish, liveInput }
        } catch (error) {
          // Dont throw return null and handle this case on the frontend
          return null
        }
      },
    })
  },
})

export const RTMPS = objectType({
  name: "RTMPS",
  definition(t) {
    t.nonNull.string("streamKey")
    t.nonNull.string("url")
  },
})

export const SRT = objectType({
  name: "SRT",
  definition(t) {
    t.nonNull.string("passphrase")
    t.nonNull.string("streamId")
    t.nonNull.string("url")
  },
})

export const WebRTC = objectType({
  name: "WebRTC",
  definition(t) {
    t.nonNull.string("url")
  },
})

export const LiveStatus = enumType({
  name: "LiveStatus",
  members: [
    "connected",
    "reconnected",
    "reconnecting",
    "client_disconnect",
    "ttl_exceeded",
    "failed_to_connect",
    "failed_to_reconnect",
    "new_configuration_accepted",
  ],
})

export const CreateLiveInputResult = objectType({
  name: "CreateLiveInputResult",
  definition(t) {
    t.nonNull.string("uid")
    t.field("status", { type: "LiveStatus" })
    t.nonNull.field("rtmps", { type: "RTMPS" })
    t.nonNull.field("rtmpsPlayback", { type: "RTMPS" })
    t.nonNull.field("srt", { type: "SRT" })
    t.nonNull.field("srtPlayback", { type: "SRT" })
    t.nonNull.field("webRTC", { type: "WebRTC" })
    t.nonNull.field("webRTCPlayback", { type: "WebRTC" })
  },
})

export const CreateLiveInputMessage = objectType({
  name: "CreateLiveInputMessage",
  definition(t) {
    t.nonNull.int("code"), t.nonNull.string("message")
  },
})

export const CreateLiveInputResponse = objectType({
  name: "CreateLiveInputResponse",
  definition(t) {
    t.nonNull.field("result", { type: "CreateLiveInputResult" })
    t.nonNull.boolean("success")
    t.nonNull.list.nonNull.field("errors", { type: "CreateLiveInputMessage" })
    t.nonNull.list.nonNull.field("messages", { type: "CreateLiveInputMessage" })
  },
})

export const RequestLiveStreamInput = inputObjectType({
  name: "RequestLiveStreamInput",
  definition(t) {
    t.nonNull.string("accountId")
    t.nonNull.string("owner")
    t.nonNull.string("profileId")
    t.nonNull.string("title")
    t.string("description")
    t.string("thumbnail")
    t.string("thumbnailRef")
    t.nonNull.field("primaryCategory", { type: "Category" })
    t.field("secondaryCategory", { type: "Category" })
    t.string("tags")
    t.nonNull.field("visibility", { type: "Visibility" })
    t.nonNull.field("broadcastType", { type: "BroadcastType" })
  },
})

export const RequestLiveStreamResult = objectType({
  name: "RequestLiveStreamResult",
  definition(t) {
    t.nonNull.string("id") // Publish id
  },
})

export const StreamMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("requestLiveStream", {
      type: "RequestLiveStreamResult",
      args: { input: nonNull("RequestLiveStreamInput") },
      resolve: async (
        parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const {
            accountId,
            owner,
            profileId,
            title,
            primaryCategory,
            visibility,
            broadcastType,
            description,
            thumbnail,
            thumbnailRef,
            secondaryCategory,
            tags,
          } = input
          if (
            !accountId ||
            !owner ||
            !profileId ||
            !title ||
            !primaryCategory ||
            !visibility ||
            !broadcastType
          )
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

          // Create a publish
          const videoThumbnail = thumbnail ?? DEFAULT_LIVE_STREAM_THUMBNAIL
          const publish = await prisma.publish.create({
            data: {
              creatorId: profileId,
              title,
              description,
              thumbnail: videoThumbnail,
              thumbnailRef,
              thumbnailType: "custom",
              primaryCategory,
              secondaryCategory,
              visibility,
              tags,
              streamType: "Live",
              broadcastType,
              publishType: "Video",
            },
          })

          // Create a live input on Cloudflare stream
          const liveInput = await dataSources.cloudflareAPI.createLiveInput(
            publish.id
          )

          if (liveInput.success) {
            // Update the publish to save live input uid
            await prisma.publish.update({
              where: {
                id: publish.id,
              },
              data: {
                liveInputUID: liveInput.result.uid,
              },
            })

            await prisma.playback.create({
              data: {
                thumbnail: videoThumbnail!,
                preview: "",
                duration: 0,
                hls: `${CLOUDFLARE_LIVE_STREAM_PLAYBACK_BASEURL}/${liveInput.result.uid}/video.m3u8`,
                dash: `${CLOUDFLARE_LIVE_STREAM_PLAYBACK_BASEURL}/${liveInput.result.uid}/video.mpd`,
                publishId: publish.id,
                liveStatus: "inprogress",
                videoId: "",
              },
            })
          }

          return { id: publish.id }
        } catch (error) {
          throw error
        }
      },
    })
  },
})
