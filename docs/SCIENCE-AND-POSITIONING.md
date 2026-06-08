# ArgoBeat — Science & Positioning

## What ArgoBeat is

ArgoBeat is an open-source functional-music engine that procedurally generates audio
tuned to support a chosen mental state — focus, deep work, relaxation, meditation, or
sleep. It is built for students and knowledge workers who need to hold attention on
demanding tasks, for people with attention difficulties (including ADHD traits) who find
ordinary music distracting or plain silence understimulating, and for anyone who needs
help winding down into calm or sleep.

The core idea is simple and grounded in published science: ArgoBeat rhythmically
modulates the loudness of its audio at the EEG frequency associated with each target
state. This is the same amplitude-modulation mechanism used by commercial functional-music
services and validated in the peer-reviewed literature — except here the entire pipeline
is open, every parameter is auditable, and every render is measurable. The engine doesn't
ask you to trust a marketing claim; it hands you the audio and the tools to verify exactly
what it produced.

## The Science

### Neural entrainment via amplitude modulation

When a sound's loudness is rhythmically varied — its *amplitude envelope* modulated — at a
steady rate, populations of neurons in the auditory cortex fire in time with that rhythm.
This phase-locking of cortical activity to an external rhythm is called **neural
entrainment**, and in the auditory system it is robust and well documented. The
*auditory steady-state response* (ASSR) is the direct evidence: amplitude-modulate a tone
or noise at a given frequency, and scalp EEG shows a clear response at exactly that
modulation frequency. The brain demonstrably follows the envelope of the sound it hears
[1][2].

Entrainment is strongest when the modulation lives in the audio signal itself — the actual
loudness reaching your ears rises and falls. This is the key distinction from **binaural
beats**, where two slightly different pure tones are played one per ear and the listener
perceives an illusory "beat" at the difference frequency. Binaural beats rely on a
perceptual effect rather than a real acoustic rhythm, and the literature finds their
entrainment weak and inconsistent. Direct amplitude modulation puts a real, physically
present rhythm in both channels — something the auditory system locks onto, and something
anyone can verify by analyzing the waveform.

ArgoBeat applies its modulation directly to the audible signal, on the pad and bass bus
that carries most of the audio's energy — not as a faint layer buried under ambience. The
rhythm is in the music you actually hear.

### Modulation rate matters — and the beta range supports focus

The *rate* of modulation drives the cognitive state it supports, independent of the
music's mood or tempo. Woods and colleagues first showed that background music with
stronger amplitude modulation in the beta range improved sustained-attention performance,
establishing that the *temporal* structure of functional music is what does the work [4].

A 2024 study in *Communications Biology* (Nature Portfolio) extended this substantially.
Woods et al. tested rapid amplitude modulation applied to music and found that modulation
in the **beta range (~14–18 Hz, with ~16 Hz performing best)**, at **higher modulation
depth**, produced the best sustained-attention performance. Rapid modulation also drove
greater activity in attentional networks (fMRI) and stronger stimulus-to-brain coupling
(EEG). Critically, the benefit was **larger for listeners with greater attentional
difficulties** — the people for whom focus is hardest gained the most. The modulation was
applied directly to the music's amplitude envelope in both channels, not via binaural
beats [3].

This is the published foundation ArgoBeat's focus and deep-work modes are built on.

### Target rates by mental state

Different mental states are associated with different dominant EEG bands. ArgoBeat maps
each mood to a modulation rate targeting the corresponding band, and — because the rate is
a measurable feature of the output — the table below lists both the intended band and the
**rate actually measured** in shipped renders (verified 2026-05-31 against reference
tracks):

| State     | EEG band | Target band | Measured modulation rate |
|-----------|----------|-------------|--------------------------|
| Focus     | Beta     | ~14–18 Hz   | **15.67 Hz** |
| Deep Work | Beta     | ~14–18 Hz   | **17.37 Hz** |
| Relax     | Alpha    | ~8–12 Hz    | **10.68 Hz** |
| Meditate  | Theta    | ~4–8 Hz     | **5.27 Hz** |
| Sleep     | Delta    | ~1–4 Hz     | **~1.7 Hz** |

The beta focus and deep-work rates sit squarely in the range the attention research
directly supports [3][4]. The alpha, theta, and delta rates apply the same
amplitude-modulation mechanism to the EEG bands conventionally associated with relaxation,
meditative states, and slow-wave sleep. Every one of these rates is not an aspiration but
a measured property of the audio — you can confirm them yourself from any render.

### References

1. Auditory steady-state response — overview of the brain's phase-locked electrical
   response to amplitude-modulated sound.
   https://en.wikipedia.org/wiki/Auditory_steady-state_response
2. Picton, T. W., John, M. S., Dimitrijevic, A., & Purcell, D. (2003). *Human auditory
   steady-state responses.* International Journal of Audiology, 42(4), 177–219.
   https://doi.org/10.3109/14992020309101316
