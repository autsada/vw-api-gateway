import { AugmentedRequest, RESTDataSource } from "@apollo/datasource-rest"
// KeyValueCache is the type of Apollo server's default cache
import type { KeyValueCache } from "@apollo/utils.keyvaluecache"
import { NexusGenObjects } from "../typegen"

const { CLOUDFLAR_BASE_URL, CLOUDFLAR_ACCOUNT_ID, CLOUDFLAR_API_TOKEN } =
  process.env

export class CloudflareAPI extends RESTDataSource {
  override baseURL = CLOUDFLAR_BASE_URL!

  constructor(options: { cache: KeyValueCache }) {
    super(options) // this sends our server's `cache` through
  }

  protected override async willSendRequest(
    _path: string,
    req: AugmentedRequest
  ): Promise<void> {
    req.headers["Authorization"] = `Bearer ${CLOUDFLAR_API_TOKEN || ""}`
  }

  /**
   * @dev A route to delete a transcoded video on cloudflare
   * @param videoId a video id stored in the playback object
   */
  async deleteVideo(videoId?: string): Promise<void> {
    return this.delete(
      `client/v4/accounts/${CLOUDFLAR_ACCOUNT_ID}/stream/${videoId}`
    )
  }

  /**
   * @dev A route to create a live input for live streaming
   * @param name a publish title
   * @param profileId a profile id
   * @param publishId a publish associated with the live input
   */
  async createLiveInput(
    publishId: string
  ): Promise<NexusGenObjects["CreateLiveInputResponse"]> {
    return this.post(
      `client/v4/accounts/${CLOUDFLAR_ACCOUNT_ID}/stream/live_inputs`,
      {
        body: {
          deleteRecordingAfterDays: 30,
          meta: {
            name: publishId,
          },
          recording: {
            mode: "automatic", // The video will automatically recorded for on-demand after the live stream finished
            requireSignedURLs: false,
            timeoutSeconds: 0,
            deleteRecordingAfterDays: 45, // number of days the live inputs recordings will be deleted after finished
          },
        },
      }
    )
  }

  /**
   * @dev A route to get a live input from Cloudflare
   * @param liveInputUID string
   */
  async getLiveInput(
    liveInputUID: string
  ): Promise<NexusGenObjects["CreateLiveInputResponse"]> {
    return this.get(
      `client/v4/accounts/${CLOUDFLAR_ACCOUNT_ID}/stream/live_inputs/${encodeURIComponent(
        liveInputUID
      )}`
    )
  }
}
