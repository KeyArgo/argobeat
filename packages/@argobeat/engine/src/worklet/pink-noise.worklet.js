/**
 * @argobeat/engine — Pink noise AudioWorklet processor
 *
 * Generates pink noise (1/f spectrum) on the audio rendering thread,
 * ensuring glitch-free output even when the main thread is busy.
 *
 * Uses Paul Kellet's refined algorithm (from musicdsp.org) which applies
 * a series of leaky integrators to white noise to approximate the
 * -3 dB/octave rolloff characteristic of pink noise.
 *
 * Usage:
 *   await ctx.audioWorklet.addModule('/worklet/pink-noise.worklet.js');
 *   const node = new AudioWorkletNode(ctx, 'pink-noise-processor');
 *   node.connect(destination);
 *
 * @see https://www.firstpr.com.au/dsp/pink-noise/
 */

class PinkNoiseProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // Paul Kellet's algorithm state variables
    this.b0 = 0;
    this.b1 = 0;
    this.b2 = 0;
    this.b3 = 0;
    this.b4 = 0;
    this.b5 = 0;
    this.b6 = 0;
  }

  /**
   * Generate 128 samples of pink noise per quantum.
   *
   * @param {Float32Array[][]} _inputs  - Unused (generator node).
   * @param {Float32Array[][]} outputs  - Output buffers to fill.
   * @returns {boolean} `true` to keep the processor alive.
   */
  process(_inputs, outputs) {
    const output = outputs[0];
    if (!output || output.length === 0) return true;

    const channel = output[0];
    for (let i = 0; i < channel.length; i++) {
      const white = Math.random() * 2 - 1;

      // Apply Paul Kellet's refined pink noise filter coefficients
      this.b0 = 0.99886 * this.b0 + white * 0.0555179;
      this.b1 = 0.99332 * this.b1 + white * 0.0750759;
      this.b2 = 0.96900 * this.b2 + white * 0.1538520;
      this.b3 = 0.86650 * this.b3 + white * 0.3104856;
      this.b4 = 0.55000 * this.b4 + white * 0.5329522;
      this.b5 = -0.7616 * this.b5 - white * 0.0168980;

      channel[i] =
        (this.b0 + this.b1 + this.b2 + this.b3 + this.b4 + this.b5 + this.b6 + white * 0.5362) *
        0.11;

      this.b6 = white * 0.115926;
    }

    // Copy mono to all output channels (for stereo or multichannel setups)
    for (let ch = 1; ch < output.length; ch++) {
      output[ch].set(channel);
    }

    return true;
  }
}

registerProcessor('pink-noise-processor', PinkNoiseProcessor);
