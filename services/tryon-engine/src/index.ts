import Fastify from "fastify";
import multipart from "@fastify/multipart";
import { z } from "zod";
import { TryOnPipeline } from "./pipeline/orchestrator.js";
import { MockFaceLandmarkDetector } from "./pipeline/mock/faceLandmarkDetector.js";
import { MockHairSegmenter } from "./pipeline/mock/hairSegmenter.js";
import { MockSkinToneAnalyzer } from "./pipeline/mock/skinToneAnalyzer.js";
import { MockStyleRenderer } from "./pipeline/mock/styleRenderer.js";
import { InMemoryJobStore } from "./jobs/jobStore.js";

const PORT = Number(process.env.PORT ?? 4001);

const app = Fastify({ logger: true });
await app.register(multipart);

const pipeline = new TryOnPipeline({
  faceLandmarkDetector: new MockFaceLandmarkDetector(),
  hairSegmenter: new MockHairSegmenter(),
  skinToneAnalyzer: new MockSkinToneAnalyzer(),
  styleRenderer: new MockStyleRenderer(),
});

const jobStore = new InMemoryJobStore();

app.get("/health", async () => ({ status: "ok", service: "tryon-engine" }));

const submitJobSchema = z.object({
  sessionId: z.string().min(1),
  sourceImagePath: z.string().min(1),
  style: z.object({
    styleId: z.string(),
    category: z.enum(["hair_color", "hair_style", "makeup_lip", "makeup_eye"]),
    targetColor: z.string().optional(),
    referenceAssetPath: z.string().optional(),
  }),
});

app.post("/jobs", async (request, reply) => {
  const parsed = submitJobSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.status(400).send({ error: parsed.error.flatten() });
  }
  const { sessionId, sourceImagePath, style } = parsed.data;

  const job = jobStore.create(sessionId);
  jobStore.update(job.id, { status: "processing" });

  pipeline
    .run(sourceImagePath, style)
    .then((result) => {
      jobStore.update(job.id, { status: "completed", result });
    })
    .catch((err: Error) => {
      jobStore.update(job.id, { status: "failed", error: err.message });
    });

  return reply.status(202).send({ jobId: job.id, status: "processing" });
});

app.get<{ Params: { jobId: string } }>("/jobs/:jobId", async (request, reply) => {
  const job = jobStore.get(request.params.jobId);
  if (!job) {
    return reply.status(404).send({ error: "job not found" });
  }
  return job;
});

app
  .listen({ port: PORT, host: "0.0.0.0" })
  .then(() => app.log.info(`tryon-engine listening on :${PORT}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });