export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface TryOnJobRequest {
  sessionId: string;
  sourceImageUrl: string;
  styleId: string;
}

export interface TryOnJobResult {
  jobId: string;
  sessionId: string;
  styleId: string;
  status: JobStatus;
  outputImageUrl?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}