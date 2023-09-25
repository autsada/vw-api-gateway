import {
  extendType,
  objectType,
  enumType,
  nonNull,
  inputObjectType,
  stringArg,
} from "nexus"
import {
  Publish as PublishType,
  DontRecommend as DontRecommendType,
} from "@prisma/client"
import {
  Category as CategoryEnum,
  PublishType as PublishTypeEnum,
  Playback as PlaybackModel,
  ThumbnailType as ThumbnailTypeEnum,
  Visibility as VisibilityEnum,
  Publish as PublishModel,
  Like as LikeModel,
  DisLike as DisLikeModel,
  Blog as BlogModel,
  Tip as TipModel,
  StreamType as StreamTypeEnum,
  BroadcastType as BroadcastTypeEnum,
  LiveStatus as LiveStatusEnum,
} from "nexus-prisma"

import { NexusGenInputs } from "../typegen"
import {
  badInputErrMessage,
  badRequestErrMessage,
  notFoundErrMessage,
  throwError,
  unauthorizedErrMessage,
} from "./Error"
import {
  calucateReadingTime,
  createLikePublishNotiContent,
  getPostExcerpt,
  validateAuthenticity,
} from "../lib"
import { FETCH_QTY } from "../lib/constants"
import { publishMessage } from "../lib/pubsub"

const { PUBLISH_PROCESSING_TOPIC, NEW_NOTIFICATION_TOPIC } = process.env

export const Category = enumType(CategoryEnum)
export const PublishClasification = enumType(PublishTypeEnum)
export const ThumbnailType = enumType(ThumbnailTypeEnum)
export const Visibility = enumType(VisibilityEnum)
export const StreamType = enumType(StreamTypeEnum)
export const BroadcastType = enumType(BroadcastTypeEnum)
export const LiveStatus = enumType(LiveStatusEnum)

export const Playback = objectType({
  name: PlaybackModel.$name,
  definition(t) {
    t.field(PlaybackModel.id)
    t.field(PlaybackModel.createdAt)
    t.field(PlaybackModel.updatedAt)
    t.field(PlaybackModel.videoId)
    t.field(PlaybackModel.thumbnail)
    t.field(PlaybackModel.preview)
    t.field(PlaybackModel.duration)
    t.field(PlaybackModel.hls)
    t.field(PlaybackModel.dash)
    t.field(PlaybackModel.publishId)
    t.field(PlaybackModel.publish)
    t.field(PlaybackModel.liveStatus)
  },
})

export const Blog = objectType({
  name: BlogModel.$name,
  definition(t) {
    t.field(BlogModel.createdAt)
    t.field(BlogModel.updatedAt)
    t.field(BlogModel.publishId)
    t.field(BlogModel.publish)
    t.field(BlogModel.content)
    t.field(BlogModel.htmlContent)
    t.field(BlogModel.readingTime)
    t.field(BlogModel.excerpt)
  },
})

export const Like = objectType({
  name: LikeModel.$name,
  definition(t) {
    t.field(LikeModel.createdAt)
    t.field(LikeModel.profileId)
    t.field(LikeModel.profile)
    t.field(LikeModel.publishId)
    t.field(LikeModel.publish)
  },
})

export const DisLike = objectType({
  name: DisLikeModel.$name,
  definition(t) {
    t.field(DisLikeModel.createdAt)
    t.field(DisLikeModel.profileId)
    t.field(DisLikeModel.profile)
    t.field(DisLikeModel.publishId)
    t.field(DisLikeModel.publish)
  },
})

export const Tip = objectType({
  name: TipModel.$name,
  definition(t) {
    t.field(TipModel.id)
    t.field(TipModel.createdAt)
    t.field(TipModel.senderId)
    t.field(TipModel.sender)
    t.field(TipModel.from)
    t.field(TipModel.publishId)
    t.field(TipModel.publish)
    t.field(TipModel.receiverId)
    t.field(TipModel.receiver)
    t.field(TipModel.to)
    t.field(TipModel.amount)
    t.field(TipModel.fee)
  },
})

