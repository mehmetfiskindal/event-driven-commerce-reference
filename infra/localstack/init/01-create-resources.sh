#!/bin/sh
set -eu

awslocal sns create-topic --name order-events >/dev/null

awslocal sqs create-queue --queue-name payment-queue >/dev/null
awslocal sqs create-queue --queue-name inventory-queue >/dev/null
awslocal sqs create-queue --queue-name notification-queue >/dev/null

TOPIC_ARN="$(awslocal sns list-topics --query 'Topics[?contains(TopicArn, `order-events`)].TopicArn' --output text)"
PAYMENT_QUEUE_URL="$(awslocal sqs get-queue-url --queue-name payment-queue --query 'QueueUrl' --output text)"
INVENTORY_QUEUE_URL="$(awslocal sqs get-queue-url --queue-name inventory-queue --query 'QueueUrl' --output text)"
NOTIFICATION_QUEUE_URL="$(awslocal sqs get-queue-url --queue-name notification-queue --query 'QueueUrl' --output text)"

PAYMENT_QUEUE_ARN="$(awslocal sqs get-queue-attributes --queue-url "$PAYMENT_QUEUE_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"
INVENTORY_QUEUE_ARN="$(awslocal sqs get-queue-attributes --queue-url "$INVENTORY_QUEUE_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"
NOTIFICATION_QUEUE_ARN="$(awslocal sqs get-queue-attributes --queue-url "$NOTIFICATION_QUEUE_URL" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"

awslocal sns subscribe --topic-arn "$TOPIC_ARN" --protocol sqs --notification-endpoint "$PAYMENT_QUEUE_ARN" >/dev/null
awslocal sns subscribe --topic-arn "$TOPIC_ARN" --protocol sqs --notification-endpoint "$INVENTORY_QUEUE_ARN" >/dev/null
awslocal sns subscribe --topic-arn "$TOPIC_ARN" --protocol sqs --notification-endpoint "$NOTIFICATION_QUEUE_ARN" >/dev/null

awslocal sqs set-queue-attributes \
  --queue-url "$PAYMENT_QUEUE_URL" \
  --attributes "{\"Policy\":\"{\\\"Version\\\":\\\"2012-10-17\\\",\\\"Statement\\\":[{\\\"Effect\\\":\\\"Allow\\\",\\\"Principal\\\":{\\\"Service\\\":\\\"sns.amazonaws.com\\\"},\\\"Action\\\":\\\"sqs:SendMessage\\\",\\\"Resource\\\":\\\"$PAYMENT_QUEUE_ARN\\\",\\\"Condition\\\":{\\\"ArnEquals\\\":{\\\"aws:SourceArn\\\":\\\"$TOPIC_ARN\\\"}}}]}\"}" \
  >/dev/null

awslocal sqs set-queue-attributes \
  --queue-url "$INVENTORY_QUEUE_URL" \
  --attributes "{\"Policy\":\"{\\\"Version\\\":\\\"2012-10-17\\\",\\\"Statement\\\":[{\\\"Effect\\\":\\\"Allow\\\",\\\"Principal\\\":{\\\"Service\\\":\\\"sns.amazonaws.com\\\"},\\\"Action\\\":\\\"sqs:SendMessage\\\",\\\"Resource\\\":\\\"$INVENTORY_QUEUE_ARN\\\",\\\"Condition\\\":{\\\"ArnEquals\\\":{\\\"aws:SourceArn\\\":\\\"$TOPIC_ARN\\\"}}}]}\"}" \
  >/dev/null

awslocal sqs set-queue-attributes \
  --queue-url "$NOTIFICATION_QUEUE_URL" \
  --attributes "{\"Policy\":\"{\\\"Version\\\":\\\"2012-10-17\\\",\\\"Statement\\\":[{\\\"Effect\\\":\\\"Allow\\\",\\\"Principal\\\":{\\\"Service\\\":\\\"sns.amazonaws.com\\\"},\\\"Action\\\":\\\"sqs:SendMessage\\\",\\\"Resource\\\":\\\"$NOTIFICATION_QUEUE_ARN\\\",\\\"Condition\\\":{\\\"ArnEquals\\\":{\\\"aws:SourceArn\\\":\\\"$TOPIC_ARN\\\"}}}]}\"}" \
  >/dev/null

echo "LocalStack SNS/SQS resources created."
