/**
 * Audio file manifest — maps categories to available audio files.
 *
 * Files are stored in /audio/soundscapes/{category}/ and /audio/music/shared/
 */

import type { SoundscapeCategory, Mood } from '../types.js';

export interface AudioTrack {
  id: string;
  name: string;
  file: string;  // filename within the category directory
}

// Soundscape audio files per category
export const SOUNDSCAPE_TRACKS: Record<SoundscapeCategory, AudioTrack[]> = {
  rain: [
    { id: 'rain-noise', name: 'Steady Rain', file: 'rain-noise.mp3' },
    { id: 'rain-spectacular', name: 'Wide Rain', file: 'rain-spectacular.mp3' },
    { id: 'rain-thunderstorm', name: 'Thunderstorm Rain', file: 'thunderstorm-rain-loop.mp3' },
    { id: 'rain-wind-chimes', name: 'Rain & Wind Chimes', file: 'rain-wind-chimes.mp3' },
    { id: 'rain-thunder-ambience', name: 'Thunder & Rain Ambience', file: 'thunder-rain-ambience.mp3' },
  ],
  ocean: [
    { id: 'ocean-gentle-beach', name: 'Gentle Beach Waves', file: 'gentle-waves-beach.mp3' },
    { id: 'ocean-waves', name: 'Ocean Waves', file: 'ocean-waves.mp3' },
    { id: 'ocean-zen-waves', name: 'Zen Ocean Waves', file: 'zen-ocean-waves.mp3' },
    { id: 'ocean-chill-coast', name: 'Chill Coast Birds', file: 'chill-coast-birds.mp3' },
    { id: 'ocean-waves-big', name: 'Big Lagoon Waves', file: 'ocean-waves-big.mp3' },
    { id: 'ocean-white-beach', name: 'White Beach Waves', file: 'ocean-white-beach.mp3' },
    { id: 'ocean-whales', name: 'Whale Song', file: 'whale-group.mp3' },
    { id: 'ocean-crashing-pacific', name: 'Pacific Crashing Waves', file: 'crashing-waves-pacific.mp3' },
  ],
  forest: [
    { id: 'forest-night-ambience', name: 'Forest Night', file: 'forest-night-ambience.mp3' },
    { id: 'forest-birds-branches', name: 'Forest Birds', file: 'forest-birds-branches.mp3' },
    { id: 'forest-cicadas', name: 'Forest Night Cicadas', file: 'forest-night-cicadas.mp3' },
    { id: 'forest-night-crickets', name: 'Night Crickets', file: 'night-crickets.mp3' },
    { id: 'forest-spring', name: 'Forest Spring', file: 'forest-spring.mp3' },
    { id: 'forest-night-owls', name: 'Night Owls', file: 'night-owls.mp3' },
    { id: 'forest-crickets-night', name: 'Cricket Ambience', file: 'crickets-night.mp3' },
    { id: 'forest-morning-birds', name: 'Morning Birds Concert', file: 'morning-birds-concert.mp3' },
    { id: 'forest-night-ruins', name: 'Night Ruins', file: 'night-ruins.mp3' },
    { id: 'forest-night-owls-fire', name: 'Night Owls & Fire', file: 'night-owls-fire.mp3' },
  ],
  cafe: [
    { id: 'cafe-ambience', name: 'Coffee Shop Ambience', file: 'coffee-shop-ambience.mp3' },
    { id: 'cafe-northtown', name: 'Coffee Shop', file: 'coffee-shop-northtown.mp3' },
    { id: 'cafe-six-people', name: 'Small Cafe', file: 'coffee-shop-6people.mp3' },
    { id: 'cafe-coffeehouse', name: 'Coffeehouse', file: 'coffeehouse-ambience.mp3' },
  ],
  fire: [
    { id: 'fire-fireplace', name: 'Inside Fireplace', file: 'inside-fireplace.mp3' },
    { id: 'fire-crackling', name: 'Crackling Fire', file: 'crackling-fire.mp3' },
    { id: 'fire-campfire-bush', name: 'Australian Bush Campfire', file: 'campfire-bush.mp3' },
    { id: 'fire-hearthfire', name: 'Hearthfire', file: 'hearthfire.mp3' },
    { id: 'fire-forest', name: 'Forest Fire', file: 'fire-forest.mp3' },
  ],
  space: [
    { id: 'space-atmospheric-c', name: 'Atmospheric Drone', file: 'atmospheric-C.mp3' },
    { id: 'space-station-drone', name: 'Space Station Drone', file: 'space-station-drone.mp3' },
    { id: 'space-eternity', name: 'Sound of Eternity', file: 'sound-of-eternity.mp3' },
    { id: 'space-ambient-soft', name: 'Soft Ambient', file: 'ambient-soft.mp3' },
    { id: 'space-deep-drone', name: 'Deep Space Drone', file: 'deep-space-drone.mp3' },
    { id: 'space-dark-matter', name: 'Dark Matter Drone', file: 'dark-matter-drone.mp3' },
    { id: 'space-void', name: 'Void Texture', file: 'void-texture.mp3' },
    { id: 'space-low-freq', name: 'Low Frequency Bed', file: 'low-frequency-bed.mp3' },
  ],
  stream: [
    { id: 'stream-gentle', name: 'Gentle Stream', file: 'gentle-stream.mp3' },
    { id: 'stream-trickling', name: 'Trickling Stream', file: 'trickling-stream.mp3' },
    { id: 'stream-creek', name: 'Creek', file: 'creek-loop.mp3' },
    { id: 'stream-close', name: 'Stream Up Close', file: 'stream-up-close.mp3' },
    { id: 'stream-babbling-brook', name: 'Babbling Brook', file: 'babbling-brook.mp3' },
    { id: 'stream-flowing-river', name: 'Flowing River', file: 'flowing-river.mp3' },
    { id: 'stream-water-noise', name: 'Stream Water', file: 'stream-water.mp3' },
    { id: 'stream-waterfall', name: 'Waterfall', file: 'waterfall.mp3' },
    { id: 'stream-river-ambiance', name: 'River Ambiance', file: 'river-ambiance.mp3' },
    { id: 'stream-forest-stream', name: 'Forest Stream', file: 'forest-stream.mp3' },
    { id: 'stream-waterstream-birds', name: 'Stream & Birds', file: 'waterstream-birds.mp3' },
  ],
  wind: [
    { id: 'wind-gentle-breeze', name: 'Gentle Breeze', file: 'gentle-breeze.mp3' },
    { id: 'wind-through-trees', name: 'Wind Through Trees', file: 'wind-through-trees.mp3' },
    { id: 'wind-coastal', name: 'Coastal Wind', file: 'coastal-wind.mp3' },
    { id: 'wind-desert', name: 'Desert Wind', file: 'desert-wind.mp3' },
    { id: 'wind-night-breeze', name: 'Night Breeze', file: 'night-breeze.mp3' },
    { id: 'wind-chimes-breeze', name: 'Wind Chimes Breeze', file: 'wind-chimes-breeze.mp3' },
    { id: 'wind-forest-gusts', name: 'Forest Wind Gusts', file: 'forest-wind-gusts.mp3' },
    { id: 'wind-mountain', name: 'Mountain Wind', file: 'mountain-wind.mp3' },
    { id: 'wind-through-pines', name: 'Wind Through Pines', file: 'wind-through-pines.mp3' },
    { id: 'wind-prairie', name: 'Prairie Wind', file: 'prairie-wind.mp3' },
    { id: 'wind-canyon', name: 'Canyon Wind', file: 'canyon-wind.mp3' },
    { id: 'wind-evening-calm', name: 'Evening Wind', file: 'evening-wind-calm.mp3' },
    { id: 'wind-winter', name: 'Winter Wind', file: 'winter-wind.mp3' },
    { id: 'wind-hilltop', name: 'Hilltop Breeze', file: 'hilltop-breeze.mp3' },
    { id: 'wind-bamboo', name: 'Bamboo Wind', file: 'bamboo-wind.mp3' },
    { id: 'wind-storm-approach', name: 'Storm Approach', file: 'storm-approach-wind.mp3' },
    { id: 'wind-valley', name: 'Valley Wind', file: 'valley-wind.mp3' },
    { id: 'wind-ocean-cliff', name: 'Ocean Cliff Wind', file: 'ocean-cliff-wind.mp3' },
  ],
  thunder: [
    { id: 'thunder-straget', name: 'Thunder', file: 'thunder-straget.mp3' },
    { id: 'thunder-rain-long', name: 'Thunder & Rain', file: 'thunder-rain-long.mp3' },
  ],
  gongs: [
    { id: 'gongs-garden', name: 'Gong Garden', file: 'gong-garden.mp3' },
    { id: 'gongs-bowl-deep', name: 'Deep Singing Bowl', file: 'singing-bowl-deep.mp3' },
    { id: 'gongs-bowl-tibetan', name: 'Tibetan Singing Bowl', file: 'singing-bowl-tibetan.mp3' },
    { id: 'gongs-bowl-eflat', name: 'E-Flat Singing Bowl', file: 'singing-bowl-eflat.mp3' },
    { id: 'gongs-wind-chime', name: 'Wind Chimes', file: 'wind-chime.mp3' },
    { id: 'gongs-wind-chime-outdoor', name: 'Outdoor Wind Chimes', file: 'wind-chime-outdoor.mp3' },
    { id: 'gongs-binaural-chimes', name: 'Binaural Wind Chimes', file: 'binaural-wind-chimes.mp3' },
    { id: 'gongs-bowl-small', name: 'Small Singing Bowl', file: 'singing-bowl-small.mp3' },
    { id: 'gongs-theta-drone', name: 'Theta Drone', file: 'theta-drone.mp3' },
    { id: 'gongs-crystal-drone', name: 'Crystal Drone', file: 'crystal-drone.mp3' },
  ],
  jungle: [
    { id: 'jungle-frog-forest', name: 'Frog Forest', file: 'frog-forest.mp3' },
    { id: 'jungle-frog-forest-hq', name: 'Frog Forest HQ', file: 'frog-forest-hq.mp3' },
    { id: 'jungle-night', name: 'Jungle Night', file: 'jungle-night.mp3' },
  ],
  noise: [
    { id: 'noise-brown', name: 'Brown Noise', file: 'brown-noise.mp3' },
    { id: 'noise-pink', name: 'Pink Noise', file: 'pink-noise.mp3' },
    { id: 'noise-white', name: 'White Noise', file: 'white-noise.mp3' },
    { id: 'noise-fan', name: 'Fan Hum', file: 'fan-hum.mp3' },
  ],
  birds: [
    { id: 'birds-morning', name: 'Morning Birdsong', file: 'morning-birdsong.mp3' },
    { id: 'birds-forest-dawn', name: 'Forest Dawn', file: 'forest-dawn.mp3' },
  ],
  cave: [
    { id: 'cave-resonance', name: 'Cave Resonance', file: 'cave-resonance.mp3' },
  ],
};

