import pg from 'pg';
import dotenv from 'dotenv';
import logger from './logger.js';

dotenv.config();

const { Pool } = pg;

// Use the standard corporate connection string or host/user/pass properties
// Usually read from DATABASE_URL
export const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' && process.env.DB_SSL !== 'false'
        ? { rejectUnauthorized: false }
        : false, // For local or secure internal networks SSL might be disabled
    max: 20, // max number of connection can be open to database
    idleTimeoutMillis: 30000 // how long a client is allowed to remain idle before being closed
});

pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle database client', err);
});

export const query = (text: string, params?: any[]) => {
    return pool.query(text, params);
};
