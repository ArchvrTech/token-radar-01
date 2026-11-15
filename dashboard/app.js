// Token Radar's dark dashboard. It reads window.RADAR (written beside dashboard/ by main.ts) and
// renders the ranked board, a filterable table, a per-protocol detail panel with the model's own
// inputs and the protocol's farm plan, and the sector table the model is built from. No network:
// every byte it shows is in data.js. The farm plan is the same derivation main.ts writes to
// board.json: category, chains, TVL and age decide the action, the capital, the hold and every cost
// and time. No name is special-cased.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', wl: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  // The model in one function: the page recomputes a row from the snapshot figures and checks the
  // number board.json carries, so the page's code and the board's data are visibly the same arithmetic.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    return Math.max(1, Math.round(row.curve_value_usd * growthMult * maturity));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // --- the farm plan, the same derivation as lib/model.ts -------------------------------
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function gasFor(chain) {
    var c = (chain || '').toLowerCase();
    if (c.indexOf('solana') >= 0 || c.indexOf('hyperliquid') >= 0) return { tx: 'under $0.10 of gas', week: 'under $0.50 of gas a week' };
    if (c.indexOf('arbitrum') >= 0 || c.indexOf('optimism') >= 0 || c.indexOf('base') >= 0 || c.indexOf('polygon') >= 0 || c.indexOf('monad') >= 0) return { tx: 'about $0.20 of gas', week: 'about $1 of gas a week' };
    if (c.indexOf('ethereum') >= 0) return { tx: 'about $5 of gas', week: 'about $10 of gas a week' };
    if (c.indexOf('avalanche') >= 0) return { tx: 'about $0.50 of gas', week: 'about $2 of gas a week' };
    if (c.indexOf('tron') >= 0) return { tx: 'about $1 of gas', week: 'about $3 of gas a week' };
    if (c.indexOf('bitcoin') >= 0) return { tx: 'about $2 of gas', week: 'about $5 of gas a week' };
    if (c.indexOf('binance') >= 0) return { tx: 'about $0.30 of gas', week: 'about $1 of gas a week' };
    return { tx: 'about $1 of gas', week: 'about $3 of gas a week' };
  }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age === null || age === undefined) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionsFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return [
      { text: 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and leave the position open.', cost: '$' + capital + ' of capital' },
      { text: 'Borrow $20 against the supply, then repay it in full the same week so both sides of the position are on record.', cost: 'about $20 of capital' },
      { text: 'Add a second supply asset of $20 to the same market and keep both positions open, so the wallet is not single-asset.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('dex') >= 0 || c.indexOf('leveraged farm') >= 0) return [
      { text: "Provide $" + capital + " of liquidity to " + name + "'s largest pool on " + chain + ' and keep the position open.', cost: '$' + capital + ' of capital' },
      { text: 'Swap $10 through the same pool once a week, in alternating directions, so the position is active and not idle.', cost: 'about $10 of capital' },
      { text: 'Provide $20 of liquidity to a second pool on ' + name + ', so the wallet is in two of its pools.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('yield') >= 0) return [
      { text: 'Deposit $' + capital + ' of USDC into a ' + name + ' vault on ' + chain + ' and keep the shares.', cost: '$' + capital + ' of capital' },
      { text: "Harvest the vault's yield once and deposit it straight back in, so the compounding is on record.", cost: 'the harvested yield' },
      { text: 'Deposit a second $20 into the same vault after the first harvest, so the compounding has fresh capital.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return [
      { text: "Stake $" + capital + " of the chain's staking asset through " + name + ' on ' + chain + ' and keep the receipt token.', cost: '$' + capital + ' of capital' },
      { text: 'Use the receipt token once in a lending market on the same chain, then return it to the staking position.', cost: 'the receipt token' },
      { text: 'Stake a second tranche of $20 through ' + name + ' and keep both receipts, so the position grows rather than sitting still.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return [
      { text: 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedge no larger than a tenth of it.', cost: '$' + capital + ' of capital' },
      { text: 'Close the hedge and open a fresh one each month, so the account shows repeated trading rather than one trade.', cost: 'no new capital' },
      { text: 'Open a second small hedge of $20 in the opposite direction, so the account holds both sides.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('prediction') >= 0) return [
      { text: 'Fund $' + capital + ' on ' + name + ' and place one position on a market that resolves within the month.', cost: '$' + capital + ' of capital' },
      { text: 'Place one more $20 position the week the first resolves, so the account stays active across resolutions.', cost: 'about $20 of capital' },
      { text: 'Fund a second market with $20 that resolves after the first, so the account spans two resolutions.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('rwa') >= 0) return [
      { text: "Mint $" + capital + " of the protocol's yield-bearing asset on " + chain + ' and hold it in the farming wallet.', cost: '$' + capital + ' of capital' },
      { text: "Claim the asset's yield once and hold the claim in the same wallet, so the holding and the claim are linked.", cost: 'the claimed yield' },
      { text: 'Buy a second $20 tranche of the yield-bearing asset after the first yield claim, so the position compounds.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('stable') >= 0) return [
      { text: 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it.', cost: '$' + capital + ' of capital' },
      { text: 'Redeem $10 of the stable asset and mint it back, so the wallet shows both directions of the peg.', cost: 'about $10 of capital' },
      { text: 'Deposit $20 of the stable asset into a lending market on the same chain, so it earns yield while the wallet holds the peg.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('insurance') >= 0) return [
      { text: 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy for its full term.', cost: '$' + capital + ' of capital' },
      { text: 'File one test claim for $1 on a covered event, or extend the cover by a month, so the policy is active.', cost: 'about $1 of capital' },
      { text: 'Buy $20 of extra cover on a second event, so the wallet holds two policies.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return [
      { text: 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares for the full hold.', cost: '$' + capital + ' of capital' },
      { text: 'Move a tenth of the deposit to a second ' + name + ' vault once, so the wallet is spread across its strategies.', cost: 'a tenth of the deposit' },
      { text: 'Deposit a second $20 into the second vault after the first move, so both strategies keep growing.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('launchpad') >= 0) return [
      { text: 'Stake $' + capital + ' of the qualifying asset on ' + name + ' to meet its sale threshold on ' + chain + '.', cost: '$' + capital + ' of capital' },
      { text: 'Join one token sale the stake qualifies for, with the smallest allocation it allows.', cost: 'the smallest allocation it allows' },
      { text: 'Top up the stake by $20 once, so the qualifying balance grows rather than sitting still.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('payment') >= 0) return [
      { text: 'Pay one $20 invoice through ' + name + ' on ' + chain + ' from the farming wallet.', cost: '$' + capital + ' of capital' },
      { text: 'Set up one recurring payment of $10 a month through ' + name + ', so the wallet shows repeated use.', cost: 'about $10 of capital a month' },
      { text: 'Pay a second $20 invoice to a different recipient, so the wallet shows more than one counterparty.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('privacy') >= 0) return [
      { text: 'Deposit $' + capital + ' into ' + name + "'s shielded pool on " + chain + ' and keep the note.', cost: '$' + capital + ' of capital' },
      { text: 'Withdraw $10 from the shielded pool to a fresh address, then deposit it back, so both directions are used.', cost: 'about $10 of capital' },
      { text: 'Deposit a second $20 into the shielded pool after the first withdrawal, so the pool sees repeated use.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('nft') >= 0) return [
      { text: 'List one item for sale on ' + name + ' on ' + chain + ' at a price near the floor.', cost: '$' + capital + ' of capital' },
      { text: 'Buy one low-cost item on ' + name + ' and hold it, so the wallet is both a seller and a buyer.', cost: 'one low-cost item' },
      { text: 'Make a $20 offer below the floor on an item you want, so the wallet bids as well as buys and sells.', cost: 'about $20 of capital' }
    ];
    if (c.indexOf('index') >= 0) return [
      { text: 'Buy $' + capital + " of " + name + "'s index token on " + chain + ' and hold it.', cost: '$' + capital + ' of capital' },
      { text: 'Rebalance the index holding once, selling a tenth and buying it back, so the position is managed.', cost: 'a tenth of the holding' },
      { text: 'Add $20 to the index holding after the first rebalance, so the position grows.', cost: 'about $20 of capital' }
    ];
    return [
      { text: 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.', cost: '$' + capital + ' of capital' },
      { text: 'Make one swap of $10 through ' + name + ' once a week, so the wallet shows repeated use of the app.', cost: 'about $10 of capital' },
      { text: 'Deposit $20 into a second feature of the same protocol, such as its vault or its swap, so the wallet uses more than one part of the app.', cost: 'about $20 of capital' }
    ];
  }
  function claimSurface(p) {
    var c = (p.category || '').toLowerCase();
    if (c.indexOf('yield') >= 0 || c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0) return 'the vault yield';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'the staking rewards';
    if (c.indexOf('prediction') >= 0) return 'the market winnings';
    if (c.indexOf('insurance') >= 0) return 'the cover payout';
    if (c.indexOf('launchpad') >= 0) return 'the sale allocation';
    if (c.indexOf('index') >= 0) return 'the index yield';
    if (c.indexOf('rwa') >= 0) return 'the asset yield';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'the trading rewards';
    return 'the points';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var gas = gasFor(chain);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var trio = actionsFor(p, capital, chain);
    var surface = claimSurface(p);
    return [
      { text: 'Use a fresh wallet on ' + chain + ' that holds only the funds you plan to farm, and write its seed phrase on paper, never in a chat or a file.', cost: gas.tx, time: '5 minutes' },
      { text: trio[0].text, cost: trio[0].cost + ' and ' + gas.tx, time: '15 minutes to set up' },
      { text: trio[1].text, cost: trio[1].cost + ' and ' + gas.tx, time: '10 minutes' },
      { text: trio[2].text, cost: trio[2].cost + ' and ' + gas.tx, time: '10 minutes' },
      { text: 'Hold the position for at least ' + hold + ' days and do one qualifying action each week during the hold, so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open the protocol's own rewards page and claim " + surface + ' only from the link it publishes; never pay anyone to claim for you.', cost: 'no fee to check', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction hash in a farm log, and plan the unwind: withdraw half ($' + (capital / 2) + ') on day one and the rest on day two.', cost: 'nothing but the log', time: '10 minutes' }
    ].map(stepText);
  }

  // --- state in the hash, so a view is a link --------------------------------------------
  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('wl') === '1') state.wl = true;
    if (params.get('tab')) state.tab = params.get('tab');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.wl) params.set('wl', '1');
    if (state.tab !== 'pre-token') params.set('tab', state.tab);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.wl && !r.on_watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'net') { av = a.farm_net_usd; bv = b.farm_net_usd; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'ring' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function hero() {
    return el('section', { class: 'hero' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', null,
          'The watchlist is the floor: every protocol with at least ', el('b', { text: '$' + Math.round(DATA.floor_usd / 1e6) + 'M' }),
          ' of TVL and no token on record. The early radar adds ', el('b', { text: String(DATA.early_size) }),
          ' pre-token protocols the list leaves out, chosen by the model, not by raw TVL. Implied value is a model, not a promise — and never a prediction that a token launches.'
        )
      ),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size }), el('span', { text: 'Watchlist covered' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'Pre-token rows scored' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.early_size) }), el('span', { text: 'Early rows the list leaves out' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.live_size) }), el('span', { text: 'Live-token protocols set aside' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var wlBox = el('input', { type: 'checkbox', id: 'wl', checked: state.wl ? 'checked' : null, 'aria-label': 'Watchlist only' });
    wlBox.addEventListener('change', function () { state.wl = wlBox.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('label', { class: 'check', for: 'wl' }, wlBox, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { class: 'label', text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.wl = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied_value_usd || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('span', null, el('b', { text: r.name }), r.on_watchlist ? el('span', { class: 'badge', text: 'WL' }) : null),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('span', { class: 'tag ' + r.farm_verdict, text: r.farm_verdict + ' ' + (r.farm_net_usd >= 0 ? '+' : '') + '$' + r.farm_net_usd.toFixed(2) })),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'tag', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', { id: 'board-table' },
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('net', 'Farm net'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'tag live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    var f = DATA.fit;
    var o = DATA.oos;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One fitted curve scores every row. No protocol name is special-cased, and no row is hand-picked.' }),
      el('div', { class: 'formula' },
        'implied = round( exp(' + f.intercept + ' + ' + f.slope + ' x ln(tvl_usd)) x (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 x ' + m.growth_weight + ') x (' + m.maturity_floor + ' + min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ' x ' + m.maturity_range + ') )'
      ),
      el('p', { class: 'sub', text: 'The curve is log(market cap) on log(TVL), fitted by least squares on the ' + f.comps + ' tokenized protocols in this snapshot (exchanges excluded) — the market pays a smaller multiple as a protocol grows, so the slope is below 1. Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses ' + m.unknown_age_days + ' days.' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Comps fitted' }), el('b', { class: 'num', text: String(f.comps) + ' tokenized protocols' })),
        el('div', null, el('span', { text: 'Slope (log-log)' }), el('b', { class: 'num', text: String(f.slope) + '  [90% bootstrap ' + f.slope_low + ' to ' + f.slope_high + ']' })),
        el('div', null, el('span', { text: 'Intercept' }), el('b', { class: 'num', text: String(f.intercept) + '  [90% bootstrap ' + f.intercept_low + ' to ' + f.intercept_high + ']' }))
      ),
      el('h3', { text: 'Tested blind, five folds' }),
      el('p', { class: 'sub', text: 'Each fold holds out a fifth of the comps and fits the curve on the other four, so the curve never sees the protocol it scores. The old sector-median model is scored on the same split. Median |log error| is the typical miss in log points — a miss of 1.2 means the value is typically off by about 3.3x; within 2x is the share of held-out protocols priced within a factor of two.' }),
      el('table', { class: 'sectors' },
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Model' }),
          el('th', { scope: 'col', class: 'num', text: 'Median |log error|' }),
          el('th', { scope: 'col', class: 'num', text: 'Within 2x' }),
          el('th', { scope: 'col', class: 'num', text: 'Protocols' })
        )),
        el('tbody', null,
          el('tr', null, el('td', { text: 'radar-5 (this board), all comps' }), el('td', { class: 'num', text: String(o.radar5.median_abs_log) }), el('td', { class: 'num', text: Math.round(o.radar5.within_2x * 100) + '%' }), el('td', { class: 'num', text: String(o.radar5.n) })),
          el('tr', null, el('td', { text: 'radar-4 (sector median), all comps' }), el('td', { class: 'num', text: String(o.radar4.median_abs_log) }), el('td', { class: 'num', text: Math.round(o.radar4.within_2x * 100) + '%' }), el('td', { class: 'num', text: String(o.radar4.n) })),
          el('tr', null, el('td', { text: 'radar-5, TVL at least $50M' }), el('td', { class: 'num', text: String(o.radar5_large.median_abs_log) }), el('td', { class: 'num', text: Math.round(o.radar5_large.within_2x * 100) + '%' }), el('td', { class: 'num', text: String(o.radar5_large.n) })),
          el('tr', null, el('td', { text: 'radar-4, TVL at least $50M' }), el('td', { class: 'num', text: String(o.radar4_large.median_abs_log) }), el('td', { class: 'num', text: Math.round(o.radar4_large.within_2x * 100) + '%' }), el('td', { class: 'num', text: String(o.radar4_large.n) }))
        )
      ),
      el('h3', { text: 'Farm economics, netted to the dollar' }),
      el('p', { class: 'sub', text: 'Each plan is netted as expected value minus gas minus the yield its capital forgoes. The expected value assumes the launch gives ' + Math.round(m.allocation_share * 100) + '% of supply to farmers, split among the wallets doing the qualifying actions — one wallet per $' + m.typical_position_usd.toLocaleString('en-US') + ' of TVL, capped at ' + m.farmer_cap.toLocaleString('en-US') + ' wallets, because the snapshot records TVL, not wallets. The reward is per active wallet, not pro-rata to capital: airdrops pay for actions. Gas is one setup, one transaction a week of the hold, one claim and two to unwind, at the chain\u2019s own price. The capital forgoes ' + Math.round(m.opportunity_apy * 100) + '% a year over the hold. The verdict is farm when the net clears $' + m.farm_threshold_usd + ', thin when it clears $0, and skip when it does not.' }),
      el('h3', { text: 'What the market pays per category (reference only)' }),
      el('p', { class: 'sub', text: 'Category medians were tested as pricing inputs and made the blind error worse, so they do not price anything here — they are shown so the choice is visible.' }),
      el('table', { class: 'sectors' },
        el('thead', null, el('tr', null,
          el('th', { scope: 'col', text: 'Category' }),
          el('th', { scope: 'col', class: 'num', text: 'Comps' }),
          el('th', { scope: 'col', class: 'num', text: 'Median multiple' })
        )),
        el('tbody', null, DATA.category_reference.map(function (s) {
          return el('tr', null,
            el('td', { text: s.category }),
            el('td', { class: 'num', text: String(s.comps) }),
            el('td', { class: 'num', text: s.median_multiple.toFixed(2) + 'x' })
          );
        }))
      )
    );
  }

  var panel = el('aside', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title', hidden: '' });
  function closeDetail() {
    state.selected = null;
    panel.setAttribute('hidden', '');
    writeHash();
  }

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    panel.textContent = '';
    panel.removeAttribute('hidden');
    var steps = farmSteps(row);
    var recomputed = impliedOf(row, DATA.model);
    panel.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.on_watchlist ? ' · watchlist' : ' · early radar') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: closeDetail })
    ));
    panel.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Size curve value' }), el('b', { class: 'num', text: fmtUsd(row.curve_value_usd) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Growth multiplier' }), el('b', { class: 'num', text: String(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    panel.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm economics' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'Expected value' }), el('b', { class: 'num', text: '$' + row.farm_expected_usd.toFixed(2) })),
        el('div', null, el('span', { text: 'Gas for the plan' }), el('b', { class: 'num', text: '$' + row.farm_gas_usd.toFixed(2) })),
        el('div', null, el('span', { text: 'Yield the capital forgoes' }), el('b', { class: 'num', text: '$' + row.farm_opportunity_usd.toFixed(2) })),
        el('div', null, el('span', { text: 'Net' }), el('b', { class: 'num', text: (row.farm_net_usd >= 0 ? '+' : '') + '$' + row.farm_net_usd.toFixed(2) })),
        el('div', null, el('span', { text: 'Verdict' }), el('b', { class: 'num', text: row.farm_verdict }))
      ),
      el('p', { class: 'sub', text: 'Expected value assumes the launch gives 5% of supply to farmers, split among an estimated wallet count (one wallet per $1,000 of TVL, capped at 100,000). Farm when the net clears $10, thin when it clears $0, skip when it does not.' })
    ));
    panel.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    panel.appendChild(el('p', { class: 'note', text: 'A protocol records no token; that is not proof it has none. Farm with money you can afford to lose, and never pay anyone to claim an airdrop for you.' }));
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(hero());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!panel.isConnected) app.appendChild(panel);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !panel.hasAttribute('hidden')) closeDetail();
  });
})();