const SHARED_MUSIC_LIBRARY: Record<string, AudioTrack> = {
  // MiniMax hero tracks — v1 originals
  'ember-circuit': { id: 'ember-circuit', name: 'Ember Circuit', file: 'shared/ember-circuit.mp3' },
  'night-shift-current': { id: 'night-shift-current', name: 'Night Shift Current', file: 'shared/night-shift-current.mp3' },
  'tidal-exhale': { id: 'tidal-exhale', name: 'Tidal Exhale', file: 'shared/tidal-exhale.mp3' },
  'moonwell-drift': { id: 'moonwell-drift', name: 'Moonwell Drift', file: 'shared/moonwell-drift.mp3' },
  'quiet-orbit': { id: 'quiet-orbit', name: 'Quiet Orbit', file: 'shared/quiet-orbit.mp3' },
  // MiniMax hero tracks — v2 batch 1 (generated 2026-05-02)
  'ember-focus-ii': { id: 'ember-focus-ii', name: 'Ember Focus II', file: 'shared/ember-focus-ii.mp3' },
  'signal-clear': { id: 'signal-clear', name: 'Signal Clear', file: 'shared/signal-clear.mp3' },
  'deep-current-ii': { id: 'deep-current-ii', name: 'Deep Current II', file: 'shared/deep-current-ii.mp3' },
  'late-session': { id: 'late-session', name: 'Late Session', file: 'shared/late-session.mp3' },
  'afternoon-open': { id: 'afternoon-open', name: 'Afternoon Open', file: 'shared/afternoon-open.mp3' },
  'drift-easy': { id: 'drift-easy', name: 'Drift Easy', file: 'shared/drift-easy.mp3' },
  'gong-horizon': { id: 'gong-horizon', name: 'Gong Horizon', file: 'shared/gong-horizon.mp3' },
  'bowl-breath': { id: 'bowl-breath', name: 'Bowl Breath', file: 'shared/bowl-breath.mp3' },
  'still-water': { id: 'still-water', name: 'Still Water', file: 'shared/still-water.mp3' },
  'quiet-field': { id: 'quiet-field', name: 'Quiet Field', file: 'shared/quiet-field.mp3' },
  // MiniMax hero tracks — v2 batch 2 (generated 2026-05-02)
  'morning-grid': { id: 'morning-grid', name: 'Morning Grid', file: 'shared/morning-grid.mp3' },
  'steady-state': { id: 'steady-state', name: 'Steady State', file: 'shared/steady-state.mp3' },
  'blue-hour-work': { id: 'blue-hour-work', name: 'Blue Hour Work', file: 'shared/blue-hour-work.mp3' },
  'tunnel-vision': { id: 'tunnel-vision', name: 'Tunnel Vision', file: 'shared/tunnel-vision.mp3' },
  'code-noir': { id: 'code-noir', name: 'Code Noir', file: 'shared/code-noir.mp3' },
  'deep-channel': { id: 'deep-channel', name: 'Deep Channel', file: 'shared/deep-channel.mp3' },
  'golden-hour': { id: 'golden-hour', name: 'Golden Hour', file: 'shared/golden-hour.mp3' },
  'soft-landing': { id: 'soft-landing', name: 'Soft Landing', file: 'shared/soft-landing.mp3' },
  'porch-light': { id: 'porch-light', name: 'Porch Light', file: 'shared/porch-light.mp3' },
  'om-resonance': { id: 'om-resonance', name: 'Om Resonance', file: 'shared/om-resonance.mp3' },
  'crystal-clear': { id: 'crystal-clear', name: 'Crystal Clear', file: 'shared/crystal-clear.mp3' },
  'still-point': { id: 'still-point', name: 'Still Point', file: 'shared/still-point.mp3' },
  // Relax: Creative post-rock (music-2.6 paid, 2026-05-03)
  'unhinged-flow': { id: 'unhinged-flow', name: 'Unhinged Flow', file: 'shared/unhinged-flow.mp3' },
  'lapsed-current': { id: 'lapsed-current', name: 'Lapsed Current', file: 'shared/lapsed-current.mp3' },
  'temple-edge': { id: 'temple-edge', name: 'Temple Edge', file: 'shared/temple-edge.mp3' },
  'forked-current': { id: 'forked-current', name: 'Forked Current', file: 'shared/forked-current.mp3' },
  // Focus batch 2 (music-2.6 paid, 2026-05-03)
  'diurnality-run': { id: 'diurnality-run', name: 'Diurnality Run', file: 'shared/diurnality-run.mp3' },
  'greyed-signal': { id: 'greyed-signal', name: 'Greyed Signal', file: 'shared/greyed-signal.mp3' },
  'cleft-engine': { id: 'cleft-engine', name: 'Cleft Engine', file: 'shared/cleft-engine.mp3' },
  // Deep Work batch 2 — 15 tracks toward 90 min (music-2.6 paid, 2026-05-03)
  'weight-bearing': { id: 'weight-bearing', name: 'Weight Bearing', file: 'shared/weight-bearing.mp3' },
  'stone-circuit': { id: 'stone-circuit', name: 'Stone Circuit', file: 'shared/stone-circuit.mp3' },
  'black-lattice': { id: 'black-lattice', name: 'Black Lattice', file: 'shared/black-lattice.mp3' },
  'grid-state': { id: 'grid-state', name: 'Grid State', file: 'shared/grid-state.mp3' },
  'forge-current': { id: 'forge-current', name: 'Forge Current', file: 'shared/forge-current.mp3' },
  'thermal-run': { id: 'thermal-run', name: 'Thermal Run', file: 'shared/thermal-run.mp3' },
  'iron-resolve': { id: 'iron-resolve', name: 'Iron Resolve', file: 'shared/iron-resolve.mp3' },
  'pressure-front': { id: 'pressure-front', name: 'Pressure Front', file: 'shared/pressure-front.mp3' },
  'undetected-run': { id: 'undetected-run', name: 'Undetected Run', file: 'shared/undetected-run.mp3' },
  'deep-construct': { id: 'deep-construct', name: 'Deep Construct', file: 'shared/deep-construct.mp3' },
  'null-state': { id: 'null-state', name: 'Null State', file: 'shared/null-state.mp3' },
  'sector-nine': { id: 'sector-nine', name: 'Sector Nine', file: 'shared/sector-nine.mp3' },
  'mass-transit': { id: 'mass-transit', name: 'Mass Transit', file: 'shared/mass-transit.mp3' },
  'cold-logic': { id: 'cold-logic', name: 'Cold Logic', file: 'shared/cold-logic.mp3' },
  'vital-engine': { id: 'vital-engine', name: 'Vital Engine', file: 'shared/vital-engine.mp3' },
  // Reference-accurate tracks (2026-05-03)
  // undetected-ii removed — never uploaded to worker (404)
  'vital-pulse-ii': { id: 'vital-pulse-ii', name: 'Vital Pulse II', file: 'shared/vital-pulse-ii.mp3' },
  'amped-signal': { id: 'amped-signal', name: 'Amped Signal', file: 'shared/amped-signal.mp3' },
  'catch-ii': { id: 'catch-ii', name: 'Catch II', file: 'shared/catch-ii.mp3' },
  'underhead-run': { id: 'underhead-run', name: 'Underhead Run', file: 'shared/underhead-run.mp3' },
  'work-current': { id: 'work-current', name: 'Work Current', file: 'shared/work-current.mp3' },
  'dark-matter-ii': { id: 'dark-matter-ii', name: 'Dark Matter II', file: 'shared/dark-matter-ii.mp3' },
  'pressure-wave': { id: 'pressure-wave', name: 'Pressure Wave', file: 'shared/pressure-wave.mp3' },
  'temple-edge-ii': { id: 'temple-edge-ii', name: 'Temple Edge II', file: 'shared/temple-edge-ii.mp3' },
  'unhinged-ii': { id: 'unhinged-ii', name: 'Unhinged II', file: 'shared/unhinged-ii.mp3' },
  'lapsed-ii': { id: 'lapsed-ii', name: 'Lapsed II', file: 'shared/lapsed-ii.mp3' },
  // Batch 1 tracks (2026-05-03)
  'foaming-seas-run': { id: 'foaming-seas-run', name: 'Foaming Seas Run', file: 'shared/foaming-seas-run.mp3' },
  'delicate-focus': { id: 'delicate-focus', name: 'Delicate Focus', file: 'shared/delicate-focus.mp3' },
  'incandescent-run': { id: 'incandescent-run', name: 'Incandescent Run', file: 'shared/incandescent-run.mp3' },
  'solitude-drive': { id: 'solitude-drive', name: 'Solitude Drive', file: 'shared/solitude-drive.mp3' },
  'flight-feathers': { id: 'flight-feathers', name: 'Flight Feathers', file: 'shared/flight-feathers.mp3' },
  'forked-rivers': { id: 'forked-rivers', name: 'Forked Rivers', file: 'shared/forked-rivers.mp3' },
  'gentle-creek-flow': { id: 'gentle-creek-flow', name: 'Gentle Creek Flow', file: 'shared/gentle-creek-flow.mp3' },
  'aegean-drift': { id: 'aegean-drift', name: 'Aegean Drift', file: 'shared/aegean-drift.mp3' },
  'northern-moss': { id: 'northern-moss', name: 'Northern Moss', file: 'shared/northern-moss.mp3' },
  'within-waves': { id: 'within-waves', name: 'Within Waves', file: 'shared/within-waves.mp3' },
  'dusk-signal': { id: 'dusk-signal', name: 'Dusk Signal', file: 'shared/dusk-signal.mp3' },
  'sacred-grove': { id: 'sacred-grove', name: 'Sacred Grove', file: 'shared/sacred-grove.mp3' },
  'crystalline-spirit': { id: 'crystalline-spirit', name: 'Crystalline Spirit', file: 'shared/crystalline-spirit.mp3' },
  'compass-rose': { id: 'compass-rose', name: 'Compass Rose', file: 'shared/compass-rose.mp3' },
  'dusk-flow': { id: 'dusk-flow', name: 'Dusk Flow', file: 'shared/dusk-flow.mp3' },
  'open-field': { id: 'open-field', name: 'Open Field', file: 'shared/open-field.mp3' },
  'silver-rain': { id: 'silver-rain', name: 'Silver Rain', file: 'shared/silver-rain.mp3' },
  'timber-light': { id: 'timber-light', name: 'Timber Light', file: 'shared/timber-light.mp3' },
  'harbour-wind': { id: 'harbour-wind', name: 'Harbour Wind', file: 'shared/harbour-wind.mp3' },
  'ember-drift': { id: 'ember-drift', name: 'Ember Drift', file: 'shared/ember-drift.mp3' },
  'signal-drift': { id: 'signal-drift', name: 'Signal Drift', file: 'shared/signal-drift.mp3' },
  'voltage-run': { id: 'voltage-run', name: 'Voltage Run', file: 'shared/voltage-run.mp3' },
  'iron-wave': { id: 'iron-wave', name: 'Iron Wave', file: 'shared/iron-wave.mp3' },
  'arc-current': { id: 'arc-current', name: 'Arc Current', file: 'shared/arc-current.mp3' },
  'amber-static': { id: 'amber-static', name: 'Amber Static', file: 'shared/amber-static.mp3' },
  'depth-field': { id: 'depth-field', name: 'Depth Field', file: 'shared/depth-field.mp3' },
  // Meditate batch 2 (2026-05-03)
  'breath-space': { id: 'breath-space', name: 'Breath Space', file: 'shared/breath-space.mp3' },
  'still-field': { id: 'still-field', name: 'Still Field', file: 'shared/still-field.mp3' },
  'open-sky': { id: 'open-sky', name: 'Open Sky', file: 'shared/open-sky.mp3' },
  'vessel-calm': { id: 'vessel-calm', name: 'Vessel Calm', file: 'shared/vessel-calm.mp3' },
  'morning-mist': { id: 'morning-mist', name: 'Morning Mist', file: 'shared/morning-mist.mp3' },
  'slow-tide': { id: 'slow-tide', name: 'Slow Tide', file: 'shared/slow-tide.mp3' },
  'amber-light-still': { id: 'amber-light-still', name: 'Amber Light Still', file: 'shared/amber-light-still.mp3' },
  'deep-well': { id: 'deep-well', name: 'Deep Well', file: 'shared/deep-well.mp3' },
  'sacred-breath': { id: 'sacred-breath', name: 'Sacred Breath', file: 'shared/sacred-breath.mp3' },
  // Sleep batch 2 (2026-05-03)
  'glass-water': { id: 'glass-water', name: 'Glass Water', file: 'shared/glass-water.mp3' },
  'fade-gently': { id: 'fade-gently', name: 'Fade Gently', file: 'shared/fade-gently.mp3' },
  'night-glass': { id: 'night-glass', name: 'Night Glass', file: 'shared/night-glass.mp3' },
  'starless': { id: 'starless', name: 'Starless', file: 'shared/starless.mp3' },
  // Focus batch (2026-05-03)
  'north-signal': { id: 'north-signal', name: 'North Signal', file: 'shared/north-signal.mp3' },
  // Sleep batch (2026-05-03)
  'dissolve-slowly': { id: 'dissolve-slowly', name: 'Dissolve Slowly', file: 'shared/dissolve-slowly.mp3' },
  'midnight-glass': { id: 'midnight-glass', name: 'Midnight Glass', file: 'shared/midnight-glass.mp3' },
  'lunar-breath': { id: 'lunar-breath', name: 'Lunar Breath', file: 'shared/lunar-breath.mp3' },
  'drifting-dark': { id: 'drifting-dark', name: 'Drifting Dark', file: 'shared/drifting-dark.mp3' },
  'sleep-current': { id: 'sleep-current', name: 'Sleep Current', file: 'shared/sleep-current.mp3' },
  'evening-descent': { id: 'evening-descent', name: 'Evening Descent', file: 'shared/evening-descent.mp3' },
  'hollow-light': { id: 'hollow-light', name: 'Hollow Light', file: 'shared/hollow-light.mp3' },
  'resting-depth': { id: 'resting-depth', name: 'Resting Depth', file: 'shared/resting-depth.mp3' },
  'night-pool': { id: 'night-pool', name: 'Night Pool', file: 'shared/night-pool.mp3' },
  'between-breaths': { id: 'between-breaths', name: 'Between Breaths', file: 'shared/between-breaths.mp3' },
  'soft-collapse': { id: 'soft-collapse', name: 'Soft Collapse', file: 'shared/soft-collapse.mp3' },
  'tender-void': { id: 'tender-void', name: 'Tender Void', file: 'shared/tender-void.mp3' },
  // HIGH complexity focus replacements (2026-05-03)
  'diurnality-ii': { id: 'diurnality-ii', name: 'Diurnality II', file: 'shared/diurnality-ii.mp3' },
  'coastal-drive': { id: 'coastal-drive', name: 'Coastal Drive', file: 'shared/coastal-drive.mp3' },
  'summit-push': { id: 'summit-push', name: 'Summit Push', file: 'shared/summit-push.mp3' },
  'neural-complex': { id: 'neural-complex', name: 'Neural Complex', file: 'shared/neural-complex.mp3' },
  'fracture-line': { id: 'fracture-line', name: 'Fracture Line', file: 'shared/fracture-line.mp3' },
  // Post-rock / High Neural Effect focus tracks (music-2.6 paid, 2026-05-03)
  'nightdrive-run': { id: 'nightdrive-run', name: 'Nightdrive Run', file: 'shared/nightdrive-run.mp3' },
  'automaton-state': { id: 'automaton-state', name: 'Automaton State', file: 'shared/automaton-state.mp3' },
  'neural-drive': { id: 'neural-drive', name: 'Neural Drive', file: 'shared/neural-drive.mp3' },
  'vital-signal': { id: 'vital-signal', name: 'Vital Signal', file: 'shared/vital-signal.mp3' },
  'catch-release': { id: 'catch-release', name: 'Catch and Release', file: 'shared/catch-release.mp3' },
  'deep-automaton': { id: 'deep-automaton', name: 'Deep Automaton', file: 'shared/deep-automaton.mp3' },
  'flow-state-engine': { id: 'flow-state-engine', name: 'Flow State Engine', file: 'shared/flow-state-engine.mp3' },
  'iron-current': { id: 'iron-current', name: 'Iron Current', file: 'shared/iron-current.mp3' },
  // Local ffmpeg meditation pack — ultra-simple drones (generated 2026-05-03)
  'still-lantern': { id: 'still-lantern', name: 'Still Lantern', file: 'shared/still-lantern.mp3' },
  'breath-circle': { id: 'breath-circle', name: 'Breath Circle', file: 'shared/breath-circle.mp3' },
  'temple-air': { id: 'temple-air', name: 'Temple Air', file: 'shared/temple-air.mp3' },
  // Meditate tracks from meditate.wav reference (2026-05-03)
  'tranquility-drift': { id: 'tranquility-drift', name: 'Tranquility Drift', file: 'shared/tranquility-drift.mp3' },
  'jet-stream-calm': { id: 'jet-stream-calm', name: 'Jet Stream Calm', file: 'shared/jet-stream-calm.mp3' },
  'cloud-dream-still': { id: 'cloud-dream-still', name: 'Cloud Dream Still', file: 'shared/cloud-dream-still.mp3' },
  'lake-of-serenity': { id: 'lake-of-serenity', name: 'Lake of Serenity', file: 'shared/lake-of-serenity.mp3' },
  'inner-sanctum': { id: 'inner-sanctum', name: 'Inner Sanctum', file: 'shared/inner-sanctum.mp3' },
  'compassion-rise': { id: 'compassion-rise', name: 'Compassion Rise', file: 'shared/compassion-rise.mp3' },
  'fade-to-black': { id: 'fade-to-black', name: 'Fade to Black', file: 'shared/fade-to-black.mp3' },
  'dream-gate': { id: 'dream-gate', name: 'Dream Gate', file: 'shared/dream-gate.mp3' },
  'deep-rest': { id: 'deep-rest', name: 'Deep Rest', file: 'shared/deep-rest.mp3' },
  mundane: { id: 'mundane', name: 'Mundane', file: 'shared/mundane.mp3' },
  ramen: { id: 'ramen', name: 'Ramen', file: 'shared/ramen.mp3' },
  ghosts: { id: 'ghosts', name: 'Ghosts', file: 'shared/ghosts.mp3' },
  dreams: { id: 'dreams', name: 'Dreams', file: 'shared/dreams.mp3' },
  love: { id: 'love', name: 'Love', file: 'shared/love.mp3' },
  anxiety: { id: 'anxiety', name: 'Anxiety', file: 'shared/anxiety.mp3' },
  yesterday: { id: 'yesterday', name: 'Yesterday', file: 'shared/yesterday.mp3' },
};

