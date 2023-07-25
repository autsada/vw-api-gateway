import {
  extendType,
  inputObjectType,
  nonNull,
  objectType,
  enumType,
} from "nexus"
import {
  Report as ReportModel,
  ReportReason as ReportReasonEnum,
} from "nexus-prisma"

import {
  throwError,
  badInputErrMessage,
  unauthorizedErrMessage,
  notFoundErrMessage,
} from "./Error"
import { validateAuthenticity } from "../lib"

/**
 * The Report type that map to the database model
 */
export const ReportReason = enumType(ReportReasonEnum)
export const Report = objectType({
  name: ReportModel.$name,
  definition(t) {
    t.field(ReportModel.id)
    t.field(ReportModel.createdAt)
    t.field(ReportModel.submittedById)
    t.field(ReportModel.submittedBy)
    t.field(ReportModel.publishId)
    t.field(ReportModel.publish)
    t.field(ReportModel.reason)
  },
})

export const ReportPublishInput = inputObjectType({
  name: "ReportPublishInput",
  definition(t) {
    t.nonNull.string("owner")
    t.nonNull.string("accountId")
    t.nonNull.string("profileId")
    t.nonNull.string("publishId") // A publish id to be reported
    t.nonNull.field("reason", { type: "ReportReason" }) // A publish id to be reported
  },
})

export const ReportPublishMutation = extendType({
  type: "Mutation",
  definition(t) {
    t.field("reportPublish", {
      type: "WriteResult",
      args: { input: nonNull("ReportPublishInput") },
      resolve: async (
        parent,
        { input },
        { dataSources, signature, prisma }
      ) => {
        try {
          // Validate input
          if (!input) throwError(badInputErrMessage, "BAD_USER_INPUT")
          const { owner, accountId, profileId, publishId, reason } = input
          if (!owner || !accountId || !profileId || !publishId || !reason)
            throwError(badInputErrMessage, "BAD_USER_INPUT")

          // Validate authentication/authorization
          const account = await validateAuthenticity({
            accountId,
            owner,
            dataSources,
            prisma,
            signature,
          })
          if (!account) throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Find the profile
          const profile = await prisma.profile.findUnique({
            where: {
              id: profileId,
            },
          })
          if (!profile) throwError(notFoundErrMessage, "NOT_FOUND")

          // Check ownership of the profile
          if (account?.owner?.toLowerCase() !== profile?.owner?.toLowerCase())
            throwError(unauthorizedErrMessage, "UN_AUTHORIZED")

          // Create if not exist
          await prisma.report.upsert({
            where: {
              identifier: {
                submittedById: profileId,
                publishId,
                reason,
              },
            },
            create: {
              submittedById: profileId,
              publishId,
              reason,
            },
            update: {},
          })

          return { status: "Ok" }
        } catch (error) {
          throw error
        }
      },
    })
  },
})
