import { PubSub } from "@google-cloud/pubsub"

// Creates a client; cache this for further use
const pubSubClient = new PubSub()

export async function publishMessage(topicName: string, data: string) {
  // Publishes the message as a string, e.g. "Hello, world!" or JSON.stringify(someObject)
  const dataBuffer = Buffer.from(data)

  try {
    await pubSubClient.topic(topicName).publishMessage({ data: dataBuffer })
  } catch (error: any) {
    console.error(`Received error while publishing: ${error.message}`)
    process.exitCode = 1
  }
}
