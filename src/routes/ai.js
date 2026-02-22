import express from 'express';
import { runAdaptiveAI } from '../services/aiTrader.js';
import { verifySupabaseUser } from '../middleware/supabaseAuth.js';
const router = express.Router();
router.post('/trade', verifySupabaseUser, async (req, res) => {
  const result = await runAdaptiveAI(req.body.symbol || 'XAUUSD');
  res.json(result);
});
export default router;
