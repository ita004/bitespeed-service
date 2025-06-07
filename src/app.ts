import express from 'express';
import { Request, Response } from 'express';
import dotenv from 'dotenv';
import identifyRouter from './routes/identify';

dotenv.config();

// Create the Express application
const app = express();

// Middleware for parsing JSON bodies
app.use(express.json());

// Mount the router at the /identify path
app.use('/identify', identifyRouter);

// Error handling middleware
app.use((err: Error, req: Request, res: Response) => {
  res.status((err as any).status || 500).json({ error: err.message });
});

export default app;
