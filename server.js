import 'dotenv/config'
import express from 'express';
import cors from 'cors'
import helmet from 'helmet';
import morgan from 'morgan'
import { z } from 'zod'
import { validate } from './lib/validate.js'
import crypto from "crypto";
import { supabase } from "./lib/supabaseClient.js";
import { visitLogger } from "./lib/logging.js";
import { requireApiKey } from './lib/auth.js';

const app = express()

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(visitLogger());
app.use(requireApiKey)

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

app.get(
  '/api/quote',
  validate({ query: QuoteQuerySchema }),
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