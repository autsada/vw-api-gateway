import { objectType, inputObjectType, extendType, nonNull } from "nexus"
import { Profile as ProfileModel, Follow as FollowModel } from "nexus-prisma"

import { NexusGenInputs } from "../typegen"
import {
  throwError,
  badInputErrMessage,
  unauthorizedErrMessage,
  notFoundErrMessage,
} from "./Error"
import { generateColor, validateAuthenticity } from "../lib"

export const Follow = objectType({
  name: FollowModel.$name,
  definition(t) {
    t.field(FollowModel.followerId)
    t.field(FollowModel.follower)
    t.field(FollowModel.followingId)
    t.field(FollowModel.following)
  },
})

/**
 * A Profile type that map to the prisma Profile model.
 */
export const Profile = objectType({
  name: ProfileModel.$name,
  definition(t) {
    t.field(ProfileModel.id)
    t.nonNull.field("createdAt", { type: "DateTime" })
    t.field("updatedAt", { type: "DateTime" })
    t.field(ProfileModel.owner)
    t.field(ProfileModel.name)
    t.field(ProfileModel.displayName)
    t.field(ProfileModel.image)
    t.field(ProfileModel.imageRef)
    t.field(ProfileModel.bannerImage)
    t.field(ProfileModel.bannerImageRef)
    t.field(ProfileModel.defaultColor)
    t.field(ProfileModel.accountId)
    t.field(ProfileModel.account)
    t.field(ProfileModel.watchPreferences)
    t.field(ProfileModel.readPreferences)
    t.field(ProfileModel.watchLater)
    t.field(ProfileModel.playlists)

    t.nonNull.field("followersCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.follow.count({
          where: {
            followerId: parent.id,
          },
        })
      },
    })
    t.nonNull.field("followingCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.follow.count({
          where: {
            followingId: parent.id,
          },
        })
      },
    })

    /**
     * A boolean to check whether a profile (who makes the query) is following the queried profile or not, if no `userId` provided resolve to null.
     */
    t.nullable.field("isFollowing", {
      type: "Boolean",
      resolve: async (parent, _, { prisma }, info) => {
        const { input } = info.variableValues as {
          input: NexusGenInputs["QueryByIdInput"]
        }

        if (!input || !input.requestorId) return null
        const { requestorId } = input

        const following = await prisma.follow.findUnique({
          where: {
            followerId_followingId: {
              followerId: parent.id,
              followingId: requestorId,
            },
          },
        })

        return !!following
      },
    })

    /**
     * Query first 30 publishes of the profile
     */
    t.field({
      ...ProfileModel.publishes,
      async resolve(parent, _, { prisma }) {
        return prisma.publish.findMany({
          where: {
            creatorId: parent.id,
          },
          take: 30,
        })
      },
    })

    /**
     * Profile's publishes count.
     */
    t.nonNull.field("publishesCount", {
      type: "Int",
      resolve: (parent, _, { prisma }) => {
        return prisma.publish.count({
          where: {
            creatorId: parent.id,
          },
        })
      },
    })

    /**
     * A boolean to indicate of the querying user is the owner of the profile or not
     */
    t.nullable.field("isOwner", {
      type: "Boolean",
      resolve: async (parent, _, { prisma }, info) => {
        const { input } = info.variableValues as {
          input: NexusGenInputs["QueryByIdInput"]
        }

        if (!input || !input.requestorId) return null
        const { requestorId } = input
        const owner = parent.owner.toLowerCase()

        // Get the requestor profile
        const requestor = await prisma.profile.findUnique({
          where: {
            id: requestorId,
          },
        })

        return owner === requestor?.owner?.toLowerCase()
      },
    })
  },
})

/**
 * An input type for `getProfileById` query.
 */
export const QueryByIdInput = inputObjectType({
  name: "QueryByIdInput",
  definition(t) {
    // An id of the requestor profile.
    t.nullable.string("requestorId")
    // An id of the.
    t.nonNull.string("targetId")
  },
})

