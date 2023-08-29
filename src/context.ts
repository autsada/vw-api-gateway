import { PrismaClient } from "@prisma/client"

import { WalletAPI } from "./dataSources/walletAPI"
import { UploadAPI } from "./dataSources/uploadAPI"
import { CloudflareAPI } from "./dataSources/cloudflareAPI"

export interface Context {
  dataSources: {
    walletAPI: WalletAPI
    uploadAPI: UploadAPI
    cloudflareAPI: CloudflareAPI
  }
  prisma: PrismaClient
  idToken: string | undefined
  signature?: string // A signature signed by a `WALLET` account
}
