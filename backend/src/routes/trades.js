import express from 'express';
import { executeTrade } from '../services/executionEngine.js';
import { verifySupabaseUser } from '../middleware/supabaseAuth.js';
const router = express.Router();
router.post('/execute', verifySupabaseUser, async (req, res) => {
  try {
    const result = await executeTrade({ ...req.body, userId: req.user.id });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
export default router;
