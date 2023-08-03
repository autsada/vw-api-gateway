import { prisma } from "../client"
import { subscribeToMessage, publishMessage } from "./pubsub"

const { VIDEO_DELETION_SUBSCRIPTION, PUBLISH_DELETION_TOPIC } = process.env

export function listenToVideoDeletion() {
  const onVideoDeleted = async (message: any) => {
    const publishId = `${message?.data}`

    // Delete the publish in the database
    await prisma.publish
      .delete({
        where: {
          id: publishId,
        },
      })
      .then((publish) => {
        // Publish a publish delete message to pubsub
        return publishMessage(PUBLISH_DELETION_TOPIC!, publish.id)
      })
  }

  subscribeToMessage(VIDEO_DELETION_SUBSCRIPTION!, onVideoDeleted)
}

function main() {
  listenToVideoDeletion()
}

main()
