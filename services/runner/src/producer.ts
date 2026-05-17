import { Kafka } from 'kafkajs';

const kafka = new Kafka({
  clientId: 'microc-producer',
  brokers: ['localhost:9092'],
});

const producer = kafka.producer();

export async function submitCode(submissionId: string, cCode: string) {
  await producer.connect();
  await producer.send({
    topic: 'code-submissions',
    messages: [
      {
        key: submissionId,
        value: JSON.stringify({ submissionId, cCode, timestamp: Date.now() }),
      },
    ],
  });
  await producer.disconnect();
  console.log(`Submitted: ${submissionId}`);
}