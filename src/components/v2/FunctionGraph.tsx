import type { CSSProperties, ReactNode } from "react";
import type { GraphGeometry } from "@/lib/math/graph";

/**
 * SVG function graph (no chart library). Geometry comes pre-computed from the server; the curve draws in
 * with CSS (`.v2-draw`, static under reduced motion). `caption` sits under the plot.
 */
export function FunctionGraph({ graph, ariaLabel, caption }: { graph: GraphGeometry; ariaLabel: string; caption?: ReactNode }) {
  const { width, height } = graph;
  const style = { "--len": graph.length } as CSSProperties;
  return (
    <figure className="v2-graph">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={ariaLabel} className="ltr">
        <defs>
          <linearGradient id="v2-graph-stroke" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor="rgb(var(--accent-cyan))" />
            <stop offset="1" stopColor="rgb(var(--primary))" />
          </linearGradient>
        </defs>
        <g className="v2-graph-grid">
          {Array.from({ length: 7 }, (_, i) => (
            <line key={`v${i}`} x1={(width / 6) * i} x2={(width / 6) * i} y1="0" y2={height} />
          ))}
          {Array.from({ length: 5 }, (_, i) => (
            <line key={`h${i}`} x1="0" x2={width} y1={(height / 4) * i} y2={(height / 4) * i} />
          ))}
        </g>
        {graph.xAxisY !== null ? <line className="v2-graph-axis" x1="0" x2={width} y1={graph.xAxisY} y2={graph.xAxisY} /> : null}
        {graph.yAxisX !== null ? <line className="v2-graph-axis" x1={graph.yAxisX} x2={graph.yAxisX} y1="0" y2={height} /> : null}
        <path className="v2-graph-curve v2-draw" d={graph.path} style={style} />
        {graph.min ? (
          <g className="v2-graph-min">
            <line x1={graph.min.cx} x2={graph.min.cx} y1={graph.min.cy} y2={graph.xAxisY ?? height} />
            <circle cx={graph.min.cx} cy={graph.min.cy} r="5" />
          </g>
        ) : null}
      </svg>
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}
