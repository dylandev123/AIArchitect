/**
 * How a tiling roof texture is laid out, so a fitted roof pattern (see `TriMeshPrimitive.uvs`) can be mapped onto
 * it joint-for-joint: how many units and courses one repeat holds, and where in the repeat a joint falls.
 */
export interface PatternGrid {
  cols: number;
  rows: number;
  /** Offset, in modules, from the repeat's lower-left corner to the first joint: [unit, course]. */
  phase?: readonly [number, number];
}

/**
 * Texture coordinates for a mesh carrying fitted pattern coordinates. On a gridded texture one module maps onto
 * exactly one texture unit/course, so the plane's whole number of courses stays whole; on any other texture the
 * modules are laid out in metres at the texture's own scale.
 */
export function fittedTextureUvs(uvs: readonly number[], module: readonly [number, number], tile: number, grid?: PatternGrid): Float32Array {
  const out = new Float32Array(uvs.length);
  const [su, sv] = grid ? [1 / grid.cols, 1 / grid.rows] : [module[0] / tile, module[1] / tile];
  const [pu, pv] = grid?.phase ?? [0, 0];
  for (let i = 0; i < uvs.length; i += 2) {
    out[i] = (uvs[i] + pu) * su;
    out[i + 1] = (uvs[i + 1] + pv) * sv;
  }
  return out;
}
