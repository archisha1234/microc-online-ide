import { Router, Response } from 'express';
import { pool } from '../db/index';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { Kafka } from 'kafkajs';

const router = Router();
const kafka = new Kafka({ clientId: 'backend', brokers: ['localhost:9092'] });
const producer = kafka.producer();

// Save snippet
router.post('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { title, microc_code, c_code } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO snippets (user_id, title, microc_code, c_code) VALUES ($1, $2, $3, $4) RETURNING *',
      [req.userId, title, microc_code, c_code]
    );
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Get my snippets
router.get('/', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query(
      'SELECT * FROM snippets WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Get snippet by id (shareable)
router.get('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const result = await pool.query('SELECT * FROM snippets WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(result.rows[0]);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Submit for execution
router.post('/submit', authMiddleware, async (req: AuthRequest, res: Response) => {
  const { c_code, snippet_id } = req.body;
  try {
    await producer.connect();
    await producer.send({
      topic: 'code-submissions',
      messages: [
        {
          key: snippet_id,
          value: JSON.stringify({ submissionId: snippet_id, cCode: c_code, timestamp: Date.now() }),
        },
      ],
    });
    await producer.disconnect();
    res.json({ status: 'queued', submissionId: snippet_id });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;