import { Profile } from "@prisma/client"
import Redis from "ioredis"

const { REDIS_HOST, REDIS_PORT } = process.env

const redis = new Redis({
  host: REDIS_HOST,
  port: Number(REDIS_PORT),
})

/**
 * @param address - a wallet address of the account
 * @param profileId - a profile id to be cached
 * @returns
 */
export function cacheLoggedInSession(address: string, profileId: string) {
  return redis.set(address.toLowerCase(), profileId)
}

/**
 * @param owner - an EOA address that owns the account
 * @param profiles - an array of user's profiles
 * @returns
 */
export async function getDefaultProfileFromCache(
  owner: string,
  profiles: (Profile | null)[]
) {
  // Check the previous used station from redis
  const profileId = await redis.get(owner.toLowerCase())
  const defaultProfile = profiles.length > 0 ? profiles[0] : null

  if (!profileId) return defaultProfile

  return profiles.find((profile) => profile?.id === profileId) || defaultProfile
}

export { redis }