function moodPlaylist(trackIds: string[]): AudioTrack[] {
  return trackIds.map((id) => {
    const track = SHARED_MUSIC_LIBRARY[id];
    if (!track) throw new Error(`Unknown ArgoBeat music track: ${id}`);
    return track;
  });
}

// Music tracks organized by mood. These are shared physical files with
// mood-specific ordering, giving every mood 20+ skip targets without storing
// duplicate MP3s per mood.
export const MUSIC_TRACKS: Record<string, AudioTrack[]> = {
  // Focus: HIGH complexity — reference: foc-index + motivate.wav + learn.wav + work.wav
    // Focus: calm/atmospheric 70-95 BPM — reference: dark patient long-form
  focus: moodPlaylist([
    'greyed-signal',
    'cleft-engine',
    'diurnality-ii',
    'depth-field',
    'signal-drift',
    'arc-current',
    'amber-static',
    'foaming-seas-run',
    'delicate-focus',
    'incandescent-run',
    'flight-feathers',
    'north-signal',
    'catch-ii',
    'catch-release',
    'underhead-run',
    'diurnality-run',
    'morning-grid',
    'steady-state',
    'ember-focus-ii',
    'blue-hour-work',
    'solitude-drive',
    'nightdrive-run',
    'automaton-state',
    'neural-drive',
    'neural-complex',
    'coastal-drive',
    'amped-signal',
    'vital-pulse-ii',
    'vital-signal',
    'vital-engine',
    'undetected-run',
    'mass-transit',
    'ember-circuit',
    'signal-clear',
  ]),
  // Deep Work: reference work.wav + foc-index, sustained 85-100 BPM
    // Deep Work: sustained heavy 72-100 BPM — reference work.wav + foc-index
  deepWork: moodPlaylist([
    'deep-automaton',
    'flow-state-engine',
    'iron-current',
    'deep-current-ii',
    'late-session',
    'tunnel-vision',
    'weight-bearing',
    'stone-circuit',
    'black-lattice',
    'grid-state',
    'forge-current',
    'thermal-run',
    'iron-resolve',
    'pressure-front',
    'deep-construct',
    'null-state',
    'sector-nine',
    'cold-logic',
    'work-current',
    'dark-matter-ii',
    'pressure-wave',
    'voltage-run',
    'fracture-line',
    'iron-wave',
    'summit-push',
    'lapsed-current',
    'lapsed-ii',
    'unhinged-flow',
    'unhinged-ii',
    'deep-channel',
    'code-noir',
    'night-shift-current',
  ]),
  // Relax: reference creative.wav + learn.wav
    // Relax: gentle/acoustic/atmospheric — reference creative.wav + learn.wav
  relax: moodPlaylist([
    'golden-hour',
    'porch-light',
    'forked-rivers',
    'gentle-creek-flow',
    'aegean-drift',
    'northern-moss',
    'within-waves',
    'dusk-signal',
    'sacred-grove',
    'crystalline-spirit',
    'compass-rose',
    'dusk-flow',
    'open-field',
    'silver-rain',
    'timber-light',
    'harbour-wind',
    'ember-drift',
    'forked-current',
    'jet-stream-calm',
    'temple-edge-ii',
    'tidal-exhale',
    'moonwell-drift',
  ]),
  // Meditate: soundscape-only by default (gongs/bowls). Music available if user switches tab.
    // Meditate: soundscape-only by default (gongs/bowls). Music if user switches.
  meditate: moodPlaylist([
    'gong-horizon',
    'bowl-breath',
    'om-resonance',
    'crystal-clear',
    'still-point',
    'tranquility-drift',
    'cloud-dream-still',
    'lake-of-serenity',
    'inner-sanctum',
    'compassion-rise',
    'breath-space',
    'still-field',
    'open-sky',
    'vessel-calm',
    'morning-mist',
    'slow-tide',
    'amber-light-still',
    'deep-well',
    'sacred-breath',
    'still-lantern',
    'breath-circle',
    'temple-air',
    'temple-edge',
    'deep-rest',
  ]),
  // Sleep: soundscape-only — isSoundscapeOnlyMood=true
  // Gentle music available as fallback if user switches to music mode
    // Sleep: soundscape-only — isSoundscapeOnlyMood=true
  sleep: moodPlaylist([
    'still-water',
    'quiet-field',
    'fade-to-black',
    'dream-gate',
    'afternoon-open',
    'drift-easy',
    'soft-landing',
    'dissolve-slowly',
    'midnight-glass',
    'lunar-breath',
    'drifting-dark',
    'sleep-current',
    'evening-descent',
    'hollow-light',
    'resting-depth',
    'night-pool',
    'between-breaths',
    'soft-collapse',
    'tender-void',
    'glass-water',
    'fade-gently',
    'night-glass',
    'starless',
    'quiet-orbit',
  ]),
};


  // motivation: future category — high-energy tracks (100-130 BPM) parked here
  // These are good tracks in the wrong category. Assign when motivation mode ships.
  // nightdrive-run, automaton-state, neural-drive, neural-complex, coastal-drive,
  // amped-signal, vital-pulse-ii, vital-signal, vital-engine, undetected-run,
  // mass-transit, ember-circuit

