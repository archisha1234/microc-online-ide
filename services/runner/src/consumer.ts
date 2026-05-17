import { Kafka } from 'kafkajs';
import { exec } from 'child_process';
import { writeFileSync, mkdirSync } from 'fs';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);
const kafka = new Kafka({
  clientId: 'microc-consumer',
  brokers: ['localhost:9092'],
});

const consumer = kafka.consumer({ groupId: 'runner-group' });

async function executeCode(submissionId: string, cCode: string): Promise<string> {
  const dir = `/tmp/${submissionId}`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'main.c'), cCode);

    const { stdout, stderr } = await execAsync(
      `& "C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe" run --rm -v ${dir}:/code -w /code --memory=64m --cpus=0.5 gcc:latest sh -c "gcc main.c -o main && ./main"`,
      { timeout: 10000 }
    );

    return stdout || stderr;
  } catch (e: any) {
    return `Error: ${e.message}`;
  }
}

async function startConsumer() {
  await consumer.connect();
  await consumer.subscribe({ topic: 'code-submissions', fromBeginning: false });

  await consumer.run({
    eachMessage: async ({ message }) => {
      if (!message.value) return;
      const { submissionId, cCode } = JSON.parse(message.value.toString());
      console.log(`Running: ${submissionId}`);
      const output = await executeCode(submissionId, cCode);
      console.log(`Output: ${output}`);
    },
  });
}

startConsumer().catch(console.error);