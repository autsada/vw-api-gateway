import { AugmentedRequest, RESTDataSource } from "@apollo/datasource-rest"
// KeyValueCache is the type of Apollo server's default cache
import type { KeyValueCache } from "@apollo/utils.keyvaluecache"

import type { Environment } from "../types"
import { authClient } from "../client/authClient"

const { NODE_ENV, UPLOAD_SERVICE_URL } = process.env

const env = NODE_ENV as Environment

export class UploadAPI extends RESTDataSource {
  override baseURL =
    env === "development" ? "http://localhost:4444" : UPLOAD_SERVICE_URL!
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

  /**
   * @dev A route to delete a publish's video files from cloud storage
   * @param ref a storage path of the video files in cloud storage
   * @param publishId a publish id to be deleted
   * @param videoId a playback video id that stored on Cloudflare stream
   */
  async deleteVideo(
    ref: string,
    publishId: string,
    videoId?: string
  ): Promise<void> {
    return this.delete("upload/video", { body: { ref, publishId, videoId } })
  }

  /**
   * @dev A route to delete an image from cloud storage
   * @param ref a storage path to the image
   */
  async deleteImage(ref: string): Promise<void> {
    return this.delete("upload/image", { body: { ref } })
  }
}
