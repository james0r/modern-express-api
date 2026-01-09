import 'dotenv/config'
import express from 'express';
import cors from 'cors'
import helmet from 'helmet';
import morgan from 'morgan'
import { z } from 'zod'
import { validate } from './lib/validate.js'
import { visitLogger } from "./lib/logging.js";
import { requireApiKey } from './lib/auth.js';
import path from "path";
import { fileURLToPath } from "url";
import twig from 'twig';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express()

app.use(express.static(path.join(__dirname, "views")));
const isDev = process.env.NODE_ENV !== "production";
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
          ...(isDev ? ["'unsafe-inline'"] : []),
        ],
        connectSrc: [
          "'self'",
          "ws://localhost:3001",
          "ws://127.0.0.1:3001",
          "http://localhost:3001",
          "http://127.0.0.1:3001",
        ],
      },
    },
  })
);
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(visitLogger());

// Set the view engine to twig
app.set('view engine', 'twig');
twig.cache(false);
app.disable("view cache");

// Optional: Configure twig options globally (e.g., caching, strict variables)
app.set('twig options', {
  allowAsync: true, // Allows asynchronous compiling
  strict_variables: false
});

async function fetchJson(url, { timeoutMs = 6000 } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "accept": "application/json" }
    })

    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeout)
  }
}

const QuoteQuerySchema = z.object({
  maxLength: z
    .coerce
    .number()
    .int()
    .min(10)
    .max(300)
    .optional(),
});

// Define a route to render the template
app.get('/', (req, res) => {
  res.render('index', {
    title: 'Hey',
    message: 'Hello there!',
    data: 'This is some data passed to the template'
  });
});

app.get(
  '/api/quote',
  validate({ query: QuoteQuerySchema }),
  requireApiKey,
  async (req, res, next) => {
    try {
      const data = await fetchJson('https://dummyjson.com/quotes/random', {
        timeoutMs: 5000
      });

      res.json({
        id: data.id,
        quote: data.quote,
        author: data.author,
        source: 'dummyjson'
      })
    } catch (error) {
      next(error);
    }
  })

app.use((err, req, res, next) => {
  const isTimeout =
    err?.name === "AbortError" || String(err?.message).includes("aborted");

  const status = isTimeout ? 504 : 502;

  res.status(status).json({
    error: isTimeout ? "Upstream API timed out" : "Upstream API failed",
    detail: process.env.NODE_ENV === "production" ? undefined : err.message,
  });
});

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
})