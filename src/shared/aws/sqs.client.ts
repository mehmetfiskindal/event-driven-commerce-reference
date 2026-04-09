import { SQSClient } from '@aws-sdk/client-sqs';
import {
  createAwsClientConfig,
  type AwsRuntimeConfig,
} from './aws-client.config';

export function createSqsClient(environment: AwsRuntimeConfig): SQSClient {
  return new SQSClient(createAwsClientConfig(environment));
}
