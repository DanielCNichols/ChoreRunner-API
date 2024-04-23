const PORT = process.env.PORT || 8000
const NODE_ENV = process.env.NODE_ENV || 'development'
const CLIENT_ORIGIN =  process.env.CLIENT_ORIGIN || 'http://localhost:3000'
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://dunder_mifflin@localhost/chorerunner'
const TEST_DATABASE_URL =  process.env.TEST_DATABASE_URL || 'postgresql://dunder_mifflin@localhost/chorerunner-test'
const JWT_SECRET =  process.env.JWT_SECRET || 'chorerunner-jwt-secret'
const JWT_EXPIRY = process.env.JWT_EXPIRY || '3h'

export {
  PORT,
  NODE_ENV,
  CLIENT_ORIGIN,
  DATABASE_URL,
  TEST_DATABASE_URL,
  JWT_SECRET,
  JWT_EXPIRY
};
