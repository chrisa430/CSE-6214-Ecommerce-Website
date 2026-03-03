/**
 * @fileoverview Configures a Winston structured logger with colorized console output.
 * @module logger.ts
 * @author Darrell Hobson
 * @Date 2026.02.28
 */
import winston from "winston";

const { combine, timestamp, printf, colorize, errors } = winston.format;

const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}] ${stack || message}`;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  format: combine(
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    errors({ stack: true }),
    colorize(),
    logFormat
  ),
  transports: [new winston.transports.Console()],
});
