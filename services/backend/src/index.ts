import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDB } from './db/index';
import authRoutes from './routes/auth';
import snippetRoutes from './routes/snippets';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/snippets', snippetRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function start() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

start();