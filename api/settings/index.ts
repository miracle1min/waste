import type { VercelRequest, VercelResponse } from "@vercel/node";
import { checkRateLimit } from "../_lib/rate-limit.js";

// Import all handler logic
import { handleTenants } from "./_handlers/tenants.js";
import { handleUsers } from "./_handlers/users.js";
import { handleConfigs } from "./_handlers/configs.js";
import { handlePersonnel } from "./_handlers/personnel.js";

const VALID_ENTITIES = ["tenants", "users", "configs", "personnel"] as const;
type Entity = typeof VALID_ENTITIES[number];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(200).end();

  if (checkRateLimit(req, res, { name: "settings", maxRequests: 30, windowSeconds: 60 })) return;

  const entity = req.query.entity as string;

  if (!entity || !VALID_ENTITIES.includes(entity as Entity)) {
    return res.status(400).json({
      error: `Parameter 'entity' wajib diisi. Valid: ${VALID_ENTITIES.join(", ")}`,
    });
  }

  switch (entity) {
    case "tenants": return handleTenants(req, res);
    case "users": return handleUsers(req, res);
    case "configs": return handleConfigs(req, res);
    case "personnel": return handlePersonnel(req, res);
  }
}
