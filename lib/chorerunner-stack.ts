import * as cdk from 'aws-cdk-lib';
import { Cors, LambdaIntegration, RestApi } from 'aws-cdk-lib/aws-apigateway';
import { HttpMethod } from 'aws-cdk-lib/aws-apigatewayv2';
import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
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

    const helloLambda = new NodejsFunction(this, 'helloLambda', {
      runtime: Runtime.NODEJS_20_X,
      entry: path.join(__dirname, '..', 'src', 'helloLambda', 'index.ts'),
      handler: 'index.handler'
    })


    const helloPath = gateway.root.addResource('hello').addMethod('ANY', new LambdaIntegration(helloLambda))

  }
}
