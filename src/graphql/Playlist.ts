import { extendType, inputObjectType, nonNull, objectType, list } from "nexus"
import {
  Playlist as PlaylistModel,
  PlaylistItem as PlaylistItemModel,
} from "nexus-prisma"
import type {
  Playlist as PlaylistType,
  PlaylistItem as PlaylistItemType,
} from "@prisma/client"

import { validateAuthenticity } from "../lib"
import {
  throwError,
  badInputErrMessage,
  notFoundErrMessage,
  unauthorizedErrMessage,
} from "./Error"
import { NexusGenObjects } from "../typegen"
import { FETCH_QTY } from "../lib/constants"

/**
 * The PlaylistItem type that map to the database model
 */
export const PlaylistItem = objectType({
  name: PlaylistItemModel.$name,
  definition(t) {
    t.field(PlaylistItemModel.id)
    t.field(PlaylistItemModel.createdAt)
    t.field(PlaylistItemModel.playlistId)
    t.field(PlaylistItemModel.playlist)
    t.field(PlaylistItemModel.publishId)
    t.field(PlaylistItemModel.publish)
  },
})

/**
 * The Playlist type that map to the database model
 */
export const Playlist = objectType({
  name: PlaylistModel.$name,
  definition(t) {
    t.field(PlaylistModel.id)
    t.field(PlaylistModel.createdAt)
    t.field(PlaylistModel.name)
    t.field(PlaylistModel.description)
    t.field(PlaylistModel.ownerId)
    t.field(PlaylistModel.owner)
    t.field(PlaylistModel.items)
  },
})

export const FetchMyPlaylistsInput = inputObjectType({
  name: "FetchMyPlaylistsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.string("cursor")
  },
})

export const CheckPublishPlaylistsInput = inputObjectType({
  name: "CheckPublishPlaylistsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
  },
})

export const PlaylistEdge = objectType({
  name: "PlaylistEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "Playlist",
    })
  },
})

export const FetchPlaylistsResponse = objectType({
  name: "FetchPlaylistsResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "PlaylistEdge" })
  },
})

export const CheckPublishPlaylistsResponse = objectType({
  name: "CheckPublishPlaylistsResponse",
  definition(t) {
    // And array of playlists that the publish is in
    t.nonNull.list.nonNull.field("items", { type: "PlaylistItem" })
    // A boolean to indicate of the publish is in Watch later playlist
    t.nonNull.boolean("isInWatchLater")
    t.nonNull.string("publishId")
  },
})

export const PreviewPlaylist = objectType({
  name: "PreviewPlaylist",
  definition(t) {
    t.nonNull.string("id")
    t.nonNull.string("name")
    t.nonNull.int("count")
    t.field("lastItem", { type: "Publish" })
  },
})

export const PreviewPlaylistEdge = objectType({
  name: "PreviewPlaylistEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "PreviewPlaylist",
    })
  },
})

export const FetchPreviewPlaylistsResponse = objectType({
  name: "FetchPreviewPlaylistsResponse",
  definition(t) {
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "PreviewPlaylistEdge" })
  },
})

export const FetchPlaylistItemsInput = inputObjectType({
  name: "FetchPlaylistItemsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("playlistId")
    t.string("cursor")
    t.field("orderBy", { type: "PlaylistOrderBy" })
  },
})

export const PlaylistItemEdge = objectType({
  name: "PlaylistItemEdge",
  definition(t) {
    t.string("cursor")
    t.field("node", {
      type: "PlaylistItem",
    })
  },
})

export const FetchPlaylistItemsResponse = objectType({
  name: "FetchPlaylistItemsResponse",
  definition(t) {
    t.nonNull.string("playlistName")
    t.string("playlistDescription")
    t.nonNull.field("pageInfo", { type: "PageInfo" })
    t.nonNull.list.nonNull.field("edges", { type: "PlaylistItemEdge" })
  },
})

