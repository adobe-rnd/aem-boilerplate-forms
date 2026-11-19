# First benchmark: create-custom-component, full vs lite (summary)

Run on 2026-11-17. Full write-up with screenshots and evidence: https://wiki.corp.adobe.com/spaces/lc/pages/4126157002

> **Known flaw:** both skills received detailed prompts rewritten from the original requests, not the original wording. That makes them easier and probably narrows the gap between the skills. A rerun uses the original wording unchanged (see [`custom-component-prompts/README.md`](custom-component-prompts/README.md)).

## Setup

- **Full skill:** adobe/skills `create-custom-component`, commit `c25d775` (v1.0.1). Runs `npm run build:json` and has a Playwright e2e test loop.
- **Lite skill:** ravise5/skills `aem-forms/create-custom-component-lite`, commit `70c69fa` (v1.0.0). Merges `component-*.json` by hand and has no e2e loop.
- **Components:** `loan-slider` (number-input), `image-choice` (checkbox-group), `inr-input` (number-input), `card-choice` (text-input). The base types were fixed in the prompts.
- **Runs:** 4 components × 2 skills × 2 repetitions = 16. Each run was a separate `copilot -p` process using claude-sonnet-5.5, in its own clone of `aem-boilerplate-forms` `main@02a535a`, with only one skill installed. The four runs for each component started at the same moment, and memory was off.
- **Scoring:** independent Playwright acceptance tests (44 in total), written from the prompts without either skill's tools, plus structure and registration checks, a comparison of the delivered JSON with `build:json` output, `npm run lint` and the unit tests. Output was frozen before scoring, with no fixes.

## Results

| Metric (8 runs per skill) | Full | Lite |
|---|---|---|
| Acceptance tests passed | 88/88 | 88/88 |
| Structure / registration checks | 74/74 | 74/74 |
| `npm run lint` clean | 6/8 | 8/8 |
| `component-*.json` identical to `build:json` | 8/8 | 5/8 (rest: order only) |
| Time, mean / median | 151 s / 123.5 s | 117 s / 114 s |
| AI credits, mean | 32.8 (total 262.0) | 33.4 (total 267.5) |
| Self-written e2e tests committed | 46 | 0 |

### Per run

| Component | Skill | Rep | Commit | Acceptance | Lint | JSON vs build | Time | Credits |
|---|---|---|---|---|---|---|---|---|
| loan-slider | full | 1 | [744c35a](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/744c35ac399e57637ac4ce550ae9c9b2d5795608) | 11/11 | errors | identical | 169 s | 43.75 |
| loan-slider | full | 2 | [218a1c4](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/218a1c4b7cd9f662398c9966d0929a1e413ecd40) | 11/11 | clean | identical | 110 s | 28.75 |
| loan-slider | lite | 1 | [731cab4](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/731cab4850e6e13859f7a4513e925ad9b184c756) | 11/11 | clean | identical | 124 s | 35.95 |
| loan-slider | lite | 2 | [696297d](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/696297da457865bc8981514e2379a5add4e24f20) | 11/11 | clean | identical | 138 s | 48.23 |
| image-choice | full | 1 | [1030aea](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/1030aeac3ef259973fcf96627f598ba542de63ad) | 10/10 | clean | identical | 133 s | 29.41 |
| image-choice | full | 2 | [8fe228d](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/8fe228dc68033aa1382979b8e723cd2f68e78044) | 10/10 | clean | identical | 100 s | 24.85 |
| image-choice | lite | 1 | [20314cc](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/20314cc66485909dea42f443c8e78753d185b914) | 10/10 | clean | identical | 161 s | 38.28 |
| image-choice | lite | 2 | [aa0bcdd](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/aa0bcdda15175e270d445e8eb7c93d08d7c75a6c) | 10/10 | clean | order-only | 104 s | 30.05 |
| inr-input | full | 1 | [4d0a55b](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/4d0a55b84cfecf5e3dab809e2b8573fca554ce90) | 12/12 | clean | identical | 96 s | 29.96 |
| inr-input | full | 2 | [3dc1603](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/3dc1603c2bd90786ece4942d02b919242305a188) | 12/12 | clean | identical | 114 s | 26.83 |
| inr-input | lite | 1 | [f26c3e8](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/f26c3e82e68b2e43792ba5a72d829b653ffa41e6) | 12/12 | clean | order-only | 90 s | 29.28 |
| inr-input | lite | 2 | [bec7e73](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/bec7e731659e52ca946cec20221db6287f79f68a) | 12/12 | clean | order-only | 61 s | 20.24 |
| card-choice | full | 1 | [019cfcf](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/019cfcf65c74629bff45b56b360016a4b0febc95) | 11/11 | clean | identical | 165 s | 44.13 |
| card-choice | full | 2 | [6606482](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/66064827a76dd78ed12fbcfccfc6bad44f5d3ea9) | 11/11 | errors | identical | 319 s | 34.36 |
| card-choice | lite | 1 | [db5bbc7](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/db5bbc73517ba6d26fbeac7593fa69c7d4e8596a) | 11/11 | clean | identical | 162 s | 34.56 |
| card-choice | lite | 2 | [15b174d](https://github.com/adobe-rnd/aem-boilerplate-forms/commit/15b174d0dcad987dc92e802d725c065230362a72) | 11/11 | clean | identical | 94 s | 30.92 |

## Findings

1. **Accuracy was the same:** every run of both skills passed all acceptance tests, and the screenshots look nearly identical.
2. **The full skill shipped lint errors:** 2 runs left stylelint errors while reporting lint as clean. One auto-fixed only ESLint; the other filtered out stylelint's output.
3. **The lite skill misordered the authoring JSON:** 3 runs put the model in a different position in `component-models.json` than `build:json` does. The content was identical. This is now fixed in the lite skill (`7943e5a`, `516f5c5`) and in adobe-aem-forms/aemforms-aia-extensions#471.
4. **Speed:** lite was faster on average, but the medians were close.
5. **Cost:** AI credits were about the same for both skills.
6. **Tests left behind:** only the full skill leaves e2e tests in the repo.
7. **Repo issues found:**
   - In OOTB checkbox-group, the first option reuses the fieldset's `id`, so its label does nothing.
   - The repo's `playwright.config.js` doesn't load locally (`globalSetup: null`).

## Caveats

- The prompts were detailed rewrites, not the original requests (see the note at the top).
- Two repetitions and one model can show there's no large difference, not small ones.
- Nothing was tested in AEM authoring or Universal Editor.
- A first attempt used git worktrees, which share one `git stash`; one lite run picked up full-skill test files that way. It was discarded and all 16 runs were redone in independent clones.

## Artifacts

- Branches: `create-custom-component-full` and `create-custom-component-lite` in adobe-rnd/aem-boilerplate-forms (since deleted); the per-run commits are linked in the table above and on the wiki page.
- Evaluator, prompts and data: `ccbench-evaluator.zip`, attached to the wiki page.
