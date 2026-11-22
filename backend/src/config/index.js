import dotenv from 'dotenv';

dotenv.config();

// Development fallback secret if JWT_SECRET is not provided in environment variables
const defaultDevSecret = 'hivemart_dev_jwt_secret_9f83b27e6a104c8f912b5e093d6a78';

if (!process.env.JWT_SECRET && process.env.NODE_ENV !== 'production') {
  console.warn(
    '[WARN] JWT_SECRET is not set in environment variables. Using development fallback secret.\n' +
    'To generate a secure key, run: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
  );
}

export const config = {
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || defaultDevSecret,
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
  },
};

export default config;
