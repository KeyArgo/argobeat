/**
 * @argobeat/engine — Subtle Target-Rate Modulation
 *
 * Re-exports all public functions from the modulation chain module.
 * Import from `@argobeat/engine/modulation` or from the top-level barrel.
 *
 * @module @argobeat/engine/modulation
 */

export {
  buildModulationChain,
  destroyModulationChain,
  updateModulationFrequency,
  updateModulationDepths,
  updateSpectralCenter,
  accelerateHabituationDrift,
} from './chain.js';