3. Woods, K. J. P., Sampaio, G., James, T., Przysinda, E., Cordovez, B., Hewett, A.,
   Spencer, A. E., Morillon, B., & Loui, P. (2024). *Rapid modulation in music supports
   attention in listeners with attentional difficulties.* Communications Biology, 7(1),
   1376.
   https://doi.org/10.1038/s42003-024-07026-3
   (Open access: https://www.nature.com/articles/s42003-024-07026-3;
   PubMed PMID: 39443657 — https://pubmed.ncbi.nlm.nih.gov/39443657/)
4. Woods, K. J. P., Hewett, A., Spencer, A. E., Morillon, B., & Loui, P. (2019).
   *Modulation in background music influences sustained attention.* arXiv preprint
   arXiv:1907.06909 [q-bio.NC]. https://arxiv.org/abs/1907.06909
   (Earlier background-music / sustained-attention work from the same group establishing
   that beta-range amplitude modulation in music supports attention; this is a 2019
   preprint, not a peer-reviewed journal article. The peer-reviewed extension is [3].)

## Procedurally generated, never loops

ArgoBeat does not play back recorded tracks on a loop. Every session is synthesized on the
fly by a deterministic generative engine: pads, bass, percussion, and ambient texture are
sequenced and rendered continuously so the audio keeps evolving for the full session
length. Compare two windows from far apart in the same render and their waveform
correlation is effectively zero — the audio is never literally repeating.

This matters for sustained attention. A short loop invites the brain to recognize the
seam, predict the repeat, and disengage; novelty re-captures attention and pulls focus off
the task. ArgoBeat's audio is *static in character but fresh in detail* — consistent
enough in mood, energy, and modulation rate to fade into the background, varied enough
that there's no loop point to latch onto. The state stays steady; the texture never gets
stale.

The engine currently ships, per mood:

- **30-minute seamless ambient beds** — continuous, low-distraction texture.
- **30-minute generative music** — fuller arrangements carrying the modulation on the
  pad/bass bus.

All output is loudness-normalized to **~-29 LUFS**, matching the integrated loudness of
commercial reference tracks in this space, so levels are consistent across moods and
comfortable for long sessions.

## How ArgoBeat implements it

ArgoBeat is a deterministic, procedurally generated audio engine written in TypeScript.
Each render is synthesized on demand and shaped by the science above:

- **Per-mood amplitude modulation at the documented rates.** Each mood drives the engine's
  amplitude modulation at its target frequency, applied to the audible pad/bass bus in both
  channels — the mechanism the literature supports, not binaural beats.
- **Every render is measurable.** Because the modulation is a real, physically present
  feature of the output waveform, every render can be analyzed after the fact for its
  **entrainment (modulation) rate**, **modulation depth**, and **loudness**. ArgoBeat ships
  a scorer calibrated to measured reference values; all five moods currently score
  **14/14** against it.
- **Fully inspectable and forkable.** The synthesis, sequencing, modulation, *and the
  scorer and reference tracks* are open source. You can read exactly how a state maps to a
  modulation rate, change it, fork it, measure it, or self-host the whole pipeline.

Where closed, subscription, black-box apps ask you to trust an opaque pipeline and a
marketing claim, ArgoBeat hands you the engine, the parameters, the scorer, and the
references — everything needed to confirm the result.

## Listening recommendation

Headphones are **recommended**. The entrainment effect depends on the amplitude rhythm
reaching your ears cleanly in both channels; headphones (or good stereo speakers in a quiet
room) preserve the modulation depth that drives the effect. Laptop or phone speakers, or a
noisy environment, can flatten the rhythm and weaken it. For focus and deep-work sessions
in particular, headphones make a real difference.

## Selling points

- **Open source & auditable** — read the engine, the scorer, and the reference tracks;
  verify the modulation; fork it.
- **Science-backed** — modulation rates grounded in published neural-entrainment and
  sustained-attention research, with citations.
- **Measurable** — every render is analyzable for rate, depth, and loudness; all five
  moods score 14/14 against a reference-calibrated scorer. Claims are checked, not
  asserted.
- **Procedurally generated** — never loops; static in character, fresh in detail.
- **Self-hostable** — runs on your own machine; no account, no cloud dependency.
- **No subscription** — MIT-licensed, free, yours.
- **Multi-state** — focus, deep work, relax, meditate, and sleep from a single engine.

## Scope

ArgoBeat verifies and measures **audio markers**: it confirms that a render contains
amplitude modulation at the intended rate and depth, at a calibrated loudness. The
published research supports the *mechanism* (the brain phase-locks to amplitude modulation)
and a measurable *attention benefit* under the conditions studied. Individual response
varies, as with any functional-music tool.

ArgoBeat is not a medical device and makes no diagnostic or therapeutic claims. If you have
a medical or neurological concern, talk to a qualified professional.
