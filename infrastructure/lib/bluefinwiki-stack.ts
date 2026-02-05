import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

interface BlueFinWikiStackProps extends cdk.StackProps {
  environment: string;
}

export class BlueFinWikiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: BlueFinWikiStackProps) {
    super(scope, id, props);

    // Infrastructure will be implemented in Phase 1, Week 1, Task 1.2
    // This is a placeholder stack
    
    new cdk.CfnOutput(this, 'Environment', {
      value: props.environment,
      description: 'Deployment environment',
    });
  }
}
