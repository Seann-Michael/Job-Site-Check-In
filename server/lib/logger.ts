import pino from "pino";

const level =
  process.env.LOG_LEVEL ||
  (process.env.NODE_ENV === "test" ? "silent" : process.env.NODE_ENV === "production" ? "info" : "debug");

/**
 * Single shared pino logger for the server. All server code must log through
 * this instead of console.* so output is structured JSON in production.
 */
export const logger = pino({
  level,
  base: { service: "local-seo-ranker-api" },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      "authorization",
      "cookie",
      "access_token",
      "refresh_token",
      "password",
    ],
    censor: "[redacted]",
  },
});

export type Logger = typeof logger;
