import { Kafka } from 'kafkajs';
import Redis from 'ioredis';

const kafka = new Kafka({
  clientId: 'microc-judge',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'judge-group' });
const producer = kafka.producer();
const redis = new Redis({ host: 'localhost', port: 6379 });

interface Submission {
  submissionId: string;
  cCode: string;
  userId?: string;
  timestamp: number;
}

interface TestCase {
  input: string;
  expectedOutput: string;
}

// Simple test cases for now
const TEST_CASES: TestCase[] = [
  { input: '', expectedOutput: '' },
];

function judgeOutput(actual: string, expected: string): boolean {
  return actual.trim() === expected.trim();
}

async function processSubmission(submission: Submission) {
  const { submissionId, userId } = submission;

  // Store result in Redis
  await redis.hset(`submission:${submissionId}`, {
    status: 'processing',
    timestamp: submission.timestamp,
    userId: userId || 'anonymous',
  });

  // Simulate judging (actual execution happens in runner)
  const score = 100;
  const status = 'accepted';

  // Update submission result
  await redis.hset(`submission:${submissionId}`, {
    status,
    score,
    completedAt: Date.now(),
  });

  // Update leaderboard
  if (userId) {
    await redis.zadd('leaderboard', score, userId);
  }

  console.log(`Judged ${submissionId}: ${status} (${score} pts)`);

  // Publish result
  await producer.send({
    topic: 'submission-results',
    messages: [
      {
        key: submissionId,
        value: JSON.stringify({ submissionId, status, score }),
      },
    ],
  });
}

async function startJudge() {
  await consumer.connect();
  await producer.connect();

  await consumer.subscribe({ topic: 'code-submissions', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const submission = JSON.parse(message.value.toString());
      await processSubmission(submission);
    },
  });

  console.log('Judge service running...');
}

startJudge().catch(console.error);