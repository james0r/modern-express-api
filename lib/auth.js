import { z } from 'zod'

const EnvSchema = z.object({
  PORT: z.string().optional(),
  EXPRESS_API_KEY: z.string().min(1, "API_KEY is required"),
  NODE_ENV: z.string().optional(),
});

const ENV = EnvSchema.parse(process.env);

export function requireApiKey(req, res, next) {
  const apiKey = req.header('x-api-key')

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' })
  }

  if (apiKey !== ENV.EXPRESS_API_KEY) {
    return res.status(403).json({ error: 'Invalid API key' })
  }

  next()
}