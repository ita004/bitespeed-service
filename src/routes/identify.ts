// src/routes/identify.ts
import express, { Request, Response, NextFunction } from 'express';
import { identify } from '../services/identity.service';
import { validateIdentifyInput, IdentifyInput } from '../utils/validation';
import { logger } from '../utils/logger';     // ← import Pino here

const router = express.Router();

router.post('/', (req: Request, res: Response, next: NextFunction) => {
  let input: IdentifyInput;
  try {
    input = validateIdentifyInput(req.body);
    logger.info({ input }, 'POST /identify payload validated');
  } catch (err: any) {
    logger.warn({ err }, 'Validation failed for /identify');
    return res.status(400).json({ error: err.errors?.[0]?.message || err.message });
  }

  identify(input)
    .then((result) => {
      res.json(result);
    })
    .catch((err) => {
      logger.error({ err }, 'POST /identify error');
      next(err);
    });
});

export default router;
