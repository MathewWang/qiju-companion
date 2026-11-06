# Character assets

- Every new selectable character must include a transparent full-body portrait and its own animation sprite sheet. A static portrait alone is not a finished character.
- Match the existing four-column, three-row contract: idle/blink, wave, sit-down. Stand-up plays the sit-down row in reverse. Preserve identity, scale, ground baseline, and transparent background across frames.
- Register assets in shared/characters.json and use the shared AnimatedCompanion player. Do not hard-code character names or a two-character allowlist in the renderer or preview.
- Verify portrait and motion assets exist, inspect their rendering, run the catalog tests and build. Clearly report any unverified visual quality or missing assets.
- Keep original portraits and record generation prompts in docs. Asset-load failure may fall back to the portrait, but that fallback does not count as completed animation.
