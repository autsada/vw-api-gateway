import path from "path"
import dotenv from "dotenv"
dotenv.config({ path: path.join(__dirname, "../.env") })
import express from "express"
import cors from "cors"
import http from "http"
import { ApolloServer } from "@apollo/server"
import { expressMiddleware } from "@apollo/server/express4"
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer"
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default"
import { InMemoryLRUCache } from "@apollo/utils.keyvaluecache"

import { schema } from "./schema"
import { prisma } from "./client"
import { WalletAPI } from "./dataSources/walletAPI"
import { UploadAPI } from "./dataSources/uploadAPI"
import { router } from "./webhooks/routes"
import type { Context } from "./context"
import type { Environment } from "./types"

const { PORT, NODE_ENV } = process.env
const env = NODE_ENV as Environment

async function startServer() {
  const app = express()

  app.use(
    express.json({
      verify: (req, res, buf) => {
        req.rawBody = buf.toString("utf-8")
      },
      limit: "25mb",
    })
  )
  app.use(express.urlencoded({ extended: true, limit: "25mb" }))
  app.use(cors<cors.CorsRequest>())

  // Webhooks route for listening to activity occurred to user's blockchain address
  app.use("/webhooks", router)

  const httpServer = http.createServer(app)

  // Set up ApolloServer.
  const server = new ApolloServer<Context>({
    schema,
    csrfPrevention: true,
    cache: new InMemoryLRUCache({
      // ~100MiB
      maxSize: Math.pow(2, 20) * 100,
      // 5 minutes (in milliseconds)
      ttl: 300_000,
    }),
    plugins: [
      // Proper shutdown for the HTTP server.
      ApolloServerPluginDrainHttpServer({ httpServer }),
      ApolloServerPluginLandingPageLocalDefault({ embed: true }),
    ],
    introspection: env !== "production", // Only in development and staging env.
  })

  await server.start()
  app.use(
    "/graphql",
    expressMiddleware(server, {
      context: async ({ req }) => {
        const { cache } = server
        // Get the user token from the headers.
        const authorization = req.headers["authorization"]
        const idToken = authorization?.split(" ")[1]
        // For `WALLET` accounts, frontend must also wallet address in the headers for use in conjunction with the id token
        const signature = req.headers["auth-wallet-signature"] as
          | string
          | undefined

        return {
          prisma,
          idToken,
          signature,
          dataSources: {
            walletAPI: new WalletAPI({ idToken, cache }),
            uploadAPI: new UploadAPI({ idToken, cache }),
          },
        }
      },
    })
  )

  await new Promise<void>((resolver) => {
    httpServer.listen({ port: Number(PORT) }, resolver)
  })
  console.log(`APIs ready at port: ${PORT}`)

  return { server, app }
}

startServer()

// process.on("uncaughtException", (err, origin) => {
//   console.log("uncaught: ", err)
// })

// process.once("SIGUSR2", function () {
//   process.kill(process.pid, "SIGUSR2")
// })

// process.on("SIGINT", function () {
//   // this is only called on ctrl+c, not restart
//   process.kill(process.pid, "SIGINT")
// })

// "exec": "ts-node-dev --no-notify --respawn --transpile-only src/app.ts"