/**
 * An input type for `getProfileByName` query.
 */
export const QueryByNameInput = inputObjectType({
  name: "QueryByNameInput",
  definition(t) {
    // A name of the target profile.
    t.nonNull.string("name")
    // An id of the requestor profile.
    t.nullable.string("requestorId")
  },
})

export const ProfileQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Query a profile by id
     */
    t.field("getProfileById", {
      type: "Profile",
      args: { input: nonNull("QueryByIdInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { targetId } = input

          if (!targetId) throwError(badInputErrMessage, "BAD_USER_INPUT")

          return prisma.profile.findUnique({
            where: { id: targetId },
          })
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Query a profile by name
     */
    t.field("getProfileByName", {
      type: "Profile",
      args: { input: nonNull("QueryByNameInput") },
      async resolve(_parent, { input }, { prisma }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { name } = input

          if (!name) throwError(badInputErrMessage, "BAD_USER_INPUT")

          return prisma.profile.findUnique({
            where: { name },
          })
        } catch (error) {
          return null
        }
      },
    })
  },
})

/**
 * An input type for `createProfile` mutation.
 */
export const CreateProfileInput = inputObjectType({
  name: "CreateProfileInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("name")
  },
})

/**
 * An input type for `updateName` mutation.
 */
export const UpdateNameInput = inputObjectType({
  name: "UpdateNameInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("newName")
  },
})

/**
 * An input type for `updateProfileImage` mutation.
 */
export const UpdateImageInput = inputObjectType({
  name: "UpdateImageInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("image")
    t.nonNull.string("imageRef")
  },
})

/**
 * An input type for follow/unFollow mutation.
 */
export const FollowInput = inputObjectType({
  name: "FollowInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("followerId")
  },
})

/**
 * An input type to update preferences mutation.
 */
export const UpdatePreferencesInput = inputObjectType({
  name: "UpdatePreferencesInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.list.nonNull.field("preferences", { type: "Category" })
  },
})

