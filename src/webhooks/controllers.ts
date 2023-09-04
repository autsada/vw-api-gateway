import type { Request, Response } from "express"
import axios from "axios"

import { prisma } from "../client"
import { isValidAchemySignature } from "../lib"
import { publishMessage } from "../lib/pubsub"
import { decryptString } from "../lib/crypto"

const {
  CLOUDFLAR_BASE_URL,
  CLOUDFLAR_API_TOKEN,
  CLOUDFLAR_ACCOUNT_ID,
  PUBLISH_PROCESSING_TOPIC,
  PUBLISH_DELETION_TOPIC,
} = process.env

/**
 * This route will be called by Alchemy to notify when there is any activity occurred on an address
 *
 */
export async function onAddressUpdated(req: Request, res: Response) {
  try {
    // Get signature from headers
    const signature = req.headers["x-alchemy-signature"]
    // Get raw body from req
    const rawBody = req.rawBody
    if (!signature || !rawBody) throw new Error("Invalid request")
    // Validate signature
    const isValid = isValidAchemySignature(rawBody, signature as string)
    if (!isValid) throw new Error("Request corrupted in transit.")
    const body = req.body

    // TODO: Inform the UIs

    res.status(200).end()
  } catch (error) {
    res.status(500).end()
  }
}

export async function getTranscodeWebhook(req: Request, res: Response) {
  try {
    const response = await axios({
      method: "GET",
      url: `${CLOUDFLAR_BASE_URL}/client/v4/accounts/${CLOUDFLAR_ACCOUNT_ID}/stream/webhook`,
      headers: {
        Authorization: `Bearer ${CLOUDFLAR_API_TOKEN}`,
      },
    })

    res
      .status(200)
      .json({ result: response.data.result, success: response.data.success })
  } catch (error) {
    res.status(500).end()
  }
}

/**
 * TODO: add authorization for the admin user only.
 */
export async function createTranscodeWebhook(req: Request, res: Response) {
  try {
    const { webhookURL } = req.body as { webhookURL: string }
    if (!webhookURL) {
      res.status(400).send("Bad Request")
    } else {
      const response = await axios({
        method: "PUT",
        url: `${CLOUDFLAR_BASE_URL}/client/v4/accounts/${CLOUDFLAR_ACCOUNT_ID}/stream/webhook`,
        headers: {
          Authorization: `Bearer ${CLOUDFLAR_API_TOKEN}`,
        },
        data: {
          notificationUrl: webhookURL,
        },
      })

      res
        .status(200)
        .json({ result: response.data.result, success: response.data.success })
    }
  } catch (error) {
    res.status(500).end()
  }
}

/**
 * TODO: add authorization for the admin user only.
 */
export async function deleteTranscodeWebhook(req: Request, res: Response) {
  try {
    await axios({
      method: "DELETE",
      url: `${CLOUDFLAR_BASE_URL}/client/v4/accounts/${CLOUDFLAR_ACCOUNT_ID}/stream/webhook`,
      headers: {
        Authorization: `Bearer ${CLOUDFLAR_API_TOKEN}`,
      },
    })

    res.status(200).json({ status: "Ok" })
  } catch (error) {
    res.status(500).end()
  }
}

