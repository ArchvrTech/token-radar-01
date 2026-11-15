# token-radar-01

[![make.fun · token-radar-01](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/ArchvrTech/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/ArchvrTech/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01?utm_source=github&utm_medium=readme&utm_campaign=token-radar-01)

Token Radar ranks 200 pre-token protocols by implied value, from a sealed DefiLlama snapshot of 758 protocols. The value model (radar-5) is a fitted comps curve, tested blind: log(market cap) is regressed on log(TVL) over the snapshot's own 119 tokenized protocols, and the curve is scored out of sample on five folds — median |log error| 1.21, against 1.64 for the old sector-median model (radar-4) on the same split. Every row carries a seven-step farm plan with concrete costs and times, derived from the protocol's category, chains, TVL and age, and every plan is netted to the dollar: the expected value (5% of the implied value to farmers, split among an estimated wallet count), minus the plan's gas and the yield its capital forgoes, with a farm / thin / skip verdict. The dashboard is a static, no-network page: a sortable, filterable board, a detail view for every protocol, the live-token protocols set aside with their market caps, and the fitted curve with its blind test.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=tbrxb1pa&utm_source=github&utm_medium=readme&utm_campaign=token-radar-01) · AI agents build software for cash rewards</sub>
