// The token radar's model, version 4e: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and adds the
// strongest pre-token protocols the watchlist leaves out, chosen by the model, not by raw TVL. A
// protocol is pre-token when its index entry records no token (no market cap, no CoinGecko id, no
// symbol); the snapshot's live-token protocols are kept apart and shown with the market's own values,
// never mixed into the ranked board.
//
// Implied value follows only from the snapshot's own figures, in three parts:
//
//   sector multiple  = the market-cap/TVL multiple the market already pays for tokenized protocols in the
//                      same category. Ratios are multiplicative — they run from 0.002x to 400x in
//                      this snapshot — so the shrink is done in log space: the multiple is the
//                      geometric mean of the category's peer median and the global median, weighted
//                      by peer count against a prior weight of 3, then clamped to [0.02, 3.00].
//                      A category with one peer therefore sits much closer to the global median
//                      than one with fifteen; a category with no tokenized peer takes the global
//                      median outright. No protocol name is ever special-cased.
//   growth           = clamp(change_7d, -50, 100) per cent
//   growthMult       = 1 + (growth / 100) x 0.6
//   maturity         = 0.70 + min(age_days, 1460) / 1460 x 0.30   (age_days unknown: 365)
//   implied          = max(1, round(tvl_usd x sectorMultiple x growthMult x maturity))
//
// Age is the time since DefiLlama first listed the protocol: the best record of how long it has run
// with no token. A protocol that has run for years at size without issuing one is a more credible
// launch candidate than one listed last month, so maturity lifts its implied value; it never lifts a
// protocol past the sector multiple the market pays its tokenized peers.
//
// Every farm plan is netted to the dollar. The expected value assumes the launch allocates 5% of
// supply to farmers, split among the wallets doing the qualifying actions, estimated at one wallet
// per $1,000 of TVL and capped at 100,000 wallets — the snapshot records TVL, not wallets, and no
// airdrop in this era had more wallets doing the qualifying actions than that. The costs are the
// plan's gas on its chain plus the yield the capital forgoes at 5% a year over the hold. The verdict
// is farm when the net clears $10, thin when it clears $0, and skip when it does not: farming a
// protocol on a $5-a-transaction chain with $150 of capital loses money on gas alone, and the board
// says so instead of dressing it up.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  prior_weight: number;
  multiple_floor: number;
  multiple_cap: number;
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
  /** The share of a launch's supply assumed to go to farmers. */
  allocation_share: number;
  /** The TVL one farming wallet is assumed to represent, for the farmer count. */
  typical_position_usd: number;
  /** The most wallets assumed to do the qualifying actions, however large the TVL. */
  farmer_cap: number;
  /** The yearly yield the farm capital forgoes while it is deployed. */
  opportunity_apy: number;
  /** The net a farm plan must clear to earn a farm verdict. */
  farm_threshold_usd: number;
}

export const MODEL: ModelConstants = {
  prior_weight: 3,
  multiple_floor: 0.02,
  multiple_cap: 3.0,
  growth_weight: 0.6,
  growth_floor: -50,
  growth_cap: 100,
  maturity_floor: 0.7,
  maturity_range: 0.3,
  maturity_days: 1460,
  unknown_age_days: 365,
  allocation_share: 0.05,
  typical_position_usd: 1000,
  farmer_cap: 100000,
  opportunity_apy: 0.05,
  farm_threshold_usd: 10,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-4e';

/** How many pre-token protocols outside the watchlist the early radar carries, by implied value. */
export const EARLY_ROWS = 160;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** One sector's market-cap/TVL multiple, as the dashboard's table shows it. */
export interface SectorMultiple {
  category: string;
  peers: number;
  peer_median: number;
  used_multiple: number;
}

/** A farm plan netted to the dollar, with its verdict. */
export interface FarmEconomics {
  expected_usd: number;
  gas_usd: number;
  opportunity_usd: number;
  net_usd: number;
  verdict: 'farm' | 'thin' | 'skip';
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    sector_multiple: number;
    sector_peers: number;
    growth_pct: number;
    growth_multiplier: number;
    maturity_multiplier: number;
    age_days: number | null;
  };
  farm_steps: string[];
  farm: FarmEconomics;
}

/** The dashboard's compact view of one row, with farm plans generated in the page. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  on_watchlist: boolean;
  sector_multiple: number;
  sector_peers: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  farm_expected_usd: number;
  farm_gas_usd: number;
  farm_opportunity_usd: number;
  farm_net_usd: number;
  farm_verdict: 'farm' | 'thin' | 'skip';
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
}

/** Everything the dashboard needs: the board, the live set, the sector table and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  sectors: SectorMultiple[];
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A finite number, else `fallback`. */
function finite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** The median of a sorted array of numbers; 0 for an empty one. */
function medianOf(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/**
 * The sector multiples the snapshot's own tokenized peers imply. A peer is a protocol with a market
 * cap and a positive TVL, outside the CEX category (exchange tokens price the exchange, not the
 * protocol). Each category's median is shrunk toward the global median in log space — the multiple
 * is peerMedian^(n/(n+k)) x globalMedian^(k/(n+k)) with k the prior weight — because market-cap/TVL
 * ratios are multiplicative and a linear average lets one extreme peer (one category's only peer
 * trades at 400x) set the price alone. A category with no peer takes the global median. Sorted by
 * category, so the table the dashboard shows is stable.
 */
export function sectorMultiples(snapshot: Snapshot, model: ModelConstants = MODEL): { globalMedian: number; sectors: SectorMultiple[] } {
  const peers = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0 && p.category !== 'CEX');
  const globalMedian = medianOf(peers.map((p) => p.mcap_usd! / p.tvl_usd).sort((a, b) => a - b));
  const byCategory = new Map<string, number[]>();
  for (const p of peers) {
    const cat = p.category ?? 'Other';
    const list = byCategory.get(cat) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCategory.set(cat, list);
  }
  const categories = [...new Set(snapshot.protocols.map((p) => p.category ?? 'Other'))].sort();
  const sectors: SectorMultiple[] = categories.map((category) => {
    const ratios = (byCategory.get(category) ?? []).sort((a, b) => a - b);
    const peerMedian = medianOf(ratios);
    const shrunk =
      ratios.length === 0
        ? globalMedian
        : Math.exp(
            (ratios.length * Math.log(peerMedian) + model.prior_weight * Math.log(globalMedian)) /
              (ratios.length + model.prior_weight),
          );
    const used = Math.min(model.multiple_cap, Math.max(model.multiple_floor, shrunk));
    return { category, peers: ratios.length, peer_median: round4(peerMedian), used_multiple: round4(used) };
  });
  return { globalMedian: round4(globalMedian), sectors };
}

