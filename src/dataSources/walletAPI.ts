import { AugmentedRequest, RESTDataSource } from "@apollo/datasource-rest"
// KeyValueCache is the type of Apollo server's default cache
import type { KeyValueCache } from "@apollo/utils.keyvaluecache"

import { authClient } from "../client/authClient"
import type { Environment } from "../types"

const { NODE_ENV, PRIVATE_SERVICE_URL } = process.env

const env = NODE_ENV as Environment

export class WalletAPI extends RESTDataSource {
  override baseURL =
    env === "development" ? "http://localhost:8000" : PRIVATE_SERVICE_URL!
  private idToken: string | undefined

  constructor(options: { idToken: string | undefined; cache: KeyValueCache }) {
    super(options) // this sends our server's `cache` through
    this.idToken = options.idToken
  }

  protected override async willSendRequest(
    _path: string,
    req: AugmentedRequest
  ): Promise<void> {
    // The token for use to authenticate between services in GCP
    if (env !== "development") {
      const token = await authClient.getIdToken(this.baseURL)
      req.headers["authorization"] = token || ""
    }
    // The id token that to be sent from the UI for use to verify user.
    req.headers["id-token"] = this.idToken || ""
  }

  // async createCryptoKey(): Promise<{ keyName: string }> {
  //   return this.post('admin/key/create/master')
  // }

  /**
   * @dev A route to get user's auth provider
   */
  async verifyUser(): Promise<{ uid: string }> {
    return this.get("auth/verify")
  }

  /**
   * @dev A route to get user's wallet address (for `TRADITIONAL` account)
   */
  async getWalletAddress(): Promise<{ address: string }> {
    return this.get("wallet/address")
  }

  /**
   * @dev A route to create blockchain wallet (for `TRADITIONAL` account).
   */
  async createWallet(): Promise<{
    address: string
    uid: string
  }> {
    return this.post("wallet/create")
  }

  /**
   * @dev A route to get balance of a specific address.
   */
  async getBalance(address: string): Promise<{ balance: string }> {
    return this.get(`wallet/balance/${encodeURIComponent(address)}`)
  }

  /**
   * @dev Calculate how much tips in wei for a given usd amount
   */
  async calculateTips(qty: number): Promise<{ tips: string }> {
    return this.post("wallet/tips/calculate", { body: { qty } })
  }

  /**
   * @dev Send tips to a profile
   * @param to - a wallet address to send the tips to
   * @param qty usd amount to be sent
   */
  async sendTips(
    to: string,
    qty: number
  ): Promise<{
    result: {
      from: string
      to: string
      amount: string
      fee: string
    }
  }> {
    return this.post("wallet/tips/send", { body: { to, qty } })
  }
}
