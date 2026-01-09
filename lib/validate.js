import { z } from 'zod'

export function validate({ query, params, body } = {}) {
  return (req, res, next) => {
    try {
      req.validated = req.validated || {};

      if (query) req.validated.query = query.parse(req.query);
      if (params) req.validated.params = params.parse(req.params);
      if (body) req.validated.body = body.parse(req.body);

      next();
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          error: "Validation failed",
          issues: err.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        });
      }
      next(err);
    }
  };
}