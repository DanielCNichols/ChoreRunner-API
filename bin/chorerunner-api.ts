#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ChoreRunnerStack } from '../lib/chorerunner-stack';
import { RestApi } from 'aws-cdk-lib/aws-apigateway';

const app = new cdk.App();
new ChoreRunnerStack(app, 'ChorerunnerStack', {

});