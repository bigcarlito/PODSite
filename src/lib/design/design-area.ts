// Plain types/constants only (no "server-only") — shared between the
// server-side compositor and the client-side design-area editor UI.

export type DesignArea = { x: number; y: number; width: number; height: number };

/** Used when a MockupScene has no designArea set yet — roughly a centered
 *  chest-print area, so generation still works before anyone's configured
 *  the rectangle via the design-area editor. */
export const DEFAULT_DESIGN_AREA: DesignArea = { x: 0.32, y: 0.22, width: 0.36, height: 0.42 };