export const Publish = objectType({
  name: PublishModel.$name,
  definition(t) {
    t.field(PublishModel.id)
    t.field(PublishModel.createdAt)
    t.field(PublishModel.updatedAt)
    t.field(PublishModel.creatorId)
    t.field(PublishModel.contentURI)
    t.field(PublishModel.contentRef)
    t.field(PublishModel.filename)
    t.field(PublishModel.thumbnail)
    t.field(PublishModel.thumbnailRef)
    t.field(PublishModel.thumbnailType)
    t.field(PublishModel.title)
    t.field(PublishModel.description)
    t.field(PublishModel.views)
    t.field(PublishModel.primaryCategory)
    t.field(PublishModel.secondaryCategory)
    t.field(PublishModel.publishType)
    t.field(PublishModel.visibility)
    t.field(PublishModel.tags)
    t.field(PublishModel.uploadError)
    t.field(PublishModel.transcodeError)
    t.field(PublishModel.uploading)
    t.field(PublishModel.deleting)
    t.field(PublishModel.creator)
    t.field(PublishModel.playback)
    t.field(PublishModel.blog)
    t.field(PublishModel.likes)
    t.field(PublishModel.dislikes)
    t.field(PublishModel.tips)
    t.field(PublishModel.comments)
    t.field(PublishModel.streamType)
    t.field(PublishModel.broadcastType)
    t.field(PublishModel.liveInputUID)

    /**
     * Number of likes a publish has
     */
    t.nonNull.field("likesCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.like.count({
          where: {
            publishId: parent.id,
          },
        })
      },
    })

    /**
     * A boolean to check whether a profile (who sends the query) liked the publish or not, if no `requestorId` provided resolve to null.
     */
    t.nullable.field("liked", {
      type: "Boolean",
      resolve: async (parent, _, { prisma }, info) => {
        const { input } = info.variableValues as {
          input: NexusGenInputs["QueryByIdInput"]
        }

        if (!input || !input.requestorId) return null
        const { requestorId } = input

        const like = await prisma.like.findUnique({
          where: {
            identifier: {
              publishId: parent.id,
              profileId: requestorId,
            },
          },
        })

        return !!like
      },
    })

    /**
     * Number of dislikes a publish has
     */
    t.nonNull.field("disLikesCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.disLike.count({
          where: {
            publishId: parent.id,
          },
        })
      },
    })

    /**
     * A boolean to check whether a profile (who sends the query) disliked the publish or not, if no `requestorId` provided resolve to null.
     */
    t.nullable.field("disLiked", {
      type: "Boolean",
      resolve: async (parent, _, { prisma }, info) => {
        const { input } = info.variableValues as {
          input: NexusGenInputs["QueryByIdInput"]
        }

        if (!input || !input.requestorId) return null
        const { requestorId } = input

        const disLike = await prisma.disLike.findUnique({
          where: {
            identifier: {
              publishId: parent.id,
              profileId: requestorId,
            },
          },
        })

        return !!disLike
      },
    })

    // /**
    //  * A list of tips that a publish received.
    //  */
    // t.nonNull.list.field("tips", {
    //   type: "Tip",
    //   resolve: async (parent, _, { prisma }) => {
    //     return prisma.publish
    //       .findUnique({
    //         where: {
    //           id: parent.id,
    //         },
    //       })
    //       .tips() as unknown as NexusGenObjects["Tip"][]
    //   },
    // })

    /**
     * Number of tips a publish received
     */
    t.nonNull.field("tipsCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.tip.count({
          where: {
            publishId: parent.id,
          },
        })
      },
    })

    /**
     * Number of comments a publish has.
     */
    t.nonNull.field("commentsCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.comment.count({
          where: {
            AND: [
              {
                publishId: parent.id,
              },
              {
                commentType: "PUBLISH",
              },
            ],
          },
        })
      },
    })
    /**
     * A publish's last comment.
     */
    t.nullable.field("lastComment", {
      type: "Comment",
      resolve: async (parent, _, { prisma }) => {
        return prisma.comment.findFirst({
          where: {
            AND: [
              {
                publishId: parent.id,
              },
              {
                commentType: "PUBLISH",
              },
            ],
          },
          orderBy: [
            {
              comments: {
                _count: "desc",
              },
            },
            {
              createdAt: "desc",
            },
          ],
        })
      },
    })

    /**
     * A boolean to check whether a profile (who sends the query) bookmarked the publish or not, if no `requestorId` provided resolve to null.
     */
    t.nullable.field("bookmarked", {
      type: "Boolean",
      resolve: async (parent, _, { prisma }, info) => {
        const { input } = info.variableValues as {
          input: NexusGenInputs["QueryByIdInput"]
        }

        if (!input || !input.requestorId) return null
        const { requestorId } = input

        const bookmark = await prisma.bookmark.findUnique({
          where: {
            identifier: {
              publishId: parent.id,
              profileId: requestorId,
            },
          },
        })

        return !!bookmark
      },
    })
  },
})

export const QueryPublishType = enumType({
  name: "QueryPublishType",
  members: ["all", "videos", "shorts", "blogs", "ads", "live"],
})

export const PublishOrderBy = enumType({
  name: "PublishOrderBy",
  members: ["latest", "popular"],
})

export const FetchMyPublishesInput = inputObjectType({
  name: "FetchMyPublishesInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("creatorId") // Creator profile id
    t.string("cursor") // A point in the database to start query from --> uses `id` column
    t.field("publishType", { type: "QueryPublishType" })
  },
})

export const FetchPublishesInput = inputObjectType({
  name: "FetchPublishesInput",
  definition(t) {
    t.string("requestorId") // profile id of the requestor
    t.string("cursor")
    t.field("orderBy", { type: "PublishOrderBy" })
    t.field("publishType", { type: "QueryPublishType" })
  },
})

// Fetch suggested publishes to display on the watch page
export const FetchSuggestedPublishesInput = inputObjectType({
  name: "FetchSuggestedPublishesInput",
  definition(t) {
    t.string("requestorId") // Profile id of the requestor
    t.nonNull.string("publishId")
    t.string("cursor")
  },
})

export const FetchPublishesByCatInput = inputObjectType({
  name: "FetchPublishesByCatInput",
  definition(t) {
    t.string("requestorId") // Profile id of the requestor
    t.nonNull.field("category", { type: "Category" })
    t.string("cursor")
  },
})

export const FetchPublishesByProfileInput = inputObjectType({
  name: "FetchPublishesByProfileInput",
  definition(t) {
    t.nonNull.string("creatorId") // Profile id of the creator
    t.string("requestorId") // Profile id of the requestor
    t.string("cursor")
    t.field("publishType", { type: "QueryPublishType" })
    t.field("orderBy", { type: "PublishOrderBy" })
  },
})

export const FetchPublishesByTagInput = inputObjectType({
  name: "FetchPublishesByTagInput",
  definition(t) {
    t.string("requestorId") // Profile id of the requestor
    t.string("cursor")
    t.nonNull.string("tag")
    t.field("publishType", { type: "QueryPublishType" })
  },
})

export const FetchPublishesByQueryStringInput = inputObjectType({
  name: "FetchPublishesByQueryStringInput",
  definition(t) {
    t.string("requestorId") // Profile id of the requestor
    t.string("cursor")
    t.nonNull.string("query")
    t.field("publishType", { type: "QueryPublishType" })
  },
})

export const PageInfo = objectType({
  name: "PageInfo",
  definition(t) {
    t.string("endCursor")
    t.boolean("hasNextPage")
    t.int("count")
  },
})

export const PublishEdge = objectType({
  name: "PublishEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "Publish",
    })
  },
})

export const FetchPublishesResponse = objectType({
  name: "FetchPublishesResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "PublishEdge" })
  },
})

