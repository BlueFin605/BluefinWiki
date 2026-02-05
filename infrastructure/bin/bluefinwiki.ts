#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BlueFinWikiStack } from '../lib/bluefinwiki-stack';

const app = new cdk.App();

// Get environment from context
const env = app.node.tryGetContext('env') || 'dev';

new BlueFinWikiStack(app, `BlueFinWikiStack-${env}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  environment: env,
});
