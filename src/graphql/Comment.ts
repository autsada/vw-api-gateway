import {
  objectType,
  enumType,
  extendType,
  nonNull,
  inputObjectType,
} from "nexus"
import {
  Comment as CommentModel,
  CommentType as CommentTypeEnum,
  CommentLike as CommentLikeModel,
  CommentDisLike as CommentDisLikeModel,
} from "nexus-prisma"
import { Comment as CommentDataType } from "@prisma/client"

import {
  throwError,
  badInputErrMessage,
  notFoundErrMessage,
  unauthorizedErrMessage,
} from "./Error"
import {
  countWords,
  validateAuthenticity,
  createLikeCommentNotiContent,
  createCommentNotiContent,
} from "../lib"
import { FETCH_QTY } from "../lib/constants"
import { publishMessage } from "../listensers/pubsub"
import type { NexusGenInputs } from "../typegen"

const { PUBLISH_PROCESSING_TOPIC, NEW_NOTIFICATION_TOPIC } = process.env

export const CommentType = enumType(CommentTypeEnum)

export const CommentLike = objectType({
  name: CommentLikeModel.$name,
  definition(t) {
    t.field(CommentLikeModel.commentId)
    t.field(CommentLikeModel.comment)
    t.field(CommentLikeModel.profileId)
    t.field(CommentLikeModel.profile)
  },
})

export const CommentDisLike = objectType({
  name: CommentDisLikeModel.$name,
  definition(t) {
    t.field(CommentDisLikeModel.commentId)
    t.field(CommentDisLikeModel.comment)
    t.field(CommentDisLikeModel.profileId)
    t.field(CommentDisLikeModel.profile)
  },
})

/**
 * A type for publish's comments.
 */
export const Comment = objectType({
  name: CommentModel.$name,
  definition(t) {
    t.field(CommentModel.id)
    t.field(CommentModel.createdAt)
    t.field(CommentModel.updatedAt)
    t.field(CommentModel.creator)
    t.field(CommentModel.creatorId)
    t.field(CommentModel.publishId)
    t.field(CommentModel.publish)
    t.field(CommentModel.commentId)
    t.field(CommentModel.comment)
    t.field(CommentModel.commentType)
    t.field(CommentModel.content)
    t.field(CommentModel.comments)
    t.field(CommentModel.likes)
    t.field(CommentModel.disLikes)
    t.field(CommentModel.contentBlog)
    t.field(CommentModel.htmlContentBlog)

    /**
     * Number of likes a comment has
     */
    t.nonNull.field("likesCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.commentLike.count({
          where: {
            commentId: parent.id,
          },
        })
      },
    })

    /**
     * A boolean to check whether a station (who sends the query) liked the comment or not, if no `requestorId` provided resolve to null.
     */
    t.nullable.field("liked", {
      type: "Boolean",
      resolve: async (parent, _, { prisma }, info) => {
        const { input } = info.variableValues as {
          input: NexusGenInputs["QueryByIdInput"]
        }

        if (!input || !input.requestorId) return null
        const { requestorId } = input

        const like = await prisma.commentLike.findUnique({
          where: {
            identifier: {
              commentId: parent.id,
              profileId: requestorId,
            },
          },
        })

        return !!like
      },
    })

    /**
     * Number of dislikes a comment has
     */
    t.nonNull.field("disLikesCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.commentDisLike.count({
          where: {
            commentId: parent.id,
          },
        })
      },
    })

    /**
     * A boolean to check whether a station (who sends the query) disliked the comment or not, if no `requestorId` provided resolve to null.
     */
    t.nullable.field("disLiked", {
      type: "Boolean",
      resolve: async (parent, _, { prisma }, info) => {
        const { input } = info.variableValues as {
          input: NexusGenInputs["QueryByIdInput"]
        }

        if (!input || !input.requestorId) return null
        const { requestorId } = input

        const disLike = await prisma.commentDisLike.findUnique({
          where: {
            identifier: {
              commentId: parent.id,
              profileId: requestorId,
            },
          },
        })

        return !!disLike
      },
    })

    /**
     * Number of comments a comment has.
     */
    t.nonNull.field("commentsCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.comment.count({
          where: {
            commentId: parent.id,
          },
        })
      },
    })
  },
})

export const CommentsOrderBy = enumType({
  name: "CommentsOrderBy",
  members: ["counts", "newest"],
})

export const FetchCommentsByPublishIdInput = inputObjectType({
  name: "FetchCommentsByPublishIdInput",
  definition(t) {
    t.string("requestorId") // A profile id of the requestor
    t.nonNull.string("publishId")
    t.string("cursor")
    t.field("orderBy", { type: "CommentsOrderBy" })
  },
})

export const FetchSubCommentsInput = inputObjectType({
  name: "FetchSubCommentsInput",
  definition(t) {
    t.string("requestorId") // A profile id of the requestor
    t.nonNull.string("commentId") // The parent comment id
    t.string("cursor")
  },
})

export const CommentEdge = objectType({
  name: "CommentEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "Comment",
    })
  },
})

export const FetchCommentsResponse = objectType({
  name: "FetchCommentsResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "CommentEdge" })
  },
})

export const CommentQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Fetch comments by publish id.
     */
    t.field("fetchCommentsByPublishId", {
      type: "FetchCommentsResponse",
      args: { input: nonNull("FetchCommentsByPublishIdInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { cursor, publishId, orderBy } = input
          if (!publishId) throwError(badInputErrMessage, "BAD_USER_INPUT")

          let comments: CommentDataType[] = []

          if (!cursor) {
            comments = await prisma.comment.findMany({
              where: {
                AND: [
                  {
                    publishId,
                  },
                  {
                    commentType: "PUBLISH",
                  },
                ],
              },
              take: FETCH_QTY,
              orderBy:
                orderBy === "newest"
                  ? {
                      createdAt: "desc",
                    }
                  : [
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
          } else {
            comments = await prisma.comment.findMany({
              where: {
                AND: [
                  {
                    publishId,
                  },
                  {
                    commentType: "PUBLISH",
                  },
                ],
              },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip the cursor
              orderBy:
                orderBy === "newest"
                  ? {
                      createdAt: "desc",
                    }
                  : [
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
          }

          // Get comments count
          const count = await prisma.comment.count({
            where: {
              AND: [
                {
                  publishId,
                },
                {
                  commentType: "PUBLISH",
                },
              ],
            },
          })

          if (comments.length < FETCH_QTY) {
            return {
              pageInfo: {
                count,
                endCursor: null,
                hasNextPage: false,
              },
              edges: comments.map((comment) => ({
                cursor: comment.id,
                node: comment,
              })),
            }
          } else {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = comments[comments.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.comment.findMany({
              where: {
                AND: [
                  {
                    publishId,
                  },
                  {
                    commentType: "PUBLISH",
                  },
                ],
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cursor
              orderBy:
                orderBy === "newest"
                  ? {
                      createdAt: "desc",
                    }
                  : [
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

            return {
              pageInfo: {
                count,
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
              },
              edges: comments.map((comment) => ({
                cursor: comment.id,
                node: comment,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Fetch sub-comments
     */
    t.field("fetchSubComments", {
      type: "FetchCommentsResponse",
      args: { input: nonNull("FetchSubCommentsInput") },
      resolve: async (_parent, { input }, { prisma }) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { commentId, cursor } = input

          if (!commentId) throwError(badInputErrMessage, "BAD_USER_INPUT")

          let comments: CommentDataType[] = []

          if (!cursor) {
            comments = await prisma.comment.findMany({
              where: {
                AND: [
                  {
                    commentId,
                  },
                  {
                    commentType: "COMMENT",
                  },
                ],
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: "desc",
              },
            })
          } else {
            comments = await prisma.comment.findMany({
              where: {
                AND: [
                  {
                    commentId,
                  },
                  {
                    commentType: "COMMENT",
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

          // Get comments count
          const count = await prisma.comment.count({
            where: {
              AND: [
                {
                  commentId,
                },
                {
                  commentType: "COMMENT",
                },
              ],
            },
          })

          if (comments.length < FETCH_QTY) {
            return {
              pageInfo: {
                count,
                endCursor: null,
                hasNextPage: false,
              },
              edges: comments.map((comment) => ({
                cursor: comment.id,
                node: comment,
              })),
            }
          } else {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = comments[comments.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.comment.findMany({
              where: {
                AND: [
                  {
                    commentId,
                  },
                  {
                    commentType: "COMMENT",
                  },
                ],
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip the cursor
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
              edges: comments.map((comment) => ({
                cursor: comment.id,
                node: comment,
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

export const CommentPublishInput = inputObjectType({
  name: "CommentPublishInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
    t.nonNull.field("commentType", { type: "CommentType" })
    t.string("commentId")
    t.string("content") // For comment on a video
    t.field("contentBlog", { type: "Json" }) // For comment on a blog
    t.string("htmlContentBlog") // For comment on a blog
  },
})

export const LikeCommentInput = inputObjectType({
  name: "LikeCommentInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
    t.nonNull.string("commentId")
  },
})

export const DeleteCommentInput = inputObjectType({
  name: "DeleteCommentInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("commentId")
  },
})

export const CommentMutation = extendType({
  type: "Mutation",
  definition(t) {
    /**
     * Comment on a comment
     */
    t.field("comment", {
      type: "WriteResult",
      args: { input: nonNull("CommentPublishInput") },
      resolve: async (
        parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const {
            owner,
            accountId,
            profileId,
            publishId,
            commentId,
            commentType,
            content,
            contentBlog,
            htmlContentBlog,
          } = input
          if (!owner || !accountId || !profileId || !publishId || !commentType)
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
          const publish = await prisma.publish.findUnique({
            where: {
              id: publishId,
            },
          })
          if (!publish) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check if the publish is a video or a blog
          if (publish?.publishType === "Blog") {
            // Comment on a blog or a blog's comment
            if (!contentBlog || !htmlContentBlog)
              throwError(badInputErrMessage, "BAD_USER_INPUT")

            // Create a comment
            // Count words to check its length
            const wordsLen = countWords(htmlContentBlog!)
            if (wordsLen > 5000) throw new Error("Comment is too long.")
            await prisma.comment.create({
              data: {
                creatorId: profileId,
                publishId,
                commentId,
                commentType,
                contentBlog,
                htmlContentBlog,
              },
            })
          } else {
            // Comment on a video or a video's comment
            if (!content) throwError(badInputErrMessage, "BAD_USER_INPUT")

            // Create a comment
            await prisma.comment.create({
              data: {
                creatorId: profileId,
                publishId,
                commentId,
                commentType,
                content,
              },
            })
          }

          // Create a notification
          await prisma.notification.create({
            data: {
              profileId,
              receiverId: publish?.creatorId!,
              type: "COMMENT",
              content: createCommentNotiContent(
                profile?.name!,
                publish?.title!,
                publish?.publishType!
              ),
            },
          })

          // Publish a message to notification pub/sub
          await publishMessage(NEW_NOTIFICATION_TOPIC!, publish?.creatorId!)

          // Publish a message to publish processing topic pub/sub
          await publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("likeComment", {
      type: "WriteResult",
      args: { input: nonNull("LikeCommentInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, publishId, commentId } = input
          if (!owner || !accountId || !profileId || !publishId || !commentId)
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

          // Check if the comment exists
          const comment = await prisma.comment.findUnique({
            where: {
              id: commentId,
            },
          })
          if (!comment) throwError(notFoundErrMessage, "NOT_FOUND")

          // Create or delete a like depending to the case
          const like = await prisma.commentLike.findUnique({
            where: {
              identifier: {
                profileId,
                commentId,
              },
            },
          })
          if (!like) {
            // Like case
            await prisma.commentLike.create({
              data: {
                profileId,
                commentId,
              },
            })

            // Check if user disliked the comment before, if yes, delete the dislike.
            const dislike = await prisma.commentDisLike.findUnique({
              where: {
                identifier: {
                  profileId,
                  commentId,
                },
              },
            })
            if (dislike) {
              await prisma.commentDisLike.delete({
                where: {
                  identifier: {
                    profileId,
                    commentId,
                  },
                },
              })
            }

            // Create a notification
            await prisma.notification.create({
              data: {
                profileId,
                receiverId: comment?.creatorId!,
                type: "LIKE",
                content: createLikeCommentNotiContent(profile?.name!),
              },
            })

            // Publish a message to pub/sub
            await publishMessage(NEW_NOTIFICATION_TOPIC!, comment?.creatorId!)
          } else {
            // Undo Like case
            await prisma.commentLike.delete({
              where: {
                identifier: {
                  profileId,
                  commentId,
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

    t.field("disLikeComment", {
      type: "WriteResult",
      args: { input: nonNull("LikeCommentInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, publishId, commentId } = input
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

          // Check if the comment exists
          const comment = await prisma.comment.findUnique({
            where: {
              id: commentId,
            },
          })
          if (!comment) throwError(notFoundErrMessage, "NOT_FOUND")

          // Create or delete a disLike depending to the case
          const disLike = await prisma.commentDisLike.findUnique({
            where: {
              identifier: {
                profileId,
                commentId,
              },
            },
          })
          if (!disLike) {
            // disLike case
            await prisma.commentDisLike.create({
              data: {
                profileId,
                commentId,
              },
            })

            // We also need to check if user liked the comment before, if yes, we need to delete that like before.
            const like = await prisma.commentLike.findUnique({
              where: {
                identifier: {
                  profileId,
                  commentId,
                },
              },
            })
            if (like) {
              await prisma.commentLike.delete({
                where: {
                  identifier: {
                    profileId,
                    commentId,
                  },
                },
              })
            }
          } else {
            // Undo disLike case
            await prisma.commentDisLike.delete({
              where: {
                identifier: {
                  profileId,
                  commentId,
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

    t.field("deleteComment", {
      type: "WriteResult",
      args: { input: nonNull("DeleteCommentInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, commentId } = input
          if (!owner || !accountId || !profileId || !commentId)
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

          // Check if the given comment exists
          const comment = await prisma.comment.findUnique({
            where: {
              id: commentId,
            },
          })
          if (!comment) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the comment
          if (profileId !== comment?.creatorId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Delete the comment
          await prisma.comment.delete({
            where: {
              id: commentId,
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
