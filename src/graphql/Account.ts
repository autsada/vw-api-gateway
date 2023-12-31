import {
  extendType,
  objectType,
  nonNull,
  enumType,
  inputObjectType,
} from "nexus"

import {
  Account as AccountModel,
  AccountType as AccountTypeEnum,
} from "nexus-prisma"
import {
  cacheLoggedInSession,
  getDefaultProfileFromCache,
} from "../client/redis"
import {
  throwError,
  badInputErrMessage,
  unauthorizedErrMessage,
  notFoundErrMessage,
} from "./Error"
import { recoverAddress, validateAuthenticity } from "../lib"
import type { Environment } from "../types"

const { NODE_ENV } = process.env
const env = NODE_ENV as Environment

export const AccountType = enumType(AccountTypeEnum)

/**
 * A Account type that map to the prisma Account model.
 */
export const Account = objectType({
  name: AccountModel.$name,
  definition(t) {
    t.field(AccountModel.id)
    t.field(AccountModel.createdAt)
    t.field(AccountModel.updatedAt)
    t.field(AccountModel.owner)
    t.field(AccountModel.authUid)
    t.field(AccountModel.profiles)
    t.nonNull.field("type", { type: "AccountType" })
    t.field("defaultProfile", {
      type: "Profile",
      resolve: async (parent, _, { prisma }) => {
        const account = await prisma.account.findUnique({
          where: {
            id: parent.id,
          },
          include: {
            profiles: true,
          },
        })

        if (!account || account.profiles.length === 0) return null

        // TODO: Uncomment below code when redis is ready
        // const profile = await getDefaultProfileFromCache(parent.owner, account.profiles)

        const profile = account.profiles[0]

        return profile
      },
    })
  },
})

export const GetMyAccountInput = inputObjectType({
  name: "GetMyAccountInput",
  definition(t) {
    t.nonNull.field("accountType", { type: "AccountType" })
  },
})

