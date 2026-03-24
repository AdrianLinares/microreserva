import winston from 'winston';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Format for console (Readable, colored)
const consoleFormat = combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    printf(({ level, message, timestamp, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message} `;
        if (metadata && Object.keys(metadata).length > 0) {
            msg += JSON.stringify(metadata);
        }
        return msg;
    })
);

// Format for files (structured JSON for easy ingestion)
const fileFormat = combine(
    timestamp(),
    json()
);

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: fileFormat,
    transports: [
        // Error logs centralizados
        new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
        // All logs centralizados
        new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 5242880, // 5MB
            maxFiles: 5
        }),
    ],
});

// En desarrollo o debug activo, imprimir a consola
if (process.env.NODE_ENV !== 'production' || process.env.DEBUG === 'true') {
    logger.add(
        new winston.transports.Console({
            format: consoleFormat,
            level: process.env.LOG_LEVEL || 'debug'
        })
    );
}

export default logger;
