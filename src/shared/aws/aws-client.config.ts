import type { SNSClientConfig } from '@aws-sdk/client-sns';
import type { SQSClientConfig } from '@aws-sdk/client-sqs';
import type { AppEnvironment } from '../config/environment.schema';

export type AwsRuntimeConfig = Pick<
  AppEnvironment,
  | 'AWS_REGION'
  | 'AWS_ENDPOINT_URL'
  | 'AWS_ACCESS_KEY_ID'
  | 'AWS_SECRET_ACCESS_KEY'
>;

export function createAwsClientConfig(
  environment: AwsRuntimeConfig,
): SNSClientConfig & SQSClientConfig {
  const config: SNSClientConfig & SQSClientConfig = {
    region: environment.AWS_REGION,
  };

  if (environment.AWS_ENDPOINT_URL) {
    config.endpoint = environment.AWS_ENDPOINT_URL;
  }

  if (environment.AWS_ACCESS_KEY_ID && environment.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: environment.AWS_ACCESS_KEY_ID,
      secretAccessKey: environment.AWS_SECRET_ACCESS_KEY,
    };
  }

  return config;
}
