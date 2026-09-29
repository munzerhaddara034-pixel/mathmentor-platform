import type { GraphPayload } from "./timeline";

/**
 * Optional GeoGebra API hook (future).
 *
 * The interactive player does **not** require GeoGebra credentials.
 * Default rendering is the built-in SVG function plotter (`FunctionGraph`).
 *
 * When a GeoGebra deploy / material id is available, implement `inject`
 * (typically loading https://www.geogebra.org/apps/deployggb.js) and pass
 * the hook into `MathCanvas`. Until then this module stays a typed no-op.
 *
 * Env placeholders (never required):
 * - GEOGEBRA_APP_NAME=graphing
 * - GEOGEBRA_MATERIAL_ID=
 */
export type GeoGebraAppName = "graphing" | "geometry" | "3d" | "classic";

export type GeoGebraHook = {
  enabled: boolean;
  appName?: GeoGebraAppName;
  materialId?: string;
  inject(container: HTMLElement, spec: GraphPayload): Promise<void> | void;
  destroy?(container: HTMLElement): void;
};

export const disabledGeoGebra: GeoGebraHook = {
  enabled: false,
  appName: (process.env.NEXT_PUBLIC_GEOGEBRA_APP_NAME as GeoGebraAppName | undefined) ?? "graphing",
  materialId: process.env.NEXT_PUBLIC_GEOGEBRA_MATERIAL_ID || undefined,
  inject() {
    /* Intentionally empty: SVG / function-plot engine is used instead. */
  },
};

export function getGeoGebraHook(): GeoGebraHook {
  return disabledGeoGebra;
}
