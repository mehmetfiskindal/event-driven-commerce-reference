import { SNSClient } from '@aws-sdk/client-sns';
import {
  createAwsClientConfig,
  type AwsRuntimeConfig,
} from './aws-client.config';

export function createSnsClient(environment: AwsRuntimeConfig): SNSClient {
  return new SNSClient(createAwsClientConfig(environment));
}

