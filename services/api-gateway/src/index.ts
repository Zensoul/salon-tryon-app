import "dotenv/config";
import Fastify from "fastify";
import { z } from "zod";

const PORT = Number(process.env.PORT ?? 4000);
const TRYON_ENGINE_URL = process.env.TRYON_ENGINE_URL ?? "http://localhost:4001";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ status: "ok", service: "api-gateway" }));

const startTryOnSchema = z.object({
  sessionId: z.string().min(1),
  sourceImagePath: z.string().min(1),
  style: z.object({
    styleId: z.string(),
    category: z.enum(["hair_color", "hair_style", "makeup_lip", "makeup_eye"]),
    targetColor: z.string().optional(),
    referenceAssetPath: z.string().optional(),
  }),
});

// Orchestration endpoint: telegram-integration will call this instead of
// talking to tryon-engine directly. This is the seam where we'll later
// add database persistence, auth, and multi-channel routing (WhatsApp etc).
app.post("/tryon", async (request, reply) => {
  const parsed = startTryOnSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }

  const response = await fetch(`${TRYON_ENGINE_URL}/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed.data),
  });

  const data = await response.json();
  return reply.status(response.status).send(data);
});

// Proxy to check job status, so callers only ever need to know about
// api-gateway, never tryon-engine directly.
app.get<{ Params: { jobId: string } }>("/tryon/:jobId", async (request, reply) => {
  const response = await fetch(`${TRYON_ENGINE_URL}/jobs/${request.params.jobId}`);
  const data = await response.json();
  return reply.status(response.status).send(data);
});

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`api-gateway listening on :${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });