import * as cdk from 'aws-cdk-lib';
import { Cors, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { AttributeType, BillingMode, Table } from 'aws-cdk-lib/aws-dynamodb';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import path from 'path';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class ChoreRunnerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const gateway = new RestApi(this, 'chorerunner-api', {
      defaultCorsPreflightOptions: {
        allowOrigins: Cors.ALL_ORIGINS,
        allowMethods: Cors.ALL_METHODS,
      },
    })

    const helloLambda = new Function(this, 'helloLambda', {
      runtime: Runtime.NODEJS_20_X,
      code: Code.fromAsset(path.join(__dirname, '..', 'dist', 'helloLambda')),
      handler: 'index.handler'
    })


    gateway.root.addResource('hello').addMethod('ANY', new LambdaIntegration(helloLambda))

    // TODO: encryption, deletion policy etc
    const dynamoTable = new Table(this, 'test-table', {
      partitionKey: { name: 'id', type: AttributeType.STRING },
      billingMode: BillingMode.PAY_PER_REQUEST,
      tableName: 'test-table'
    })

    dynamoTable.grantReadWriteData(helloLambda)

  }
}