// This route will be called by Cloudflare stream when video transcode finished.
export async function onTranscodingFinished(req: Request, res: Response) {
  let publishId = ""

  try {
    if (!req.isWebhookSignatureValid) {
      res.status(403).send("Forbidden")
    } else {
      const body = req.body

      // `readyToStream` is a boolean that indicate if the playback urls are ready.
      if (body.readyToStream) {
        const metaName = body.meta?.name
        publishId = metaName?.split(" ")[0] || ""
        // const contentPath = (body.meta?.path as string) || body.meta?.name
        // publishId = contentPath ? contentPath.split("/")[2] : ""

        // Update uploading status on the publish
        const publish = await prisma.publish.findUnique({
          where: {
            id: publishId,
          },
        })

        // Create (if not exist) or update (if exists) a playback in the database.
        await prisma.playback.upsert({
          where: {
            publishId,
          },
          create: {
            thumbnail: body.thumbnail,
            preview: body.preview,
            duration: body.duration,
            hls: body.playback?.hls,
            dash: body.playback?.dash,
            publishId,
            videoId: body.uid,
          },
          update: {
            thumbnail: body.thumbnail,
            preview: body.preview,
            duration: body.duration,
            hls: body.playback?.hls,
            dash: body.playback?.dash,
            videoId: body.uid,
            liveStatus: publish?.streamType === "Live" ? "ready" : null,
          },
        })

        // We shoud find the publish as it will be created as the first step in upload process
        if (publish) {
          await prisma.publish.update({
            where: {
              id: publishId,
            },
            data: {
              uploadError: false,
              uploading: false,
              transcodeError: false,
              thumbnailType: !publish.thumbnailType
                ? "generated"
                : publish.thumbnailType,
              contentURI: body.meta?.contentURI,
              contentRef: body.meta?.contentRef,
              publishType:
                publish.streamType !== "Live"
                  ? body.duration <= 60
                    ? "Short"
                    : "Video"
                  : "Video",
              streamType: "onDemand",
            },
          })
        }
      }

      // Publish a message to pub/sub
      await publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)

      res.status(200).end()
    }
  } catch (error) {
    // In case of an error occurred, we have to update the publish so the publish owner will know
    const publish = await prisma.publish.findUnique({
      where: {
        id: publishId,
      },
    })
    if (publish) {
      await prisma.publish.update({
        where: {
          id: publish.id,
        },
        data: {
          transcodeError: true,
          uploading: false,
        },
      })
    }

    // Publish a message to pub/sub
    await publishMessage(PUBLISH_PROCESSING_TOPIC!, publishId)

    res.status(500).end()
  }
}

export async function onVideoDeleted(req: Request, res: Response) {
  try {
    if (!req.body) {
      const msg = "no Pub/Sub message received"
      console.error(`error: ${msg}`)
      res.status(400).send(`Bad Request: ${msg}`)
      return
    }
    if (!req.body.message) {
      const msg = "invalid Pub/Sub message format"
      console.error(`error: ${msg}`)
      res.status(400).send(`Bad Request: ${msg}`)
      return
    }

    // Get the the data from the request
    const pubSubMessage = req.body.message
    const data = pubSubMessage.data
      ? Buffer.from(pubSubMessage.data, "base64").toString().trim()
      : undefined

    if (!data) {
      const msg = "No data found"
      console.error(`error: ${msg}`)
      res.status(400).send(`Bad Request: ${msg}`)
      return
    }
    // Decrypt the data
    const publishId = decryptString(data)
    if (!publishId) {
      const msg = "Invalid data"
      console.error(`error: ${msg}`)
      res.status(400).send(`Bad Request: ${msg}`)
      return
    }
    // Delete the publish in the database
    const publish = await prisma.publish.delete({
      where: {
        id: publishId,
      },
    })

    // Publish a publish delete message to pubsub
    // No need to encrypt publish id because the service that is listening to this topic is a private service that cannot be called from outside anyway.
    publishMessage(PUBLISH_DELETION_TOPIC!, publish.id)

    res.status(204).send()
  } catch (error) {
    res.status(500).end()
  }
}

export async function getVideoDetail(req: Request, res: Response) {
  try {
    const liveInputId = req.body.liveId
    const response = await axios({
      method: "GET",
      url: `${CLOUDFLAR_BASE_URL}/client/v4/accounts/${CLOUDFLAR_ACCOUNT_ID}/stream/live_inputs/${liveInputId}/videos`,
      headers: {
        Authorization: `Bearer ${CLOUDFLAR_API_TOKEN}`,
      },
    })

    res.status(200).json({ result: response.data })
  } catch (error) {
    res.status(500).end()
  }
}
