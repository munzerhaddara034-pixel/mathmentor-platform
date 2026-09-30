/** Turns an `as const` English catalogue into the shape every locale must match (string leaves). */
export type Widen<T> = T extends string ? string : T extends readonly (infer U)[] ? readonly Widen<U>[] : { [K in keyof T]: Widen<T[K]> };
