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

export function subscribeToMessage(
  subscriptionName: string,
  onReceived: (message: any) => Promise<void>
) {
  const subscription = pubSubClient.subscription(subscriptionName)

  // Create an event handler to handle messages
  const messageHandler = (message: any) => {
    // console.log(`Received message ${message?.id}:`)
    // console.log(`\tData: ${message?.data}`)
    // console.log(`\tAttributes: ${message?.attributes}`)

    // Call the callback
    onReceived(message)

    // "Ack" (acknowledge receipt of) the message
    message.ack()
  }

  // Listen for new messages
  subscription.on("message", messageHandler)
}
