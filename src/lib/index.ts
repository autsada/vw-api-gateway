import * as crypto from "crypto"
import { ethers } from "ethers"
import _ from "lodash"

import { prisma as prismaClient } from "../client"
import { WalletAPI } from "../dataSources/walletAPI"
import { throwError, unauthorizedErrMessage } from "../graphql/Error"
import { hashMessage } from "@ethersproject/hash"

const { ALCHEMY_WEBHOOK_SIGNING_KEY, MESSAGE } = process.env

export function isValidAchemySignature(
  body: string, // must be raw string body, not json transformed version of the body
  signature: string // your "X-Alchemy-Signature" from header
): boolean {
  const hmac = crypto.createHmac("sha256", ALCHEMY_WEBHOOK_SIGNING_KEY!) // Create a HMAC SHA256 hash using the signing key
  hmac.update(body, "utf8") // Update the token hash with the request body using utf8
  const digest = hmac.digest("hex")
  return signature === digest
}

// export function isWebhookRequestAuthorized(token: string) {
//   return token === WEBHOOK_AUTH_KEY
// }

export async function validateAuthenticity({
  accountId,
  owner,
  dataSources,
  prisma,
  signature,
}: {
  accountId: string
  owner: string
  dataSources: { walletAPI: WalletAPI }
  prisma: typeof prismaClient
  signature?: string
}) {
  // User must be authenticated
  const { uid } = await dataSources.walletAPI.verifyUser()

  // Find account by the authenticated user's uid
  let account1 = await prisma.account.findUnique({
    where: {
      authUid: uid,
    },
  })

  // For `WALLET` account, account query by authUid will be null, for this case we have to query the account by a wallet address that is sent in the form of signed message by the frontend in the headers
  if (!account1 && signature) {
    const walletAddress = recoverAddress(signature)

    account1 = await prisma.account.findUnique({
      where: {
        owner: walletAddress.toLowerCase(),
      },
    })
  }

  // Account1 must be found at this point
  if (!account1) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")
  const account1Address = account1?.owner.toLowerCase()

  // Find account2 by the provided account id
  const account2 = await prisma.account.findUnique({
    where: {
      id: accountId,
    },
  })
  if (!account2) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

  const account2Address = account2?.owner.toLowerCase()
  const ownerAddress = owner.toLowerCase()

  if (account1Address !== account2Address)
    throwError(unauthorizedErrMessage, "UN_AUTHORIZED")
  if (account2Address !== ownerAddress)
    throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

  return account1
}

export function recoverAddress(signature: string) {
  const walletAddress = ethers.recoverAddress(hashMessage(MESSAGE!), signature)

  return walletAddress
}

const colors = [
  "#be123c",
  "#15803d",
  "#a21caf",
  "#0f766e",
  "#6d28d9",
  "#4338ca",
  "#b45309",
  "#c2410c",
  "#0e7490",
  "#b45309",
]

export function generateColor() {
  return colors[Math.floor(Math.random() * 10)]
}

export function getCleanText(text: string) {
  // Remove HTML tags and trim leading/trailing spaces
  return text.replace(/<[^>]*>/g, "").trim()
}

export function countWords(text: string) {
  // Remove HTML tags and trim leading/trailing spaces
  const cleanText = getCleanText(text)
  // Split the text into an array of words
  const words = cleanText.split(/\s+/)
  // Return the number of words
  return words.length
}

export function calucateReadingTime(text: string) {
  const wordCount = countWords(text)
  const wordsPerMinute = 220
  const readingTime = Math.ceil(wordCount / wordsPerMinute)
  return readingTime
}

export function getPostExcerpt(str: string, len = 200) {
  const cleanText = getCleanText(str)
  return _.truncate(cleanText, { length: len, separator: /,?\.* +/ }) // separate by spaces, including preceding commas and periods
}
