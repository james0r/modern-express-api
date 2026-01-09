import { createHmac, randomUUID } from "node:crypto";
import { supabase } from "./supabaseClient.js";

function hashIp(ip) {
  const secret = process.env.IP_HASH_SECRET || "dev-secret-change-me";
  return createHmac("sha256", secret).update(ip).digest("hex");
}

function getVisitorId(req, res) {
  // Optional: anonymous cookie id so you can count "unique-ish" visitors without tracking hard identifiers
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/visitor_id=([^;]+)/);
  if (match?.[1]) return match[1];

  const id = randomUUID();
  // Basic cookie set (you can use cookie-parser if you want)
  res.setHeader(
    "Set-Cookie",
    `visitor_id=${id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}`
  );
  return id;
}

function sanitizePath(req) {
  // Don’t store query strings (tokens/emails sometimes sneak in there)
  return req.path;
}

export function visitLogger() {
  return (req, res, next) => {
    const start = Date.now();
    const visitor_id = getVisitorId(req, res);

    res.on("finish", async () => {
      try {
        const duration_ms = Date.now() - start;

        const ip = req.ip || "";
        const ip_hash = ip ? hashIp(ip) : null;

        const payload = {
          method: req.method,
          path: sanitizePath(req),
          status: res.statusCode,
          duration_ms,
          referrer: (req.get("referer") || "").slice(0, 500) || null,
          user_agent: (req.get("user-agent") || "").slice(0, 300) || null,
          ip_hash,
          visitor_id,
        };

        const { error } = await supabase.from("visits").insert(payload);
        if (error) console.error("Supabase visit insert error:", error.message);
      } catch (e) {
        console.error("visit log failed:", e.message);
      }
    });

    next();
  };
}