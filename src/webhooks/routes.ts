import express from "express"
import { ethers } from "ethers"

import {
  onAddressUpdated,
  getTranscodeWebhook,
  createTranscodeWebhook,
  deleteTranscodeWebhook,
  onTranscodingFinished,
  onVideoDeleted,
  getVideoDetail,
  onSendTipFinished,
} from "./controllers"
import { validateCloudflareSignature } from "./middlewares"

export const router = express.Router()

router.post("/address-updated", onAddressUpdated)
router.get("/cloudflare", getTranscodeWebhook)
// router.post("/cloudflare", createTranscodeWebhook)
// router.delete("/cloudflare", deleteTranscodeWebhook)
router.post(
  "/cloudflare/finished",
  validateCloudflareSignature,
  onTranscodingFinished
)
router.post("/pubsub/video-deleted", onVideoDeleted)
router.get("/cloudflare/video", getVideoDetail) // For testing
router.post("/pubsub/tip-finished", onSendTipFinished)
