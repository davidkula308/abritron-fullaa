import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import tradesRouter from './routes/trades.js';
import aiRouter from './routes/ai.js';

dotenv.config();
const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60000, max: 100 }));

app.get('/', (_, res) => res.json({ status: 'Arbitron AI Backend Running' }));
app.use('/api/trades', tradesRouter);
app.use('/api/ai', aiRouter);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Backend running on ${PORT}`));