/** Base URL for soundscape audio files — served from R2 via CF Worker */
export const SOUNDSCAPE_BASE_URL = 'https://argobeat-audio.argobox.workers.dev/soundscapes';

/** Base URL for music audio files — served from R2 via CF Worker */
export const MUSIC_BASE_URL = 'https://argobeat-audio.argobox.workers.dev/music';

/** Get the full URL for a soundscape track */
export function getSoundscapeUrl(category: SoundscapeCategory, filename: string): string {
  return `${SOUNDSCAPE_BASE_URL}/${category}/${filename}`;
}

/** Get the full URL for a music track */
export function getMusicUrl(mood: string, filename: string): string {
  if (filename.includes('/')) {
    return `${MUSIC_BASE_URL}/${filename}`;
  }
  return `${MUSIC_BASE_URL}/${mood}/${filename}`;
}

/** Get a random soundscape track for a category */
export function getRandomSoundscapeTrack(category: SoundscapeCategory): AudioTrack | null {
  const tracks = SOUNDSCAPE_TRACKS[category];
  if (!tracks || tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)];
}

/** Get a random music track for a mood */
export function getRandomMusicTrack(mood: string): AudioTrack | null {
  const tracks = MUSIC_TRACKS[mood];
  if (!tracks || tracks.length === 0) return null;
  return tracks[Math.floor(Math.random() * tracks.length)];
}

