import type { Layer, SessionState } from "../session.js";

export function currentLayer(state: SessionState): Layer | undefined {
  return state.layers.find((layer) => !layer.approved);
}

export function allLayersApproved(state: SessionState): boolean {
  return state.layers.length > 0 && state.layers.every((layer) => layer.approved);
}

export function layerLabel(layer: Layer): string {
  return layer.summary.trim() || layer.name.trim();
}
