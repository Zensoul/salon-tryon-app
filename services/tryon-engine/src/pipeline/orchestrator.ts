import type {
  FaceLandmarkDetector,
  HairSegmenter,
  SkinToneAnalyzer,
  StyleRenderer,
  StyleSpec,
  FaceLandmarks,
  HairMask,
  SkinToneEstimate,
  RenderResult,
} from "./types.js";

export interface TryOnPipelineDeps {
  faceLandmarkDetector: FaceLandmarkDetector;
  hairSegmenter: HairSegmenter;
  skinToneAnalyzer: SkinToneAnalyzer;
  styleRenderer: StyleRenderer;
}

export interface TryOnPipelineOutput {
  landmarks: FaceLandmarks;
  hairMask: HairMask;
  skinTone: SkinToneEstimate;
  render: RenderResult;
}

export class TryOnPipeline {
  constructor(private deps: TryOnPipelineDeps) {}

  async run(sourceImagePath: string, style: StyleSpec): Promise<TryOnPipelineOutput> {
    const landmarks = await this.deps.faceLandmarkDetector.detect(sourceImagePath);

    const [hairMask, skinTone] = await Promise.all([
      this.deps.hairSegmenter.segment(sourceImagePath),
      this.deps.skinToneAnalyzer.analyze(sourceImagePath, landmarks),
    ]);

    const render = await this.deps.styleRenderer.render({
      sourceImagePath,
      landmarks,
      hairMask,
      style,
    });

    return { landmarks, hairMask, skinTone, render };
  }
}