// ===========================================================================
// Seamless 30-minute assets (generated 2026-06-01)
// ===========================================================================
//
// A second-generation library of single-file, 30-minute seamless renders.
// Each soundscape category and each music mood has ONE long file instead of a
// pool of short clips, so the engine can hold one ambience for a whole session
// without crossfade seams.
//
// Source: /mnt/AllShare/Argobeat/generated-2026-06-01/{ambients,music}
// Pipeline: tools/ingest-seamless.sh transcodes the raw WAV/FLAC to
//           44.1kHz / stereo / 192 kbps MP3 and uploads to R2 under:
//             soundscapes/<category>/seamless-<slug>.mp3
//             music/seamless/<mood>-30min.mp3
//
// These are kept SEPARATE from SOUNDSCAPE_TRACKS / MUSIC_TRACKS so existing
// playback and tools/argobeat validate-catalog are unaffected. Flip
// USE_SEAMLESS_ASSETS (or wire a runtime flag) to make the managers prefer
// these. Entries are commented out until the matching R2 object is confirmed
// uploaded — uncomment per file as uploads land.

/** Set true once the seamless MP3s are uploaded to R2 to make managers prefer them. */
export const USE_SEAMLESS_ASSETS = false;

/** One seamless 30-min soundscape per category. file is relative to the category dir. */
export const SEAMLESS_SOUNDSCAPE_TRACKS: Partial<Record<SoundscapeCategory, AudioTrack>> = {
  rain:    { id: 'rain-seamless-30m',    name: 'Rain (30 min seamless)',          file: 'seamless-rain.mp3' },
  ocean:   { id: 'ocean-seamless-30m',   name: 'Ocean (30 min seamless)',         file: 'seamless-ocean.mp3' },
  forest:  { id: 'forest-seamless-30m',  name: 'Forest Night (30 min seamless)',  file: 'seamless-night.mp3' },
  cafe:    { id: 'cafe-seamless-30m',    name: 'Workspace (30 min seamless)',     file: 'seamless-work.mp3' },
  fire:    { id: 'fire-seamless-30m',    name: 'Fire (30 min seamless)',          file: 'seamless-fire.mp3' },
  space:   { id: 'space-seamless-30m',   name: 'Space (30 min seamless)',         file: 'seamless-space.mp3' },
  stream:  { id: 'stream-seamless-30m',  name: 'Stream & River (30 min seamless)', file: 'seamless-stream-river.mp3' },
  wind:    { id: 'wind-seamless-30m',    name: 'Open Air (30 min seamless)',      file: 'seamless-outside.mp3' },
  thunder: { id: 'thunder-seamless-30m', name: 'Rain & Thunder (30 min seamless)', file: 'seamless-rain-and-thunder.mp3' },
  gongs:   { id: 'gongs-seamless-30m',   name: 'Gongs (30 min seamless)',         file: 'seamless-gongs.mp3' },
  jungle:  { id: 'jungle-seamless-30m',  name: 'Jungle (30 min seamless)',        file: 'seamless-jungle.mp3' },
  noise:   { id: 'noise-seamless-30m',   name: 'Noise (30 min seamless)',         file: 'seamless-noise.mp3' },
  birds:   { id: 'birds-seamless-30m',   name: 'Birds (30 min seamless)',         file: 'seamless-birds.mp3' },
  cave:    { id: 'cave-seamless-30m',    name: 'Cave (30 min seamless)',          file: 'seamless-cave.mp3' },
};

