import { Fragment, type ReactNode } from "react";

/** Like `fmt`, but placeholders may be React nodes (e.g. server-rendered math inside a translated sentence). */
export function rich(template: string, parts: Record<string, ReactNode>): ReactNode {
  const pieces = template.split(/(\{\w+\})/g);
  return pieces.map((piece, index) => {
    const match = /^\{(\w+)\}$/.exec(piece);
    if (match && match[1] in parts) return <Fragment key={index}>{parts[match[1]]}</Fragment>;
    return piece ? <Fragment key={index}>{piece}</Fragment> : null;
  });
}