export const PublishQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Get a publish by id
     */
    t.field("getPublishById", {
      type: "Publish",
      args: { input: nonNull("QueryByIdInput") },
      resolve: async (_parent, { input }, { prisma }) => {
        try {
          const { targetId } = input

          return prisma.publish.findUnique({
            where: {
              id: targetId,
            },
          })
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Fetch all publishes created by a profile (including draft and private publishes)
     */
    t.field("fetchMyPublishes", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchMyPublishesInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, creatorId, cursor, publishType } = input
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
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            in: ["software", "webcam"],
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : undefined,
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
            })
          } else {
            // B. Consecutive queries
            publishes = await prisma.publish.findMany({
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            in: ["software", "webcam"],
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : undefined,
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cusor
              orderBy: {
                createdAt: "desc",
              },
            })
          }

          if (publishes.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = publishes[publishes.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.publish.findMany({
              where: {
                creatorId,
                publishType:
                  publishType === "videos"
                    ? {
                        equals: "Video",
                      }
                    : publishType === "shorts"
                    ? {
                        equals: "Short",
                      }
                    : publishType === "blogs"
                    ? {
                        equals: "Blog",
                      }
                    : publishType === "ads"
                    ? {
                        equals: "Ads",
                      }
                    : undefined,
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

    t.field("fetchPublishes", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchPublishesInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          const { cursor, requestorId, orderBy, publishType } = input

          let publishes: PublishType[] = []

          // Get dont recommended profiles
          let dontRecommends: DontRecommendType[] = []
          if (requestorId) {
            const dontRecommendsCount = await prisma.dontRecommend.count({
              where: {
                requestorId,
              },
            })
            dontRecommends = !dontRecommendsCount
              ? []
              : await prisma.dontRecommend.findMany({
                  where: {
                    requestorId,
                  },
                  take: dontRecommendsCount,
                })
          }

          // List of the profile ids in user's don't recommend list
          const dontRecommendsList = dontRecommends.map((drc) => drc.targetId)

          if (!cursor) {
            publishes = await prisma.publish.findMany({
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          streamType: {
                            equals: "onDemand",
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          streamType: {
                            equals: "onDemand",
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          streamType: {
                            equals: "Live",
                          },
                        },
                        {
                          playback: {
                            liveStatus: {
                              equals: "inprogress",
                            },
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                      ],
                    },
              take: FETCH_QTY,
              orderBy:
                orderBy === "popular"
                  ? [
                      {
                        views: "desc",
                      },
                      {
                        likes: {
                          _count: "desc",
                        },
                      },
                      {
                        createdAt: "desc",
                      },
                    ]
                  : {
                      createdAt: "desc",
                    },
            })
          } else {
            publishes = await prisma.publish.findMany({
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          streamType: {
                            equals: "onDemand",
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          streamType: {
                            equals: "onDemand",
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          streamType: {
                            equals: "Live",
                          },
                        },
                        {
                          playback: {
                            liveStatus: {
                              equals: "inprogress",
                            },
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                      ],
                    },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cursor
              orderBy:
                orderBy === "popular"
                  ? [
                      {
                        views: "desc",
                      },
                      {
                        likes: {
                          _count: "desc",
                        },
                      },
                      {
                        createdAt: "desc",
                      },
                    ]
                  : {
                      createdAt: "desc",
                    },
            })
          }

          if (publishes.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = publishes[publishes.length - 1].id

            // Check if there is next page
            let nextQuery = await prisma.publish.findMany({
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          streamType: {
                            equals: "onDemand",
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          streamType: {
                            equals: "onDemand",
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          streamType: {
                            equals: "Live",
                          },
                        },
                        {
                          playback: {
                            liveStatus: {
                              equals: "inprogress",
                            },
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : {
                      AND: [
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          uploading: {
                            equals: false,
                          },
                        },
                        {
                          creatorId: {
                            notIn: dontRecommendsList,
                          },
                        },
                      ],
                    },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cusor
              orderBy:
                orderBy === "popular"
                  ? [
                      {
                        views: "desc",
                      },
                      {
                        likes: {
                          _count: "desc",
                        },
                      },
                      {
                        createdAt: "desc",
                      },
                    ]
                  : {
                      createdAt: "desc",
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

    t.field("fetchVideosByCategory", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchPublishesByCatInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          const { category, cursor, requestorId } = input

          let videos: PublishType[] = []

          // Get dont recommended profiles
          let dontRecommends: DontRecommendType[] = []
          if (requestorId) {
            const dontRecommendsCount = await prisma.dontRecommend.count({
              where: {
                requestorId,
              },
            })
            dontRecommends = !dontRecommendsCount
              ? []
              : await prisma.dontRecommend.findMany({
                  where: {
                    requestorId,
                  },
                  take: dontRecommendsCount,
                })
          }

          // List of the profile ids in user's don't recommend list
          const dontRecommendsList = dontRecommends.map((drc) => drc.targetId)

          if (!cursor) {
            videos = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType: {
                      equals: "Video",
                    },
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                ],
                OR: [
                  {
                    primaryCategory: {
                      equals: category,
                    },
                  },
                  {
                    secondaryCategory: {
                      equals: category,
                    },
                  },
                ],
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
            })
          } else {
            videos = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType: {
                      equals: "Video",
                    },
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                ],
                OR: [
                  {
                    primaryCategory: {
                      equals: category,
                    },
                  },
                  {
                    secondaryCategory: {
                      equals: category,
                    },
                  },
                ],
              },
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip cursor
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
            })
          }

          if (videos.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = videos[videos.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType: {
                      equals: "Video",
                    },
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                ],
                OR: [
                  {
                    primaryCategory: {
                      equals: category,
                    },
                  },
                  {
                    secondaryCategory: {
                      equals: category,
                    },
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
            })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: videos.map((video) => ({
                cursor: video.id,
                node: video,
              })),
            }
          } else {
            // No more items to be fetched
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              edges: videos.map((video) => ({
                cursor: video.id,
                node: video,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("fetchSuggestedVideos", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchSuggestedPublishesInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          const { cursor, requestorId, publishId } = input

          // Get the publish
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
          })

          if (!publish)
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              edges: [],
            }

          // Search string for full text search
          const search = publish.tags
            ?.split(" | ")
            .map((tag) => tag.replaceAll(" ", "-"))
            .join(" | ")

          let videos: PublishType[] = []

          // Get dont recommended profiles
          let dontRecommends: DontRecommendType[] = []
          if (requestorId) {
            const dontRecommendsCount = await prisma.dontRecommend.count({
              where: {
                requestorId,
              },
            })
            dontRecommends = !dontRecommendsCount
              ? []
              : await prisma.dontRecommend.findMany({
                  where: {
                    requestorId,
                  },
                  take: dontRecommendsCount,
                })
          }

          // List of the profile ids in user's don't recommend list
          const dontRecommendsList = dontRecommends.map((drc) => drc.targetId)

          const requestor = !requestorId
            ? null
            : await prisma.profile.findUnique({
                where: {
                  id: requestorId,
                },
              })

          if (!cursor) {
            videos = search
              ? await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Video",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                      {
                        tags: {
                          search,
                        },
                      },
                    ],
                  },
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
              : await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Video",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                    ],
                    OR:
                      !requestor || requestor.watchPreferences.length === 0
                        ? undefined
                        : [
                            {
                              primaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                            {
                              secondaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                          ],
                  },
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
          } else {
            videos = search
              ? await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Video",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                      {
                        tags: {
                          search,
                        },
                      },
                    ],
                  },
                  cursor: {
                    id: cursor,
                  },
                  skip: 1, // Skip cursor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
              : await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Video",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                    ],
                    OR:
                      !requestor || requestor.watchPreferences.length === 0
                        ? undefined
                        : [
                            {
                              primaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                            {
                              secondaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                          ],
                  },
                  cursor: {
                    id: cursor,
                  },
                  skip: 1, // Skip cursor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
          }

          if (videos.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = videos[videos.length - 1].id

            // Check if there is next page
            const nextQuery = search
              ? await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Video",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                      {
                        tags: {
                          search,
                        },
                      },
                    ],
                  },
                  cursor: {
                    id: lastFetchedCursor,
                  },
                  skip: 1, // Skip the cusor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
              : await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Video",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                    ],
                    OR:
                      !requestor || requestor.watchPreferences.length === 0
                        ? undefined
                        : [
                            {
                              primaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                            {
                              secondaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                          ],
                  },
                  cursor: {
                    id: lastFetchedCursor,
                  },
                  skip: 1, // Skip the cusor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: videos.map((video) => ({
                cursor: video.id,
                node: video,
              })),
            }
          } else {
            // No more items to be fetched
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              edges: videos.map((video) => ({
                cursor: video.id,
                node: video,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Fetch public publishes uploaded by a profile
     */
    t.field("fetchProfilePublishes", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchPublishesByProfileInput") },
      resolve: async (_parent, { input }, { prisma }) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { cursor, publishType, creatorId, orderBy } = input

          // Query publises by creator id
          let publishes: PublishType[] = []

          if (!cursor) {
            // A. First query
            publishes = await prisma.publish.findMany({
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            in: ["software", "webcam"],
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                      ],
                    },
              take: FETCH_QTY,
              orderBy:
                orderBy === "popular"
                  ? [
                      {
                        views: "desc",
                      },
                      {
                        likes: {
                          _count: "desc",
                        },
                      },
                      {
                        createdAt: "desc",
                      },
                    ]
                  : {
                      createdAt: "desc",
                    },
            })
          } else {
            // B. Consecutive queries
            publishes = await prisma.publish.findMany({
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            in: ["software", "webcam"],
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                      ],
                    },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cusor
              orderBy:
                orderBy === "popular"
                  ? [
                      {
                        views: "desc",
                      },
                      {
                        likes: {
                          _count: "desc",
                        },
                      },
                      {
                        createdAt: "desc",
                      },
                    ]
                  : {
                      createdAt: "desc",
                    },
            })
          }

          // Get publishes count
          const count = await prisma.publish.count({
            where: {
              creatorId,
            },
          })

          if (publishes.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = publishes[publishes.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.publish.findMany({
              where:
                publishType === "videos"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "shorts"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Short",
                          },
                        },
                        {
                          broadcastType: {
                            equals: null,
                          },
                        },
                      ],
                    }
                  : publishType === "live"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Video",
                          },
                        },
                        {
                          broadcastType: {
                            in: ["software", "webcam"],
                          },
                        },
                      ],
                    }
                  : publishType === "blogs"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Blog",
                          },
                        },
                      ],
                    }
                  : publishType === "ads"
                  ? {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                        {
                          publishType: {
                            equals: "Ads",
                          },
                        },
                      ],
                    }
                  : {
                      AND: [
                        {
                          creatorId: {
                            equals: creatorId,
                          },
                        },
                        {
                          visibility: {
                            equals: "public",
                          },
                        },
                      ],
                    },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cusor
              orderBy:
                orderBy === "popular"
                  ? [
                      {
                        views: "desc",
                      },
                      {
                        likes: {
                          _count: "desc",
                        },
                      },
                      {
                        createdAt: "desc",
                      },
                    ]
                  : {
                      createdAt: "desc",
                    },
            })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
                count,
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
                count,
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

    /**
     * Get a short
     */
    t.field("getShort", {
      type: "Publish",
      args: { input: nonNull("QueryByIdInput") },
      resolve: async (_parent, { input }, { prisma }) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")

          const { targetId } = input
          if (!targetId) throwError(badInputErrMessage, "BAD_USER_INPUT")

          const publish = await prisma.publish.findUnique({
            where: {
              id: targetId,
            },
          })

          if (!publish) return null

          return publish
        } catch (error) {
          throw error
        }
      },
    })

    t.field("fetchSuggestedBlogs", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchSuggestedPublishesInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          const { cursor, requestorId, publishId } = input

          // Get the publish
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
          })

          if (!publish)
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              edges: [],
            }

          // Search string for full text search
          const search = publish.tags
            ?.split(" | ")
            .map((tag) => tag.replaceAll(" ", "-"))
            .join(" | ")

          let blogs: PublishType[] = []

          // Get dont recommended profiles
          let dontRecommends: DontRecommendType[] = []
          if (requestorId) {
            const dontRecommendsCount = await prisma.dontRecommend.count({
              where: {
                requestorId,
              },
            })
            dontRecommends = !dontRecommendsCount
              ? []
              : await prisma.dontRecommend.findMany({
                  where: {
                    requestorId,
                  },
                  take: dontRecommendsCount,
                })
          }

          // List of the profile ids in user's don't recommend list
          const dontRecommendsList = dontRecommends.map((drc) => drc.targetId)

          const requestor = !requestorId
            ? null
            : await prisma.profile.findUnique({
                where: {
                  id: requestorId,
                },
              })

          if (!cursor) {
            blogs = search
              ? await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Blog",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId, // Not recoommend the publish that the user is watching
                        },
                      },
                      {
                        tags: {
                          search,
                        },
                      },
                    ],
                  },
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
              : await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Blog",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId, // Not recoommend the publish that the user is watching
                        },
                      },
                    ],
                    OR:
                      !requestor || requestor.watchPreferences.length === 0
                        ? undefined
                        : [
                            {
                              primaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                            {
                              secondaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                          ],
                  },
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
          } else {
            blogs = search
              ? await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Blog",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId, // Not recoommend the publish that the user is watching
                        },
                      },
                      {
                        tags: {
                          search,
                        },
                      },
                    ],
                  },
                  cursor: {
                    id: cursor,
                  },
                  skip: 1, // Skip cursor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
              : await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Blog",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                    ],
                    OR:
                      !requestor || requestor.watchPreferences.length === 0
                        ? undefined
                        : [
                            {
                              primaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                            {
                              secondaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                          ],
                  },
                  cursor: {
                    id: cursor,
                  },
                  skip: 1, // Skip cursor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
          }

          if (blogs.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = blogs[blogs.length - 1].id

            // Check if there is next page
            const nextQuery = search
              ? await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Blog",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId, // Not recoommend the publish that the user is watching
                        },
                      },
                      {
                        tags: {
                          search,
                        },
                      },
                    ],
                  },
                  cursor: {
                    id: lastFetchedCursor,
                  },
                  skip: 1, // Skip the cusor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })
              : await prisma.publish.findMany({
                  where: {
                    AND: [
                      {
                        visibility: {
                          equals: "public",
                        },
                      },
                      {
                        publishType: {
                          equals: "Blog",
                        },
                      },
                      {
                        creatorId: {
                          notIn: dontRecommendsList,
                        },
                      },
                      {
                        id: {
                          not: publishId,
                        },
                      },
                    ],
                    OR:
                      !requestor || requestor.watchPreferences.length === 0
                        ? undefined
                        : [
                            {
                              primaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                            {
                              secondaryCategory: {
                                in: requestor.watchPreferences,
                              },
                            },
                          ],
                  },
                  cursor: {
                    id: lastFetchedCursor,
                  },
                  skip: 1, // Skip the cusor
                  take: FETCH_QTY,
                  orderBy: {
                    createdAt: "desc",
                  },
                })

            return {
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: blogs.map((blog) => ({
                cursor: blog.id,
                node: blog,
              })),
            }
          } else {
            // No more items to be fetched
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
              },
              edges: blogs.map((blog) => ({
                cursor: blog.id,
                node: blog,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("fetchPublishesByTag", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchPublishesByTagInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          const { cursor, requestorId, tag, publishType } = input
          const search = tag.trim().split(" ").join(" & ")

          let publishes: PublishType[] = []

          // Get dont recommended profiles
          let dontRecommends: DontRecommendType[] = []
          if (requestorId) {
            const dontRecommendsCount = await prisma.dontRecommend.count({
              where: {
                requestorId,
              },
            })
            dontRecommends = !dontRecommendsCount
              ? []
              : await prisma.dontRecommend.findMany({
                  where: {
                    requestorId,
                  },
                  take: dontRecommendsCount,
                })
          }

          // List of the profile ids in user's don't recommend list
          const dontRecommendsList = dontRecommends.map((drc) => drc.targetId)

          if (!cursor) {
            publishes = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType:
                      publishType === "videos"
                        ? {
                            equals: "Video",
                          }
                        : publishType === "shorts"
                        ? {
                            equals: "Short",
                          }
                        : publishType === "blogs"
                        ? {
                            equals: "Blog",
                          }
                        : undefined,
                  },
                  {
                    uploading: false,
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                  {
                    tags: {
                      search,
                    },
                  },
                ],
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
            })
          } else {
            publishes = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType:
                      publishType === "videos"
                        ? {
                            equals: "Video",
                          }
                        : publishType === "shorts"
                        ? {
                            equals: "Short",
                          }
                        : publishType === "blogs"
                        ? {
                            equals: "Blog",
                          }
                        : undefined,
                  },
                  {
                    uploading: false,
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                  {
                    tags: {
                      search,
                    },
                  },
                ],
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

          const count = await prisma.publish.count({
            where: {
              AND: [
                {
                  visibility: {
                    equals: "public",
                  },
                },
                {
                  publishType:
                    publishType === "videos"
                      ? {
                          equals: "Video",
                        }
                      : publishType === "shorts"
                      ? {
                          equals: "Short",
                        }
                      : publishType === "blogs"
                      ? {
                          equals: "Blog",
                        }
                      : undefined,
                },
                {
                  uploading: false,
                },
                {
                  creatorId: {
                    notIn: dontRecommendsList,
                  },
                },
                {
                  tags: {
                    search,
                  },
                },
              ],
            },
          })

          if (publishes.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = publishes[publishes.length - 1].id

            // Check if there is next page
            let nextQuery = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType:
                      publishType === "videos"
                        ? {
                            equals: "Video",
                          }
                        : publishType === "shorts"
                        ? {
                            equals: "Short",
                          }
                        : publishType === "blogs"
                        ? {
                            equals: "Blog",
                          }
                        : undefined,
                  },
                  {
                    uploading: false,
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                  {
                    tags: {
                      search,
                    },
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
            })

            return {
              pageInfo: {
                count,
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: publishes.map((pub) => ({
                cursor: pub.id,
                node: pub,
              })),
            }
          } else {
            return {
              pageInfo: {
                count,
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

    t.field("fetchPublishesByQueryString", {
      type: "FetchPublishesResponse",
      args: { input: nonNull("FetchPublishesByQueryStringInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          const { cursor, requestorId, query, publishType } = input

          let publishes: PublishType[] = []

          // Get dont recommended profiles
          let dontRecommends: DontRecommendType[] = []
          if (requestorId) {
            const dontRecommendsCount = await prisma.dontRecommend.count({
              where: {
                requestorId,
              },
            })
            dontRecommends = !dontRecommendsCount
              ? []
              : await prisma.dontRecommend.findMany({
                  where: {
                    requestorId,
                  },
                  take: dontRecommendsCount,
                })
          }

          // List of the profile ids in user's don't recommend list
          const dontRecommendsList = dontRecommends.map((drc) => drc.targetId)

          // Convert tag to catory
          const search = query.trim().split(" ").join(" & ")

          if (!cursor) {
            publishes = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType:
                      publishType === "videos"
                        ? {
                            equals: "Video",
                          }
                        : publishType === "shorts"
                        ? {
                            equals: "Short",
                          }
                        : publishType === "blogs"
                        ? {
                            equals: "Blog",
                          }
                        : undefined,
                  },
                  {
                    uploading: false,
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                  {
                    OR: [
                      {
                        tags: {
                          search,
                        },
                      },
                      {
                        title: {
                          search,
                        },
                      },
                      {
                        description: {
                          search,
                        },
                      },
                    ],
                  },
                ],
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
            })
          } else {
            publishes = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType:
                      publishType === "videos"
                        ? {
                            equals: "Video",
                          }
                        : publishType === "shorts"
                        ? {
                            equals: "Short",
                          }
                        : publishType === "blogs"
                        ? {
                            equals: "Blog",
                          }
                        : undefined,
                  },
                  {
                    uploading: false,
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                  {
                    OR: [
                      {
                        tags: {
                          search,
                        },
                      },
                      {
                        title: {
                          search,
                        },
                      },
                      {
                        description: {
                          search,
                        },
                      },
                    ],
                  },
                ],
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

          const count = await prisma.publish.count({
            where: {
              AND: [
                {
                  visibility: {
                    equals: "public",
                  },
                },
                {
                  publishType:
                    publishType === "videos"
                      ? {
                          equals: "Video",
                        }
                      : publishType === "shorts"
                      ? {
                          equals: "Short",
                        }
                      : publishType === "blogs"
                      ? {
                          equals: "Blog",
                        }
                      : undefined,
                },
                {
                  uploading: false,
                },
                {
                  creatorId: {
                    notIn: dontRecommendsList,
                  },
                },
                {
                  OR: [
                    {
                      tags: {
                        search,
                      },
                    },
                    {
                      title: {
                        search,
                      },
                    },
                    {
                      description: {
                        search,
                      },
                    },
                  ],
                },
              ],
            },
          })

          if (publishes.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = publishes[publishes.length - 1].id

            // Check if there is next page
            let nextQuery = await prisma.publish.findMany({
              where: {
                AND: [
                  {
                    visibility: {
                      equals: "public",
                    },
                  },
                  {
                    publishType:
                      publishType === "videos"
                        ? {
                            equals: "Video",
                          }
                        : publishType === "shorts"
                        ? {
                            equals: "Short",
                          }
                        : publishType === "blogs"
                        ? {
                            equals: "Blog",
                          }
                        : undefined,
                  },
                  {
                    uploading: false,
                  },
                  {
                    creatorId: {
                      notIn: dontRecommendsList,
                    },
                  },
                  {
                    OR: [
                      {
                        tags: {
                          search,
                        },
                      },
                      {
                        title: {
                          search,
                        },
                      },
                      {
                        description: {
                          search,
                        },
                      },
                    ],
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
            })

            return {
              pageInfo: {
                count,
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: publishes.map((pub) => ({
                cursor: pub.id,
                node: pub,
              })),
            }
          } else {
            return {
              pageInfo: {
                count,
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
  },
})

export const CreateDraftVideoInput = inputObjectType({
  name: "CreateDraftVideoInput",
  definition(t) {
    t.nonNull.string("creatorId") // Creator profile id
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("filename")
  },
})

export const CreateDraftVideoResult = objectType({
  name: "CreateDraftVideoResult",
  definition(t) {
    t.nonNull.string("id") // Publish id
    t.string("filename") // Uploaded file name
  },
})

export const CreateDraftBlogInput = inputObjectType({
  name: "CreateDraftBlogInput",
  definition(t) {
    t.nonNull.string("creatorId") // Creator profile id
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
  },
})

export const CreateDraftBlogResult = objectType({
  name: "CreateDraftBlogResult",
  definition(t) {
    t.nonNull.string("id") // Publish id
  },
})

export const UpdateVideoInput = inputObjectType({
  name: "UpdateVideoInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("creatorId")
    t.nonNull.string("publishId")
    t.string("contentURI")
    t.string("contentRef")
    t.string("thumbnail")
    t.string("thumbnailRef")
    t.nonNull.field("thumbnailType", { type: "ThumbnailType" })
    t.string("title")
    t.string("description")
    t.field("primaryCategory", { type: "Category" })
    t.field("secondaryCategory", { type: "Category" })
    t.string("tags")
    t.field("visibility", { type: "Visibility" })
    t.field("broadcastType", { type: "BroadcastType" }) // For live stream update
  },
})

export const UpdateBlogInput = inputObjectType({
  name: "UpdateBlogInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("creatorId")
    t.nonNull.string("publishId")
    t.string("title")
    t.string("imageUrl") // A url of the cover image
    t.string("imageRef") // A ref to storage of the cover image
    t.string("filename") // A filename of the cover image
    t.field("primaryCategory", { type: "Category" })
    t.field("secondaryCategory", { type: "Category" })
    t.string("tags")
    t.field("content", { type: "Json" })
    t.string("htmlContent") // A string used to display the content
    t.string("preview") // Use this string to calculate estimated reading time
    t.field("visibility", { type: "Visibility" })
  },
})

export const LikePublishInput = inputObjectType({
  name: "LikePublishInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
  },
})

export const DeletePublishInput = inputObjectType({
  name: "DeletePublishInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("creatorId")
    t.nonNull.string("publishId")
  },
})

export const DeletePublishesInput = inputObjectType({
  name: "DeletePublishesInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("creatorId")
    t.nonNull.list.nonNull.field("publishIds", { type: "String" })
  },
})

/**
 * A result for `calculateTips` mutation
 */
export const CalculateTipsResult = objectType({
  name: "CalculateTipsResult",
  definition(t) {
    t.nonNull.string("tips")
  },
})

/**
 * An input type for `sendTips` mutation
 */
export const SendTipsInput = inputObjectType({
  name: "SendTipsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId") // A publish id associated with the tips
    t.nonNull.string("receiverId") // A profile id of the receiver
    t.nonNull.int("qty") // An amount of usd to be sent
  },
})

/**
 * A result for `sendTips` mutation
 */
export const SendTipsResult = objectType({
  name: "SendTipsResult",
  definition(t) {
    t.nonNull.string("from") // From address
    t.nonNull.string("to") // To address
    t.nonNull.string("amount")
    t.nonNull.string("fee")
  },
})

export const PublishMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("createDraftVideo", {
      type: "CreateDraftVideoResult",
      args: { input: nonNull("CreateDraftVideoInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { creatorId, owner, accountId, filename } = input
          if (!creatorId || !owner || !accountId || !filename)
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

          // Create a draft publish
          const draft = await prisma.publish.create({
            data: {
              creatorId,
              title: filename,
              filename,
              // Not specify publish type at this point, it will be set once the transcoding finished in the webhooks route.
              uploading: true, // Set uploading to true because file upload will be started right after the draft is created.
            },
          })

          // Publish a message to pub/sub
          await publishMessage(PUBLISH_PROCESSING_TOPIC!, draft.id)

          return { id: draft.id, filename }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("createDraftBlog", {
      type: "CreateDraftBlogResult",
      args: { input: nonNull("CreateDraftBlogInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { creatorId, owner, accountId } = input
          if (!creatorId || !owner || !accountId)
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

          // Create a draft publish
          const draft = await prisma.publish.create({
            data: {
              creatorId,
              publishType: "Blog",
              thumbnailType: "custom",
            },
          })

          // Publish a message to pub/sub
          await publishMessage(PUBLISH_PROCESSING_TOPIC!, draft.id)

          return { id: draft.id }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("updateVideo", {
      type: "Publish",
      args: { input: nonNull("UpdateVideoInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const {
            owner,
            accountId,
            creatorId,
            publishId,
            contentURI,
            contentRef,
            thumbnail,
            thumbnailRef,
            thumbnailType,
            title,
            description,
            primaryCategory,
            secondaryCategory,
            tags,
            visibility,
            broadcastType,
          } = input

          if (!owner || !accountId || !creatorId || !publishId)
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
          if (publish?.creatorId !== creatorId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          if (broadcastType && publish?.streamType !== "Live")
            throwError(badInputErrMessage, "BAD_REQUEST")

          // Update publish
          await prisma.publish.update({
            where: {
              id: publishId,
            },
            data: {
              contentURI,
              contentRef,
              thumbnail,
              thumbnailRef,
              thumbnailType,
              title,
              description,
              primaryCategory,
              secondaryCategory,
              tags,
              // publishType:
              //   publish?.playback?.duration && publish?.playback?.duration <= 60
              //     ? "Short"
              //     : "Video",
              visibility: visibility || "private",
              broadcastType: broadcastType || publish?.broadcastType,
              updatedAt: new Date(),
            },
          })

          // Publish a message to pub/sub
          await publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)

          return publish
        } catch (error) {
          throw error
        }
      },
    })

    t.field("updateBlog", {
      type: "WriteResult",
      args: { input: nonNull("UpdateBlogInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const {
            creatorId,
            owner,
            accountId,
            imageUrl,
            imageRef,
            filename,
            primaryCategory,
            secondaryCategory,
            visibility,
            title,
            tags,
            content,
            htmlContent,
            preview,
            publishId,
          } = input
          if (!creatorId || !owner || !accountId || !publishId)
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

          // Find the publish
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
            include: {
              creator: true,
            },
          })
          if (!publish || publish.publishType !== "Blog")
            throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the publish
          if (publish?.creatorId !== creatorId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the blog
          const blog = await prisma.blog.findUnique({
            where: {
              publishId,
            },
          })

          const readingTime = preview
            ? `${calucateReadingTime(preview)} min read`
            : null
          const excerpt = preview ? getPostExcerpt(preview) : null
          if (!blog) {
            // If no blog found, create a new blog
            // If it's a published blog, all required data must be completed
            if (visibility === "public") {
              if ((!title && !publish?.title) || !content || !htmlContent)
                throwError(badRequestErrMessage, "BAD_REQUEST")
            }
            await prisma.blog.create({
              data: {
                publishId,
                content: content || {},
                readingTime,
                excerpt,
                htmlContent,
              },
            })
          } else {
            // Update the blog
            // If it's a published blog, all required data must be completed
            if (visibility === "public") {
              if (
                (!title && !publish?.title) ||
                (!htmlContent && !blog.htmlContent) ||
                (!content && !blog.content)
              )
                throwError(badRequestErrMessage, "BAD_REQUEST")
            }
            if (content || htmlContent || preview) {
              await prisma.blog.update({
                where: {
                  publishId,
                },
                data: {
                  content,
                  readingTime,
                  excerpt,
                  htmlContent,
                },
              })
            }
          }
          // Update the publish
          if (
            title ||
            imageUrl ||
            imageRef ||
            filename ||
            primaryCategory ||
            secondaryCategory ||
            tags ||
            visibility
          ) {
            await prisma.publish.update({
              where: {
                id: publishId,
              },
              data: {
                title: title || publish?.title,
                thumbnail: imageUrl ?? publish?.thumbnail,
                thumbnailRef: imageRef ?? publish?.thumbnailRef,
                filename: filename ?? publish?.filename,
                tags: tags || publish?.tags,
                visibility: visibility || publish?.visibility,
                primaryCategory: primaryCategory || publish?.primaryCategory,
                secondaryCategory:
                  secondaryCategory || publish?.secondaryCategory,
              },
            })
          }

          // Publish a message to pub/sub
          await publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("likePublish", {
      type: "WriteResult",
      args: { input: nonNull("LikePublishInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
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

          // Check if the given publish exists
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
          })
          if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

          // Create or delete a like depending to the case
          const like = await prisma.like.findUnique({
            where: {
              identifier: {
                profileId,
                publishId,
              },
            },
          })

          if (!like) {
            // Like case
            await prisma.like.create({
              data: {
                profileId,
                publishId,
              },
            })

            // Check if user disliked the publish before, if yes, delete the dislike.
            const dislike = await prisma.disLike.findUnique({
              where: {
                identifier: {
                  profileId,
                  publishId,
                },
              },
            })

            if (dislike) {
              await prisma.disLike.delete({
                where: {
                  identifier: {
                    profileId,
                    publishId,
                  },
                },
              })
            }

            // Create a notification
            await prisma.notification.create({
              data: {
                profileId,
                receiverId: publish?.creatorId!,
                type: "LIKE",
                content: createLikePublishNotiContent(
                  profile?.name!,
                  publish?.title!,
                  publish?.publishType!
                ),
              },
            })

            // Publish a message to the notification topic pub/sub
            await publishMessage(NEW_NOTIFICATION_TOPIC!, publish?.creatorId!)

            // Publish a message to the publish processing topic pub/sub
            await publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)
          } else {
            // Undo Like case
            await prisma.like.delete({
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

    t.field("disLikePublish", {
      type: "WriteResult",
      args: { input: nonNull("LikePublishInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
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

          // Check if the given publish exists
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
          })
          if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

          // Create or delete a disLike depending to the case
          const disLike = await prisma.disLike.findUnique({
            where: {
              identifier: {
                profileId,
                publishId,
              },
            },
          })

          if (!disLike) {
            // disLike case
            await prisma.disLike.create({
              data: {
                profileId,
                publishId,
              },
            })

            // We also need to check if user liked the publish before, if yes, we need to delete that like before.
            const like = await prisma.like.findUnique({
              where: {
                identifier: {
                  profileId,
                  publishId,
                },
              },
            })

            if (like) {
              await prisma.like.delete({
                where: {
                  identifier: {
                    profileId,
                    publishId,
                  },
                },
              })
            }
          } else {
            // Undo disLike case
            await prisma.disLike.delete({
              where: {
                identifier: {
                  profileId,
                  publishId,
                },
              },
            })
          }

          // TODO: Inform the UIs

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Count view
     */
    t.field("countViews", {
      type: "WriteResult",
      args: { publishId: nonNull(stringArg()) },
      resolve: async (_parent, { publishId }, { prisma }) => {
        try {
          if (!publishId) throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Find the publish
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
          })
          if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

          await prisma.publish.update({
            where: {
              id: publishId,
            },
            data: {
              views: (publish?.views || 0) + 1,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Delete a publish
     */
    t.field("deletePublish", {
      type: "WriteResult",
      args: { input: nonNull("DeletePublishInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, creatorId, publishId } = input
          if (!owner || !accountId || !creatorId || !publishId)
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

          // Check if the given publish exists
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
            include: {
              playback: true,
            },
          })
          if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the publish
          if (publish?.creatorId !== creatorId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          if (
            publish?.publishType === "Video" ||
            publish?.publishType === "Short"
          ) {
            // For video
            // It might take a long time to delete the video files so we update the status in the database first.
            // Update the publish status in the database to `deleting`
            await prisma.publish.update({
              where: {
                id: publishId,
              },
              data: {
                deleting: true,
              },
            })

            // Call the Upload Service to delete the publish's files without waiting.
            dataSources.uploadAPI.deleteVideo(
              `publishes/${creator?.name}/${publishId}/`,
              publishId
            )

            // Delete the transcoded video on Cloudflare without waiting
            dataSources.cloudflareAPI.deleteVideo(publish.playback?.videoId)

            // Publish a message to processing topic to pubsub.
            await publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)
          } else if (publish?.publishType === "Blog") {
            // For blog
            // It should just seconds to delete the cover image, so we can immediately delete the publish in the database.
            if (publish.thumbnailRef) {
              dataSources.uploadAPI.deleteImage(publish.thumbnailRef)
            }

            await prisma.publish.delete({
              where: {
                id: publishId,
              },
            })
          } else {
            if (!publish) return null

            // Immediately delete the publish
            await prisma.publish.delete({
              where: {
                id: publishId,
              },
            })

            if (publish.contentRef) {
              // Call the Upload Service to delete the publish's files without waiting.
              dataSources.uploadAPI.deleteVideo(
                `publishes/${creator?.name}/${publishId}/`,
                publishId
              )
            }

            if (publish.playback?.videoId) {
              // Delete the transcoded video on Cloudflare without waiting
              dataSources.cloudflareAPI.deleteVideo(publish.playback?.videoId)
            }
          }

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Delete many publishes
     */
    t.field("deletePublishes", {
      type: "WriteResult",
      args: { input: nonNull("DeletePublishesInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, creatorId, publishIds } = input
          if (
            !owner ||
            !accountId ||
            !creatorId ||
            !publishIds ||
            publishIds.length === 0
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

          const deletePromises = publishIds.map(async (publishId) => {
            // Check if the given publish exists
            const publish = await prisma.publish.findUnique({
              where: {
                id: publishId,
              },
              include: {
                playback: true,
              },
            })
            if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

            // Check ownership of the publish
            if (publish?.creatorId !== creatorId)
              throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

            if (
              publish?.publishType === "Video" ||
              publish?.publishType === "Short"
            ) {
              // For video
              // It might take a long time to delete the video files so we update the status in the database first.
              // Update the publish status in the database to `deleting`
              await prisma.publish.update({
                where: {
                  id: publishId,
                },
                data: {
                  deleting: true,
                },
              })

              // Call the Upload Service to delete the publish's files without waiting.
              dataSources.uploadAPI.deleteVideo(
                `publishes/${creator?.name}/${publishId}/`,
                publishId
              )

              // Delete the transcoded video on Cloudflare without waiting
              dataSources.cloudflareAPI.deleteVideo(publish.playback?.videoId)

              // Publish a message to processing topic to pubsub.
              return publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)
            } else if (publish?.publishType === "Blog") {
              // For blog
              // It should just seconds to delete the cover image, so we can immediately delete the publish in the database.
              if (publish.thumbnailRef) {
                dataSources.uploadAPI.deleteImage(publish.thumbnailRef)
              }

              return prisma.publish.delete({
                where: {
                  id: publishId,
                },
              })
            } else {
              if (!publish) return null

              // Immediately delete the publish
              await prisma.publish.delete({
                where: {
                  id: publishId,
                },
              })

              if (publish.contentRef) {
                // Call the Upload Service to delete the publish's files without waiting.
                dataSources.uploadAPI.deleteVideo(
                  `publishes/${creator?.name}/${publishId}/`,
                  publishId
                )
              }

              if (publish.playback?.videoId) {
                // Delete the transcoded video on Cloudflare without waiting
                dataSources.cloudflareAPI.deleteVideo(publish.playback?.videoId)
              }
            }
          })

          await Promise.allSettled(deletePromises)

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("calculateTips", {
      type: "CalculateTipsResult",
      args: { qty: nonNull("Int") },
      resolve: async (_parent, { qty }, { dataSources }) => {
        try {
          const result = await dataSources.walletAPI.calculateTips(qty)

          return result
        } catch (error) {
          throw error
        }
      },
    })

    // For `TRADITIONAL` accounts only
    t.field("sendTips", {
      type: "SendTipsResult",
      args: { input: nonNull("SendTipsInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, receiverId, publishId, qty } =
            input
          if (
            !owner ||
            !accountId ||
            !profileId ||
            !receiverId ||
            !publishId ||
            !qty
          )
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization of the sender
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Get the sender profile
          const sender = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!sender) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the sender
          if (account?.owner?.toLowerCase() !== sender?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Get the receiver profile
          const receiver = await prisma.profile.findUnique({
            where: {
              id: receiverId,
            },
          })
          if (!receiver) throw new Error("Receiver not found")

          const { result } = await dataSources.walletAPI.sendTips(
            receiver.owner,
            qty
          )
          const { from, to, amount, fee } = result

          // Create a tip in the database
          await prisma.tip.create({
            data: {
              senderId: profileId,
              from: from.toLowerCase(),
              publishId,
              receiverId,
              to: to.toLowerCase(),
              amount,
              fee,
            },
          })

          return result
        } catch (error) {
          throw error
        }
      },
    })
  },
})
