import type { StyleRenderer, RenderRequest, RenderResult } from "../types.js";

export class MockStyleRenderer implements StyleRenderer {
  async render(request: RenderRequest): Promise<RenderResult> {
    return {
      outputImagePath: request.sourceImagePath,
      renderedAt: new Date().toISOString(),
    };
  }
}