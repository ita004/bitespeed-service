import app from './app';
const port = process.env.PORT || 3000;
import { logger } from './utils/logger';

app.listen(port, () => {
  logger.info(`Listening on http://localhost:${port}`);
});
