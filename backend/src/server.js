import app from './app.js';
import config from './config/index.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  console.log(`HiveMart API server running on port ${PORT} in ${config.nodeEnv} mode`);
});

// Graceful shutdown handling
const handleShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

export default server;

