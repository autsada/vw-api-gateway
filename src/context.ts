import { PrismaClient } from "@prisma/client"

import { WalletAPI } from "./dataSources/walletAPI"
import { UploadAPI } from "./dataSources/uploadAPI"

export interface Context {
  dataSources: {
    walletAPI: WalletAPI
    uploadAPI: UploadAPI
  }
  prisma: PrismaClient
  idToken: string | undefined
  signature?: string // A signature signed by a `WALLET` account
}
