import { GoogleAuth } from "google-auth-library"

class AuthClient {
  private auth: GoogleAuth

  constructor() {
    this.auth = new GoogleAuth()
  }

  async getIdToken(serviceURL: string) {
    const client = await this.auth.getIdTokenClient(serviceURL)
    const headers = await client.getRequestHeaders()

    return headers ? headers["Authorization"] : ""
  }
}

export const authClient = new AuthClient()
