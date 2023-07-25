import { GraphQLScalarType } from "graphql"
import { DateTimeResolver } from "graphql-scalars"
import { asNexusMethod } from "nexus"

const dateTimeScalar = new GraphQLScalarType(DateTimeResolver)

export const DateTime = asNexusMethod(dateTimeScalar, "dateTime")