export const PlaylistQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Fetch user's playlists
     */
    t.field("fetchMyPlaylists", {
      type: "FetchPlaylistsResponse",
      args: { input: nonNull("FetchMyPlaylistsInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
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

          // Query playlists by creator id
          let playlists: PlaylistType[] = []

          // Count playlist of the profile
          const playlistsCount = await prisma.playlist.count({
            where: {
              ownerId: profileId,
            },
          })

          if (!cursor) {
            // A. First query
            playlists = await prisma.playlist.findMany({
              where: {
                ownerId: profileId,
              },
              take: playlistsCount,
              orderBy: [
                {
                  updatedAt: "desc",
                },
                {
                  createdAt: "desc",
                },
              ],
            })
          } else {
            // B. Consecutive queries
            playlists = await prisma.playlist.findMany({
              where: {
                ownerId: profileId,
              },
              take: playlistsCount,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip cursor
              orderBy: [
                {
                  updatedAt: "desc",
                },
                {
                  createdAt: "desc",
                },
              ],
            })
          }

          if (playlists.length === 100) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = playlists[playlists.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.playlist.findMany({
              where: {
                ownerId: profileId,
              },
              take: 100,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip cursor
              orderBy: [
                {
                  updatedAt: "desc",
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
                count: playlistsCount,
              },
              edges: playlists.map((playlist) => ({
                cursor: playlist.id,
                node: playlist,
              })),
            }
          } else {
            // No more items to be fetched
            return {
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                count: playlistsCount,
              },
              edges: playlists.map((playlist) => ({
                cursor: playlist.id,
                node: playlist,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Check if a publish is in any playlists
     */
    t.field("checkPublishPlaylists", {
      type: "CheckPublishPlaylistsResponse",
      args: { input: nonNull("CheckPublishPlaylistsInput") },
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

          // Get playlist item(s)
          const items = await prisma.playlistItem.findMany({
            where: {
              AND: [
                {
                  ownerId: profileId,
                },
                {
                  publishId,
                },
              ],
            },
          })

          // Check if the item is in watch later
          const watchLaterItems = await prisma.watchLater.findMany({
            where: {
              AND: [
                {
                  profileId,
                },
                {
                  publishId,
                },
              ],
            },
          })

          return {
            items,
            isInWatchLater: watchLaterItems.length > 0,
            publishId,
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Fetch preview playlists
     * Get the most updated 10 playlists
     */
    t.field("fetchPreviewPlaylists", {
      type: "FetchPreviewPlaylistsResponse",
      args: { input: nonNull("FetchMyPlaylistsInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
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

          // Query playlists by owner id
          let playlists: NexusGenObjects["PreviewPlaylist"][] = []

          if (!cursor) {
            // A. First query
            const items = await prisma.playlist.findMany({
              where: {
                ownerId: profileId,
              },
              take: FETCH_QTY,
              orderBy: [
                {
                  updatedAt: "desc",
                },
                {
                  createdAt: "desc",
                },
              ],
              include: {
                items: {
                  include: {
                    publish: {
                      include: {
                        playback: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: "desc",
                  },
                },
              },
            })

            playlists = items.map((item) => ({
              id: item.id,
              name: item.name,
              count: item.items.length,
              lastItem: item.items[0] ? item.items[0].publish : null,
            }))
          } else {
            // B. Consecutive queries
            const items = await prisma.playlist.findMany({
              where: {
                ownerId: profileId,
              },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip cursor
              orderBy: [
                {
                  updatedAt: "desc",
                },
                {
                  createdAt: "desc",
                },
              ],
              include: {
                items: {
                  include: {
                    publish: {
                      include: {
                        playback: true,
                      },
                    },
                  },
                  orderBy: {
                    createdAt: "desc",
                  },
                },
              },
            })

            playlists = items.map((item) => ({
              id: item.id,
              name: item.name,
              count: item.items.length,
              lastItem: item.items[0] ? item.items[0].publish : null,
            }))
          }

          // Get playlists count
          const count = await prisma.playlist.count({
            where: {
              ownerId: profileId,
            },
          })

          if (playlists.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = playlists[playlists.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.playlist.findMany({
              where: {
                ownerId: profileId,
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip cursor
              orderBy: [
                {
                  updatedAt: "desc",
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
              edges: playlists.map((playlist) => ({
                cursor: playlist.id,
                node: playlist,
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
              edges: playlists.map((playlist) => ({
                cursor: playlist.id,
                node: playlist,
              })),
            }
          }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Fetch playlist items by playlist id
     */
    t.field("fetchPlaylistItems", {
      type: "FetchPlaylistItemsResponse",
      args: { input: nonNull("FetchPlaylistItemsInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, playlistId, cursor, orderBy } =
            input
          if (!owner || !accountId || !profileId || !playlistId)
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

          // Check ownership of the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              id: playlistId,
            },
          })
          if (!playlist) throwError(notFoundErrMessage, "NOT_FOUND")

          if (playlist?.ownerId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Query playlist items by playlist id
          let items: PlaylistItemType[] = []

          if (!cursor) {
            // A. First query
            items = await prisma.playlistItem.findMany({
              where: {
                playlistId,
              },
              take: FETCH_QTY,
              orderBy: {
                createdAt: orderBy === "oldest" ? "asc" : "desc",
              },
            })
          } else {
            // B. Consecutive queries
            items = await prisma.playlistItem.findMany({
              where: {
                playlistId,
              },
              take: FETCH_QTY,
              cursor: {
                id: cursor,
              },
              skip: 1, // Skip cursor
              orderBy: {
                createdAt: orderBy === "oldest" ? "asc" : "desc",
              },
            })
          }

          // Get playlists count
          const count = await prisma.playlistItem.count({
            where: {
              playlistId,
            },
          })

          if (items.length === FETCH_QTY) {
            // Fetch result is equal to take quantity, so it has posibility that there are more to be fetched.
            const lastFetchedCursor = items[items.length - 1].id

            // Check if there is next page
            const nextQuery = await prisma.playlistItem.findMany({
              where: {
                playlistId,
              },
              take: FETCH_QTY,
              cursor: {
                id: lastFetchedCursor,
              },
              skip: 1, // Skip cursor
              orderBy: {
                createdAt: orderBy === "oldest" ? "asc" : "desc",
              },
            })

            return {
              playlistName: playlist?.name!,
              playlistDescription: playlist?.description,
              pageInfo: {
                endCursor: lastFetchedCursor,
                hasNextPage: nextQuery.length > 0,
                count,
              },
              edges: items.map((item) => ({
                cursor: item.id,
                node: item,
              })),
            }
          } else {
            // No more items to be fetched
            return {
              playlistName: playlist?.name!,
              playlistDescription: playlist?.description,
              pageInfo: {
                endCursor: null,
                hasNextPage: false,
                count,
              },
              edges: items.map((item) => ({
                cursor: item.id,
                node: item,
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
 * A new playlist will be created when user wants to add a publish to a new playlist.
 */
export const CreatePlayListInput = inputObjectType({
  name: "CreatePlayListInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("name")
    t.nonNull.string("publishId")
  },
})

/**
 * Add to existing playlist input
 */
export const AddToPlaylistInput = inputObjectType({
  name: "AddToPlaylistInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("playlistId")
    t.nonNull.string("publishId")
  },
})

/**
 * Update playlists
 */
export const PlaylistItemStatus = inputObjectType({
  name: "PlaylistItemStatus",
  definition(t) {
    t.nonNull.boolean("isInPlaylist")
    t.nonNull.string("playlistId")
  },
})
export const UpdatePlaylistsInput = inputObjectType({
  name: "UpdatePlaylistsInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId")
    t.nonNull.list.nonNull.field("playlists", { type: "PlaylistItemStatus" })
  },
})

/**
 * Delete a playlist
 */
export const DeletePlaylistInput = inputObjectType({
  name: "DeletePlaylistInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("playlistId")
  },
})

/**
 * Update a playlist name
 */
export const UpdatePlaylistNameInput = inputObjectType({
  name: "UpdatePlaylistNameInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("playlistId")
    t.nonNull.string("name")
  },
})

/**
 * Update a playlist name
 */
export const UpdatePlaylistDescriptionInput = inputObjectType({
  name: "UpdatePlaylistDescriptionInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("playlistId")
    t.nonNull.string("description")
  },
})

/**
 * Remove a publish from playlist
 */
export const RemoveFromPlaylistInput = inputObjectType({
  name: "RemoveFromPlaylistInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("playlistId")
    t.nonNull.string("publishId")
  },
})

export const PlaylistMutation = extendType({
  type: "Mutation",
  definition(t) {
    /**
     * Add a publish to non-existing playlist
     */
    t.field("addToNewPlaylist", {
      type: "WriteResult",
      args: { input: nonNull("CreatePlayListInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, name, publishId } = input
          if (!owner || !accountId || !profileId || !name || !publishId)
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

          // Create new playlist if not exist
          const playlist = await prisma.playlist.upsert({
            where: {
              identifier: {
                ownerId: profileId,
                name,
              },
            },
            create: {
              name,
              ownerId: profileId,
              updatedAt: new Date().toISOString(),
            },
            update: {},
          })

          // 2. A add a publish to the created playlist
          await prisma.playlistItem.create({
            data: {
              ownerId: profileId,
              playlistId: playlist.id,
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
     * Add a publish to existing playlist
     */
    t.field("addToPlaylist", {
      type: "WriteResult",
      args: { input: nonNull("AddToPlaylistInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, playlistId, publishId } = input
          if (!owner || !accountId || !profileId || !playlistId || !publishId)
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

          // Check ownership of the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              id: playlistId,
            },
          })
          if (!playlist) throwError(notFoundErrMessage, "NOT_FOUND")

          if (playlist?.ownerId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Add a publish to the playlist if not exist
          await prisma.playlistItem.upsert({
            where: {
              identifier: {
                playlistId,
                publishId,
              },
            },
            create: {
              ownerId: profileId,
              playlistId: playlistId,
              publishId,
            },
            update: {},
          })

          // Update updatedAt of the playlist
          await prisma.playlist.update({
            where: {
              id: playlistId,
            },
            data: {
              updatedAt: new Date().toISOString(),
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Update many playlists
     */
    t.field("updatePlaylists", {
      type: "WriteResult",
      args: { input: nonNull("UpdatePlaylistsInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, publishId, playlists } = input
          if (!owner || !accountId || !profileId || !publishId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")
          if (playlists.length === 0)
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

          // Separate add and remove
          const addItems = playlists.filter((pl) => pl.isInPlaylist)
          const removeItems = playlists.filter((pl) => !pl.isInPlaylist)

          // Add items
          if (addItems.length > 0) {
            await prisma.playlistItem.createMany({
              data: addItems.map((item) => ({
                ownerId: profileId,
                playlistId: item.playlistId,
                publishId,
              })),
            })

            // Update playlists
            await Promise.all(
              addItems.map((item) =>
                prisma.playlist.update({
                  where: {
                    id: item.playlistId,
                  },
                  data: {
                    updatedAt: new Date().toISOString(),
                  },
                })
              )
            )
          }

          if (removeItems.length > 0) {
            await Promise.all(
              removeItems.map((item) =>
                prisma.playlistItem.delete({
                  where: {
                    identifier: {
                      playlistId: item.playlistId,
                      publishId,
                    },
                  },
                })
              )
            )
          }

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Delete a playlist and its content
     */
    t.field("deletePlaylist", {
      type: "WriteResult",
      args: { input: nonNull("DeletePlaylistInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, playlistId } = input
          if (!owner || !accountId || !profileId || !playlistId)
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

          // Check ownership of the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              id: playlistId,
            },
          })
          if (!playlist) throwError(notFoundErrMessage, "NOT_FOUND")

          if (playlist?.ownerId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.playlist.delete({
            where: {
              id: playlistId,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Update playlist's name
     */
    t.field("updatePlaylistName", {
      type: "WriteResult",
      args: { input: nonNull("UpdatePlaylistNameInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, playlistId, name } = input
          if (!owner || !accountId || !profileId || !playlistId || !name)
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

          // Check ownership of the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              id: playlistId,
            },
          })
          if (!playlist) throwError(notFoundErrMessage, "NOT_FOUND")

          if (playlist?.ownerId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.playlist.update({
            where: {
              id: playlistId,
            },
            data: {
              name,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Update playlist's name
     */
    t.field("updatePlaylistDescription", {
      type: "WriteResult",
      args: { input: nonNull("UpdatePlaylistDescriptionInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, playlistId, description } = input
          if (!owner || !accountId || !profileId || !playlistId || !description)
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

          // Check ownership of the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              id: playlistId,
            },
          })
          if (!playlist) throwError(notFoundErrMessage, "NOT_FOUND")

          if (playlist?.ownerId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.playlist.update({
            where: {
              id: playlistId,
            },
            data: {
              description,
            },
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    /**
     * Remove a publish from playlist
     */
    t.field("removeFromPlaylist", {
      type: "WriteResult",
      args: { input: nonNull("RemoveFromPlaylistInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, playlistId, publishId } = input
          if (!owner || !accountId || !profileId || !playlistId || !publishId)
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

          // Check ownership of the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              id: playlistId,
            },
          })
          if (!playlist) throwError(notFoundErrMessage, "NOT_FOUND")

          if (playlist?.ownerId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.playlistItem.delete({
            where: {
              identifier: {
                playlistId,
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
     * Delete all content in a playlist (not delete the playlist itself)
     */
    t.field("deleteAllPlaylistItems", {
      type: "WriteResult",
      args: { input: nonNull("DeletePlaylistInput") },
      resolve: async (_, { input }, { dataSources, prisma, signature }) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, playlistId } = input
          if (!owner || !accountId || !profileId || !playlistId)
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

          // Check ownership of the playlist
          const playlist = await prisma.playlist.findUnique({
            where: {
              id: playlistId,
            },
          })
          if (!playlist) throwError(notFoundErrMessage, "NOT_FOUND")

          if (playlist?.ownerId !== profileId)
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          await prisma.playlistItem.deleteMany({
            where: {
              playlistId,
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