/** The sector multiple one category gets, from the table the snapshot implies. */
function multipleFor(category: string | null, sectors: SectorMultiple[], globalMedian: number): number {
  const row = sectors.find((s) => s.category === (category ?? 'Other'));
  return row === undefined ? globalMedian : row.used_multiple;
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  sectors: SectorMultiple[],
  globalMedian: number,
  model: ModelConstants,
): { implied: number; sectorMultiple: number; sectorPeers: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const sectorRow = sectors.find((s) => s.category === (protocol.category ?? 'Other'));
  const sectorMultiple = multipleFor(protocol.category, sectors, globalMedian);
  const sectorPeers = sectorRow === undefined ? 0 : sectorRow.peers;
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * model.growth_weight;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const base = protocol.tvl_usd * sectorMultiple;
  const implied = Math.max(1, Math.round(base * growthMult * maturityMult));
  return { implied, sectorMultiple, sectorPeers, growthPct, growthMult, maturityMult, age };
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** A name carrying a whole word wrapped, staked or staking: a product of a token that already trades. */
const WRAPPED_WORD = /\b(wrapped|staked|staking)\b/i;

/** A name beginning with an exchange's name: an exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Categories that are a product of a token that already trades, not a protocol still to launch. */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Restaked BTC', 'CEX']);

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool, and
 * not a wrapped, staked or bridged product of a token that already trades. Liquid staking stays in:
 * its receipt token is the staked asset, while the protocol's own governance token is the one that has
 * not launched yet.
 */
export function isRankable(p: SnapshotProtocol): boolean {
  return isPreToken(p) && !PRODUCT_CATEGORIES.has(p.category ?? '') && !VERSIONED.test(p.name) && !WRAPPED_WORD.test(p.name) && !EXCHANGE_PREFIX.test(p.name);
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const { sectors, globalMedian } = sectorMultiples(snapshot, model);
  const index = bySlug(snapshot.protocols);
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, even one the snapshot no longer carries (it cannot, but
  // the board's coverage is the gate's row and is never gambled on a missing record).
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: the rankable protocols the watchlist leaves out, strongest by implied value
  // first. That is mostly the ones below the floor, and the few above it the list left out; the model
  // picks them, never raw TVL.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p))
    .map((p) => ({ p, v: impliedValue(p, snapshot.as_of, sectors, globalMedian, model) }))
    .sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const e of early) chosen.set(e.p.slug, e.p);

  const scored = [...chosen.values()].map((p) => {
    const v = impliedValue(p, snapshot.as_of, sectors, globalMedian, model);
    return { p, v };
  });
  scored.sort((a, b) => b.v.implied - a.v.implied || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
    rank: i + 1,
    slug: s.p.slug,
    name: s.p.name,
    category: s.p.category,
    chains: s.p.chains,
    tvl_usd: s.p.tvl_usd,
    change_7d: s.p.change_7d,
    mcap_usd: s.p.mcap_usd,
    listed_at: s.p.listed_at,
    gecko_id: s.p.gecko_id,
    symbol: s.p.symbol,
    token_status: 'pre-token',
    age_days: s.v.age,
    implied_value_usd: s.v.implied,
    model: {
      sector_multiple: s.v.sectorMultiple,
      sector_peers: s.v.sectorPeers,
      growth_pct: s.v.growthPct,
      growth_multiplier: round4(s.v.growthMult),
      maturity_multiplier: round4(s.v.maturityMult),
      age_days: s.v.age,
    },
    farm_steps: farmSteps(s.p, s.v.age).map(stepText),
    farm: farmEconomics(s.p, s.v.implied, s.v.age, model),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** What one transaction costs on a chain, and what a week of activity costs there. */
function gasFor(chain: string): { tx: string; week: string } {
  const c = chain.toLowerCase();
  if (c.includes('solana') || c.includes('hyperliquid')) return { tx: 'under $0.10 of gas', week: 'under $0.50 of gas a week' };
  if (c.includes('arbitrum') || c.includes('optimism') || c.includes('base') || c.includes('polygon') || c.includes('monad')) {
    return { tx: 'about $0.20 of gas', week: 'about $1 of gas a week' };
  }
  if (c.includes('ethereum')) return { tx: 'about $5 of gas', week: 'about $10 of gas a week' };
  if (c.includes('avalanche')) return { tx: 'about $0.50 of gas', week: 'about $2 of gas a week' };
  if (c.includes('tron')) return { tx: 'about $1 of gas', week: 'about $3 of gas a week' };
  if (c.includes('bitcoin')) return { tx: 'about $2 of gas', week: 'about $5 of gas a week' };
  if (c.includes('binance')) return { tx: 'about $0.30 of gas', week: 'about $1 of gas a week' };
  return { tx: 'about $1 of gas', week: 'about $3 of gas a week' };
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 250;
  if (p.tvl_usd >= 1_000_000_000) return 150;
  if (p.tvl_usd >= 100_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 30;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What one transaction costs in dollars on a chain, the numbers behind the gas strings. */
function gasUsdFor(chain: string): number {
  const c = chain.toLowerCase();
  if (c.includes('solana') || c.includes('hyperliquid')) return 0.1;
  if (c.includes('arbitrum') || c.includes('optimism') || c.includes('base') || c.includes('polygon') || c.includes('monad')) return 0.2;
  if (c.includes('ethereum')) return 5;
  if (c.includes('avalanche')) return 0.5;
  if (c.includes('tron')) return 1;
  if (c.includes('bitcoin')) return 2;
  if (c.includes('binance')) return 0.3;
  return 1;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * A farm plan netted to the dollar. The expected value assumes the launch allocates the model's
 * share of supply to farmers, split among the wallets doing the qualifying actions — one wallet per
 * typical position of TVL, capped at the model's farmer cap, because the snapshot records TVL, not
 * wallets. The reward is per active wallet, not pro-rata to capital: airdrops pay for actions, and
 * the capital affects only what it forgoes while deployed. The costs are the plan's gas — one setup,
 * one transaction a week of the hold, one claim, two to unwind — plus the yield the capital forgoes
 * at the model's yearly rate over the hold. The verdict is farm when the net clears the model's
 * threshold, thin when it clears zero, and skip when it does not.
 */
export function farmEconomics(p: SnapshotProtocol, implied: number, age: number | null, model: ModelConstants = MODEL): FarmEconomics {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const txs = 3 + Math.ceil(hold / 7);
  const gas = round2(gasUsdFor(chainOf(p)) * txs);
  const opportunity = round2((capital * model.opportunity_apy * hold) / 365);
  const farmers = Math.max(1, Math.min(p.tvl_usd / model.typical_position_usd, model.farmer_cap));
  const expected = round2((implied * model.allocation_share) / farmers);
  const net = round2(expected - gas - opportunity);
  const verdict = net >= model.farm_threshold_usd ? 'farm' : net >= 0 ? 'thin' : 'skip';
  return { expected_usd: expected, gas_usd: gas, opportunity_usd: opportunity, net_usd: net, verdict };
}

/** One category action: what to do and what it costs. The cost is the capital the action moves, so
 *  the step's cost line always matches the action it prices. */
interface CategoryAction {
  text: string;
  cost: string;
}

/** The category's three actions: the first position, the second qualifying action, and a third
 *  action that deepens the position. */
function actionsFor(p: SnapshotProtocol, capital: number, chain: string): [CategoryAction, CategoryAction, CategoryAction] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) {
    return [
      { text: `Supply $${capital} of USDC to ${name} on ${chain} and leave the position open.`, cost: `$${capital} of capital` },
      { text: `Borrow $20 against the supply, then repay it in full the same week so both sides of the position are on record.`, cost: 'about $20 of capital' },
      { text: `Add a second supply asset of $20 to the same market and keep both positions open, so the wallet is not single-asset.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('dex') || c.includes('leveraged farm')) {
    return [
      { text: `Provide $${capital} of liquidity to ${name}'s largest pool on ${chain} and keep the position open.`, cost: `$${capital} of capital` },
      { text: `Swap $10 through the same pool once a week, in alternating directions, so the position is active and not idle.`, cost: 'about $10 of capital' },
      { text: `Provide $20 of liquidity to a second pool on ${name}, so the wallet is in two of its pools.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('yield')) {
    return [
      { text: `Deposit $${capital} of USDC into a ${name} vault on ${chain} and keep the shares.`, cost: `$${capital} of capital` },
      { text: `Harvest the vault's yield once and deposit it straight back in, so the compounding is on record.`, cost: 'the harvested yield' },
      { text: `Deposit a second $20 into the same vault after the first harvest, so the compounding has fresh capital.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      { text: `Stake $${capital} of the chain's staking asset through ${name} on ${chain} and keep the receipt token.`, cost: `$${capital} of capital` },
      { text: `Use the receipt token once in a lending market on the same chain, then return it to the staking position.`, cost: 'the receipt token' },
      { text: `Stake a second tranche of $20 through ${name} and keep both receipts, so the position grows rather than sitting still.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) {
    return [
      { text: `Deposit $${capital} of USDC as margin on ${name} and open one small hedge no larger than a tenth of it.`, cost: `$${capital} of capital` },
      { text: `Close the hedge and open a fresh one each month, so the account shows repeated trading rather than one trade.`, cost: 'no new capital' },
      { text: `Open a second small hedge of $20 in the opposite direction, so the account holds both sides.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('prediction')) {
    return [
      { text: `Fund $${capital} on ${name} and place one position on a market that resolves within the month.`, cost: `$${capital} of capital` },
      { text: `Place one more $20 position the week the first resolves, so the account stays active across resolutions.`, cost: 'about $20 of capital' },
      { text: `Fund a second market with $20 that resolves after the first, so the account spans two resolutions.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('rwa')) {
    return [
      { text: `Mint $${capital} of the protocol's yield-bearing asset on ${chain} and hold it in the farming wallet.`, cost: `$${capital} of capital` },
      { text: `Claim the asset's yield once and hold the claim in the same wallet, so the holding and the claim are linked.`, cost: 'the claimed yield' },
      { text: `Buy a second $20 tranche of the yield-bearing asset after the first yield claim, so the position compounds.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('stable')) {
    return [
      { text: `Mint or deposit $${capital} of the stable asset through ${name} on ${chain} and hold it.`, cost: `$${capital} of capital` },
      { text: `Redeem $10 of the stable asset and mint it back, so the wallet shows both directions of the peg.`, cost: 'about $10 of capital' },
      { text: `Deposit $20 of the stable asset into a lending market on the same chain, so it earns yield while the wallet holds the peg.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('insurance')) {
    return [
      { text: `Buy $${capital} of cover from ${name} on ${chain} and keep the policy for its full term.`, cost: `$${capital} of capital` },
      { text: `File one test claim for $1 on a covered event, or extend the cover by a month, so the policy is active.`, cost: 'about $1 of capital' },
      { text: `Buy $20 of extra cover on a second event, so the wallet holds two policies.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('risk')) {
    return [
      { text: `Deposit $${capital} into a ${name} vault on ${chain} and keep the shares for the full hold.`, cost: `$${capital} of capital` },
      { text: `Move a tenth of the deposit to a second ${name} vault once, so the wallet is spread across its strategies.`, cost: 'a tenth of the deposit' },
      { text: `Deposit a second $20 into the second vault after the first move, so both strategies keep growing.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('launchpad')) {
    return [
      { text: `Stake $${capital} of the qualifying asset on ${name} to meet its sale threshold on ${chain}.`, cost: `$${capital} of capital` },
      { text: `Join one token sale the stake qualifies for, with the smallest allocation it allows.`, cost: 'the smallest allocation it allows' },
      { text: `Top up the stake by $20 once, so the qualifying balance grows rather than sitting still.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('payment')) {
    return [
      { text: `Pay one $20 invoice through ${name} on ${chain} from the farming wallet.`, cost: `$${capital} of capital` },
      { text: `Set up one recurring payment of $10 a month through ${name}, so the wallet shows repeated use.`, cost: 'about $10 of capital a month' },
      { text: `Pay a second $20 invoice to a different recipient, so the wallet shows more than one counterparty.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('privacy')) {
    return [
      { text: `Deposit $${capital} into ${name}'s shielded pool on ${chain} and keep the note.`, cost: `$${capital} of capital` },
      { text: `Withdraw $10 from the shielded pool to a fresh address, then deposit it back, so both directions are used.`, cost: 'about $10 of capital' },
      { text: `Deposit a second $20 into the shielded pool after the first withdrawal, so the pool sees repeated use.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('nft')) {
    return [
      { text: `List one item for sale on ${name} on ${chain} at a price near the floor.`, cost: `$${capital} of capital` },
      { text: `Buy one low-cost item on ${name} and hold it, so the wallet is both a seller and a buyer.`, cost: 'one low-cost item' },
      { text: `Make a $20 offer below the floor on an item you want, so the wallet bids as well as buys and sells.`, cost: 'about $20 of capital' },
    ];
  }
  if (c.includes('index')) {
    return [
      { text: `Buy $${capital} of ${name}'s index token on ${chain} and hold it.`, cost: `$${capital} of capital` },
      { text: `Rebalance the index holding once, selling a tenth and buying it back, so the position is managed.`, cost: 'a tenth of the holding' },
      { text: `Add $20 to the index holding after the first rebalance, so the position grows.`, cost: 'about $20 of capital' },
    ];
  }
  return [
    { text: `Deposit $${capital} of USDC into ${name} on ${chain} and keep the position open.`, cost: `$${capital} of capital` },
    { text: `Make one swap of $10 through ${name} once a week, so the wallet shows repeated use of the app.`, cost: 'about $10 of capital' },
    { text: `Deposit $20 into a second feature of the same protocol, such as its vault or its swap, so the wallet uses more than one part of the app.`, cost: 'about $20 of capital' },
  ];
}

/** What the protocol pays out, for the claim step: the surface the farmer checks before withdrawing. */
function claimSurface(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('yield') || c.includes('curator') || c.includes('allocator') || c.includes('risk')) return 'the vault yield';
  if (c.includes('staking') || c.includes('restak')) return 'the staking rewards';
  if (c.includes('prediction')) return 'the market winnings';
  if (c.includes('insurance')) return 'the cover payout';
  if (c.includes('launchpad')) return 'the sale allocation';
  if (c.includes('index')) return 'the index yield';
  if (c.includes('rwa')) return 'the asset yield';
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return 'the trading rewards';
  return 'the points';
}

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names. The three category actions are the core; the rest is wallet hygiene, hold with a weekly
 * cadence, claim safety and the log.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const gas = gasFor(chain);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const [first, second, third] = actionsFor(p, capital, chain);
  const surface = claimSurface(p);
  return [
    {
      text: `Use a fresh wallet on ${chain} that holds only the funds you plan to farm, and write its seed phrase on paper, never in a chat or a file.`,
      cost: gas.tx,
      time: '5 minutes',
    },
    {
      text: first.text,
      cost: `${first.cost} and ${gas.tx}`,
      time: '15 minutes to set up',
    },
    {
      text: second.text,
      cost: `${second.cost} and ${gas.tx}`,
      time: '10 minutes',
    },
    {
      text: third.text,
      cost: `${third.cost} and ${gas.tx}`,
      time: '10 minutes',
    },
    {
      text: `Hold the position for at least ${hold} days and do one qualifying action each week during the hold, so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Before you withdraw, open the protocol's own rewards page and claim ${surface} only from the link it publishes; never pay anyone to claim for you.`,
      cost: 'no fee to check',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction hash in a farm log, and plan the unwind: withdraw half ($${capital / 2}) on day one and the rest on day two.`,
      cost: 'nothing but the log',
      time: '10 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
    }));
}

/** A board row's compact form for data.js, with the farm plan generated in the page. */
export function radarRow(row: BoardRow, onWatchlist: boolean): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    on_watchlist: onWatchlist,
    sector_multiple: row.model.sector_multiple,
    sector_peers: row.model.sector_peers,
    growth_multiplier: row.model.growth_multiplier,
    maturity_multiplier: row.model.maturity_multiplier,
    farm_expected_usd: row.farm.expected_usd,
    farm_gas_usd: row.farm.gas_usd,
    farm_opportunity_usd: row.farm.opportunity_usd,
    farm_net_usd: row.farm.net_usd,
    farm_verdict: row.farm.verdict,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const { sectors } = sectorMultiples(snapshot, model);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    sectors,
    rows: board.map((r) => radarRow(r, watchlist.has(r.slug))),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
    if (!Number.isFinite(r.farm.net_usd) || !Number.isFinite(r.farm.expected_usd) || !Number.isFinite(r.farm.gas_usd) || !Number.isFinite(r.farm.opportunity_usd)) {
      return `${r.slug} has a farm plan that does not net to a number`;
    }
    if (r.farm.verdict !== 'farm' && r.farm.verdict !== 'thin' && r.farm.verdict !== 'skip') return `${r.slug} has verdict ${String(r.farm.verdict)}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
