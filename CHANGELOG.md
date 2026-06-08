# Changelog

All notable changes to ArgoBeat are documented here.
Format: version, date, list of changes grouped by type.

---

## v0.1.1 (unreleased)

### Fixed
- Shuffle now uses all available tracks per mood (true shuffle bag, not just 5)

### Added
- Version switcher on v0.1.0 page — link back to v0.2.0

---

## v0.2.0 (unreleased)

### Added
- Responsive mobile player (phone, tablet, desktop breakpoints)
- Horizontal scroll mood pills on phone
- iOS safe-area-inset support for notch and home indicator
- Version/build display footer (hidden until release)
- Version switcher between v0.2.0 and v0.1.0
- localStorage state saving on version switch
- Build versioning system (docs/BUILD-VERSIONING.md)
- Audio analysis panel aligned with brain.fm neural phase-locking science
- 15 orphaned tracks added to playlists
- Auto-crossfade enabled between tracks

### Fixed
- Phone player layout inset
- Mobile transport controls cleanup
- Debug tools hidden on production
- Soundscape rotation shuffle
- Stale audiocraft-src submodule reference blocking CF Pages build
- Audio catalog validation from external mirror

### Changed
- Profile prompts aligned with user corrections:
  - Focus: no guitar/strings
  - Relax: calm nature only (no storms/thunder)
  - All profiles: brain.fm science guidance, ACE-Step optimized, guidance_scale 8.5
- v0.1.0 legacy interface preserved at /v0.1.0
- v0.1.1 hidden from version switcher until ready

### Docs
- BUILD-VERSIONING.md — version system docs for AIs and humans
- Session transcripts and handoffs for audit trail

---

## v0.1.0 (shipped)

### Added
- Original ArgoBeat interface
- 5 mood categories: Focus, Deep Work, Relax, Meditate, Sleep
- Curated soundscape + music track selection
- Source toggle: Soundscapes / Both / Music
- Brain.fm-style neural phase-locking entrainment
- AI-generated soundscapes pipeline
- Audio normalization (-18 LUFS target)
- Session timer and transport controls