/** One seamless 30-min music track per mood. file path is relative to the music base. */
export const SEAMLESS_MUSIC_TRACKS: Partial<Record<string, AudioTrack>> = {
  // focus + deepWork pending render as of 2026-06-01:
  // focus:    { id: 'focus-seamless-30m',    name: 'Focus (30 min seamless)',    file: 'seamless/focus-30min.mp3' },
  // deepWork: { id: 'deepwork-seamless-30m', name: 'Deep Work (30 min seamless)', file: 'seamless/deepWork-30min.mp3' },
  relax:    { id: 'relax-seamless-30m',    name: 'Relax (30 min seamless)',    file: 'seamless/relax-30min.mp3' },
  meditate: { id: 'meditate-seamless-30m', name: 'Meditate (30 min seamless)', file: 'seamless/meditate-30min.mp3' },
  sleep:    { id: 'sleep-seamless-30m',    name: 'Sleep (30 min seamless)',    file: 'seamless/sleep-30min.mp3' },
};

/** Seamless soundscape track for a category, or null if none. */
export function getSeamlessSoundscapeTrack(category: SoundscapeCategory): AudioTrack | null {
  return SEAMLESS_SOUNDSCAPE_TRACKS[category] ?? null;
}

/** Seamless music track for a mood, or null if none. */
export function getSeamlessMusicTrack(mood: string): AudioTrack | null {
  return SEAMLESS_MUSIC_TRACKS[mood] ?? null;
}
