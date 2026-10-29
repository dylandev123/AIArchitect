import { validateCompositionPreview, type VillaComposition } from '../composition';
import { placementSchema, validateProposal } from './geometry';
export * from './geometry';

/** Manual Studio and automatic assembly use the same final property validator. */
export function validatePlacement(proposal: unknown, input: unknown, villa: VillaComposition) {
  const p=validateProposal(proposal), placement=placementSchema.parse(input);
  validateCompositionPreview({...villa,createdComponents:[...(villa.createdComponents ?? []),{
    id:'creation-preview',candidateId:p.id,candidateVersion:1,status:'experimental',
    originalIntent:p.intent,proposal:p,placement,
  }]});
  return placement;
}