export const AccountQuery = extendType({
  type: "Query",
  definition(t) {
    /**
     * Get user's account
     */
    t.field("getMyAccount", {
      type: "Account",
      args: { input: nonNull("GetMyAccountInput") },
      async resolve(_parent, { input }, { dataSources, prisma, signature }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Verify id token first.
          const { uid: authUid } = await dataSources.walletAPI.verifyUser()

          const { accountType } = input
          if (accountType === "TRADITIONAL") {
            // `TRADITIONAL` account
            // Get user's wallet address
            const { address, uid } =
              await dataSources.walletAPI.getWalletAddress()

            // Check if user is authorized
            if (authUid !== uid)
              throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

            // Query account from the database
            let account = await prisma.account.findUnique({
              where: {
                authUid,
              },
            })

            if (address) {
              const owner = address.toLowerCase()

              if (account) {
                if (account.owner?.toLowerCase() !== owner) {
                  // In this case update the account in the database
                  account = await prisma.account.update({
                    where: {
                      authUid,
                    },
                    data: {
                      owner,
                    },
                  })
                }
              } else {
                // In this case, create a new account in the database
                account = await prisma.account.create({
                  data: {
                    type: "TRADITIONAL",
                    owner,
                    authUid: uid,
                  },
                })
              }

              return account
            } else {
              if (account) {
                // In this case remove the account from the database
                await prisma.account.delete({
                  where: {
                    authUid,
                  },
                })
              }
              return null
            }
          } else if (accountType === "WALLET") {
            // `WALLET` account
            if (!signature) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

            // Query account from the database
            const owner = recoverAddress(signature!).toLowerCase()
            return prisma.account.findUnique({
              where: {
                owner,
              },
            })
          } else {
            return null
          }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("getBalance", {
      type: nonNull("String"),
      args: { address: nonNull("String") },
      async resolve(_root, { address }, { dataSources }) {
        try {
          if (!address) throwError(badInputErrMessage, "BAD_USER_INPUT")

          const { balance } = await dataSources.walletAPI.getBalance(address)

          return balance
        } catch (error) {
          throw error
        }
      },
    })
  },
})

export const CacheSessionInput = inputObjectType({
  name: "CacheSessionInput",
  definition(t) {
    t.nonNull.string("address")
    t.nonNull.string("profileId")
    t.nonNull.string("accountId")
  },
})

/**
 * Returned type of all the write operations that doesn't require return values.
 */
export const WriteResult = objectType({
  name: "WriteResult",
  definition(t) {
    t.nonNull.string("status")
  },
})

export const ValidateAuthInput = inputObjectType({
  name: "ValidateAuthInput",
  definition(t) {
    t.nonNull.string("accountId")
    t.nonNull.string("owner")
    t.nonNull.string("profileId")
  },
})

export const ValidateAuthResult = objectType({
  name: "ValidateAuthResult",
  definition(t) {
    t.nonNull.boolean("isAuthenticated")
  },
})

export const AccountMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("createAccount", {
      type: "Account",
      args: { input: nonNull("GetMyAccountInput") },
      async resolve(_parent, { input }, { dataSources, prisma, signature }) {
        try {
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Verify id token first.
          const { uid: authUid } = await dataSources.walletAPI.verifyUser()

          const { accountType } = input
          if (accountType === "TRADITIONAL") {
            // `TRADITIONAL` account
            // Get the wallet
            let wallet = await dataSources.walletAPI.getWalletAddress()

            if (wallet && wallet.address) {
              // Wallet found
              const { address, uid } = wallet
              const owner = address?.toLowerCase()

              // Find the associated account
              let account = await prisma.account.findUnique({
                where: {
                  authUid: uid,
                },
              })

              if (account) {
                // Account found
                if (account.owner?.toLowerCase() !== owner) {
                  // In this case update the account in the database
                  account = await prisma.account.update({
                    where: {
                      authUid,
                    },
                    data: {
                      owner,
                    },
                  })
                }
              } else {
                // Account not found, find it again using an address.
                account = await prisma.account.findUnique({
                  where: {
                    owner,
                  },
                })

                if (account) {
                  // Account found
                  if (!account.authUid) {
                    // In this case update the account in the database
                    account = await prisma.account.update({
                      where: {
                        owner,
                      },
                      data: {
                        authUid,
                      },
                    })
                  }
                } else {
                  // Account not found, only here, then we create a new account.
                  account = await prisma.account.create({
                    data: {
                      type: "TRADITIONAL",
                      owner,
                      authUid: uid,
                    },
                  })
                }
              }

              // Add the address to Alchemy notify
              if (env !== "development") {
                await dataSources.walletAPI.addAddressToNotify(account.owner)
              }

              return account
            } else {
              // No wallet found
              // Create a new wallet
              wallet = await dataSources.walletAPI.createWallet()

              if (wallet) {
                const { address, uid } = wallet
                const owner = address?.toLowerCase()

                // Find the associated account
                let account = await prisma.account.findUnique({
                  where: {
                    authUid: uid,
                  },
                })

                if (account) {
                  // Account found
                  if (account.owner?.toLowerCase() !== owner) {
                    // In this case update the account in the database
                    account = await prisma.account.update({
                      where: {
                        authUid,
                      },
                      data: {
                        owner,
                      },
                    })
                  }
                } else {
                  // Account not found, find it again using an address.
                  account = await prisma.account.findUnique({
                    where: {
                      owner,
                    },
                  })

                  if (account) {
                    // Account found
                    if (!account.authUid) {
                      // In this case update the account in the database
                      account = await prisma.account.update({
                        where: {
                          owner,
                        },
                        data: {
                          authUid,
                        },
                      })
                    }
                  } else {
                    // Account not found, only here, then we create a new account.
                    account = await prisma.account.create({
                      data: {
                        type: "TRADITIONAL",
                        owner,
                        authUid: uid,
                      },
                    })
                  }
                }

                // Add the address to Alchemy notify
                if (env !== "development") {
                  await dataSources.walletAPI.addAddressToNotify(account.owner)
                }

                return account
              } else {
                return null
              }
            }
          } else {
            // `WALLET` account
            if (!signature || accountType !== "WALLET")
              throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

            const ownerAddress = recoverAddress(signature!)
            const owner = ownerAddress.toLowerCase()
            if (!owner) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

            // 1. Find the account using the address
            let account = await prisma.account.findUnique({
              where: {
                owner,
              },
            })

            if (!account) {
              // 2. If no account found, create a new account.
              account = await prisma.account.create({
                data: {
                  type: accountType,
                  owner,
                },
              })
            }

            // Add the address to Alchemy notify
            if (env !== "development") {
              await dataSources.walletAPI.addAddressToNotify(account.owner)
            }

            return account
          }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("cacheSession", {
      type: nonNull("WriteResult"),
      args: { input: nonNull("CacheSessionInput") },
      async resolve(_parent, { input }, { dataSources, prisma, signature }) {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { address, profileId, accountId } = input
          if (!address || !profileId || !accountId)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization of the sender
          const account = await validateAuthenticity({
            accountId,
            owner: address,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Get the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // TODO: Uncomment below code when redis is ready
          // await cacheLoggedInSession(input.address, input.profileId)

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })

    t.field("validateAuth", {
      type: "ValidateAuthResult",
      args: { input: nonNull("ValidateAuthInput") },
      async resolve(_parent, { input }, { dataSources, prisma, signature }) {
        try {
          // Validate input
          if (!input) return { isAuthenticated: false }
          const { accountId, owner, profileId } = input
          if (!accountId || !owner || !profileId)
            return { isAuthenticated: false }

          // Validate authentication/authorization of the sender
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) return { isAuthenticated: false }

          // Get the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) return { isAuthenticated: false }

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            return { isAuthenticated: false }

          return { isAuthenticated: true }
        } catch (error) {
          return { isAuthenticated: false }
        }
      },
    })
  },
})
