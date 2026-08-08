import { randomUUID } from "node:crypto";
import type { TryOnPipelineOutput } from "../pipeline/orchestrator.js";

export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface TryOnJob {
  id: string;
  sessionId: string;
  status: JobStatus;
  result?: TryOnPipelineOutput;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export class InMemoryJobStore {
  private jobs = new Map<string, TryOnJob>();

  create(sessionId: string): TryOnJob {
    const now = new Date().toISOString();
    const job: TryOnJob = {
      id: randomUUID(),
      sessionId,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return job;
  }

  get(jobId: string): TryOnJob | undefined {
    return this.jobs.get(jobId);
  }

  update(jobId: string, patch: Partial<TryOnJob>): TryOnJob | undefined {
    const existing = this.jobs.get(jobId);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(jobId, updated);
    return updated;
  }
}