export const ProfileMutation = extendType({
  type: "Mutation",
  definition(t) {
    /**
     * @dev Validate name length and uniqueness
     * @param name {string}
     */
    t.field("validateName", {
      type: "Boolean",
      args: { name: nonNull("String") },
      async resolve(_root, { name }, { prisma }) {
        try {
          // Validate input.
          if (!name) throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Check if the name is unique
          const exist = await prisma.profile.findUnique({
            where: {
              name: name.toLowerCase(),
            },
          })

          return !exist
        } catch (error) {
          // DON'T throw, return false instead
          return false
        }
      },
    })

    t.field("createProfile", {
      type: "Profile",
      args: { input: nonNull("CreateProfileInput") },
      resolve: async (
        _parent,
        { input },
        { prisma, dataSources, signature }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, name } = input
          if (!owner || !accountId || !name)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          const ownerAddress = owner.toLowerCase()

          // Validate authentication/authorization
          await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })

          // Check if the name was taken
          const exist = await prisma.profile.findUnique({
            where: {
              name: name.toLowerCase(), // Make sure to lowercase name
            },
          })
          if (exist) throw new Error("This name was taken.")

          // Create a new profile
          return prisma.profile.create({
            data: {
              owner: ownerAddress,
              name: name.toLowerCase(), // Make sure to lowercase name
              displayName: name,
              accountId,
              defaultColor: generateColor(),
            },
          })
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * @dev Update name
     */
    t.field("updateName", {
      type: "WriteResult",
      args: { input: nonNull("UpdateNameInput") },
      async resolve(_root, { input }, { dataSources, prisma, signature }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, newName } = input
          if (!owner || !accountId || !profileId || !newName)
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

          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the to-be-updated profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // The given name must be unique
          const exist = await prisma.profile.findUnique({
            where: {
              name: newName.toLowerCase(), // Make sure to lowercase name
            },
          })
          if (exist) throw new Error("This name was taken.")

          // Update name.
          await prisma.profile.update({
            where: {
              id: profileId,
            },
            data: {
              name: newName.toLowerCase(), // Make sure to lowercase name
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * @dev Update display name
     */
    t.field("updateDisplayName", {
      type: "WriteResult",
      args: { input: nonNull("UpdateNameInput") },
      async resolve(_root, { input }, { dataSources, prisma, signature }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, newName } = input
          if (!owner || !accountId || !profileId || !newName)
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

          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the to-be-updated profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Update display name.
          await prisma.profile.update({
            where: {
              id: profileId,
            },
            data: {
              displayName: newName,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * @dev Update profile image
     */
    t.field("updateProfileImage", {
      type: "WriteResult",
      args: { input: nonNull("UpdateImageInput") },
      async resolve(_root, { input }, { dataSources, prisma, signature }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, image, imageRef } = input
          if (!owner || !accountId || !profileId || !image || !imageRef)
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

          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the to-be-updated profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Update image
          await prisma.profile.update({
            where: {
              id: profileId,
            },
            data: {
              image,
              imageRef,
            },
          })

          // Delete the old file without waiting
          if (profile?.imageRef) {
            dataSources.uploadAPI.deleteFile(profile.imageRef)
          }

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * @dev Update banner image
     */
    t.field("updateBannerImage", {
      type: "WriteResult",
      args: { input: nonNull("UpdateImageInput") },
      async resolve(_root, { input }, { dataSources, prisma, signature }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, image, imageRef } = input
          if (!owner || !accountId || !profileId || !image || !imageRef)
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

          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the to-be-updated profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Update banner image.
          await prisma.profile.update({
            where: {
              id: profileId,
            },
            data: {
              bannerImage: image,
              bannerImageRef: imageRef,
            },
          })

          // Delete the old file without waiting
          if (profile?.bannerImageRef) {
            dataSources.uploadAPI.deleteFile(profile.bannerImageRef)
          }

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * @dev Follow/unFollow
     */
    t.field("follow", {
      type: "WriteResult",
      args: { input: nonNull("FollowInput") },
      async resolve(_root, { input }, { dataSources, prisma, signature }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, followerId } = input
          if (!owner || !accountId || !profileId || !followerId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Find the following profile
          const following = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!following) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the following profile
          if (account?.owner?.toLowerCase() !== following?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the follower profile
          const follower = await prisma.profile.findUnique({
            where: {
              id: followerId,
            },
          })
          if (!follower) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check if it's a `follow` or `unFollow` case
          const follow = await prisma.follow.findUnique({
            where: {
              followerId_followingId: {
                followingId: profileId,
                followerId,
              },
            },
          })

          if (!follow) {
            // Follow case: create a new follow
            await prisma.follow.create({
              data: {
                followingId: profileId,
                followerId,
              },
            })
          } else {
            // UnFollow case: delete the follow
            await prisma.follow.delete({
              where: {
                followerId_followingId: {
                  followingId: profileId,
                  followerId,
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

    t.field("updateWatchPreferences", {
      type: "WriteResult",
      args: { input: nonNull("UpdatePreferencesInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, preferences } = input
          if (!owner || !accountId || !profileId || !preferences)
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

          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the to-be-updated profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.profile.update({
            where: {
              id: profileId,
            },
            data: {
              watchPreferences: preferences,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("updateReadPreferences", {
      type: "WriteResult",
      args: { input: nonNull("UpdatePreferencesInput") },
      resolve: async (
        _parent,
        { input },
        { dataSources, prisma, signature }
      ) => {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, preferences } = input
          if (!owner || !accountId || !profileId || !preferences)
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

          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the to-be-updated profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.profile.update({
            where: {
              id: profileId,
            },
            data: {
              readPreferences: preferences,
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
