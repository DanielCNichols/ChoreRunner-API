import { DynamoDBClient, DynamoDBClientConfig } from "@aws-sdk/client-dynamodb";
import { Endpoint } from "aws-cdk-lib/aws-docdb/lib/endpoint";

const config: DynamoDBClientConfig = {}

if (process.env.AWS_SAM_LOCAL === 'true') {
  config.endpoint = 'http://dynamo:8000'
}


export const dbClient = new DynamoDBClient(config)

