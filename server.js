/**
 * Meme Trade Bot - Server (zero external deps version)
 * Inspired by YZYLAB/solana-trade-bot + piotrostr/listen
 *
 * Demo mode is fully functional. Real trading requires extra setup.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;

// ====================== STATE ======================
let botState = {
  isRunning: false,
  mode: 'demo',
  startedAt: null,
  paperBalance: 10.0,
  solPriceUSD: 175.0,
  positions: [],
  tradeHistory: [],
  discoveredTokens: [],
  settings: {
    tradeAmountSOL: 0.1,
    maxPositions: 5,
    stopLossPercent: -40,
    takeProfitPercent: 80,
    minLiquidityUSD: 5000,
    maxMarketCapUSD: 500000,
    minHolders: 20,
    slippagePercent: 12,
    priorityFee: 0.00005,
    markets: ['pumpfun', 'raydium', 'jupiter'],
    autoSell: true,
  },
  stats: {
    totalTrades: 0,
    wins: 0,
    losses: 0,
    totalPnL: 0,
  }
};

const MEME_NAMES = [
  'DogeKiller', 'PepeMoon', 'CatWifHat', 'BonkAI', 'SolanaChad',
  'RugProof', 'MoonBag', 'DiamondPaws', 'LaserEyes', 'BasedFrog',
  'WojakPump', 'GigachadSOL', 'NyanCatSol', 'ShibaInuX', 'MemeLord',
  'PumpKing', 'DegenApe', 'WhaleAlert', 'FOMOCoin', 'HODLer'
];

const TICKERS = ['DKILL', 'PEPEM', 'CWH', 'BONKAI', 'SCHAD', 'RUGP', 'MBAG', 'DPAWS', 'LEYES', 'BFROG',
  'WOJAK', 'GIGA', 'NYAN', 'SHIBX', 'MLORD', 'PKING', 'DAPE', 'WHALE', 'FOMO', 'HODL'];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function generateMockToken() {
  const idx = Math.floor(Math.random() * MEME_NAMES.length);
  const name = MEME_NAMES[idx] + Math.floor(Math.random() * 99);
  const symbol = TICKERS[idx] + Math.floor(Math.random() * 9);
  const mint = uid().replace(/[^a-z0-9]/gi, '') + 'pump';
  const liquidity = 2000 + Math.random() * 80000;
  const marketCap = liquidity * (2 + Math.random() * 15);
  const holders = 10 + Math.floor(Math.random() * 400);
  const price = (marketCap / 1e9) * (0.8 + Math.random() * 0.4);

  return {
    id: uid(),
    mint,
    name,
    symbol,
    price,
    liquidityUSD: Math.round(liquidity),
    marketCapUSD: Math.round(marketCap),
    holders,
    ageSeconds: Math.floor(Math.random() * 120),
    riskScore: Math.floor(Math.random() * 10),
    socials: Math.random() > 0.4,
    source: botState.settings.markets[Math.floor(Math.random() * botState.settings.markets.length)],
    discoveredAt: Date.now(),
    priceHistory: [price]
  };
}

function updatePrices() {
  // Slight SOL price fluctuation for realistic USD balance
  botState.solPriceUSD = Math.max(140, Math.min(220, botState.solPriceUSD + (Math.random() - 0.5) * 1.5));

  botState.positions.forEach(pos => {
    const change = (Math.random() - 0.48) * 0.12;
    pos.currentPrice = Math.max(pos.currentPrice * (1 + change), 0.0000001);
    pos.pnlPercent = ((pos.currentPrice - pos.entryPrice) / pos.entryPrice) * 100;
    pos.pnlSOL = (pos.amountTokens * pos.currentPrice) - pos.costSOL;
    pos.priceHistory.push(pos.currentPrice);
    if (pos.priceHistory.length > 60) pos.priceHistory.shift();
  });

  botState.discoveredTokens.forEach(t => {
    const change = (Math.random() - 0.5) * 0.08;
    t.price = Math.max(t.price * (1 + change), 0.0000001);
    t.priceHistory.push(t.price);
    if (t.priceHistory.length > 30) t.priceHistory.shift();
  });
}

function runTradingCycle() {
  if (!botState.isRunning || botState.mode !== 'demo') return;

  if (Math.random() < 0.35 && botState.discoveredTokens.length < 25) {
    const token = generateMockToken();
    botState.discoveredTokens.unshift(token);
    if (botState.discoveredTokens.length > 30) botState.discoveredTokens.pop();
  }

  if (botState.positions.length < botState.settings.maxPositions) {
    const candidates = botState.discoveredTokens.filter(t => {
      return t.liquidityUSD >= botState.settings.minLiquidityUSD &&
             t.marketCapUSD <= botState.settings.maxMarketCapUSD &&
             t.holders >= botState.settings.minHolders &&
             t.riskScore <= 7 &&
             !botState.positions.find(p => p.mint === t.mint) &&
             (Date.now() - t.discoveredAt) < 45000;
    });

    if (candidates.length > 0 && Math.random() < 0.4) {
      const pick = candidates[Math.floor(Math.random() * Math.min(3, candidates.length))];
      executeBuy(pick);
    }
  }

  if (botState.settings.autoSell) {
    const toClose = [];
    botState.positions.forEach(pos => {
      if (pos.pnlPercent <= botState.settings.stopLossPercent ||
          pos.pnlPercent >= botState.settings.takeProfitPercent) {
        toClose.push(pos);
      }
    });
    toClose.forEach(pos => executeSell(pos, pos.pnlPercent >= botState.settings.takeProfitPercent ? 'TP' : 'SL'));
  }

  updatePrices();
}

function executeBuy(token) {
  const amountSOL = botState.settings.tradeAmountSOL;
  if (botState.paperBalance < amountSOL + 0.005) return;

  const fee = amountSOL * 0.01;
  const cost = amountSOL + fee;
  botState.paperBalance -= cost;

  const tokensBought = amountSOL / token.price;

  const position = {
    id: uid(),
    mint: token.mint,
    name: token.name,
    symbol: token.symbol,
    entryPrice: token.price,
    currentPrice: token.price,
    amountTokens: tokensBought,
    costSOL: amountSOL,
    pnlPercent: 0,
    pnlSOL: 0,
    openedAt: Date.now(),
    source: token.source,
    priceHistory: [token.price]
  };

  botState.positions.push(position);
  botState.stats.totalTrades++;

  botState.tradeHistory.unshift({
    id: uid(),
    type: 'BUY',
    symbol: token.symbol,
    name: token.name,
    amountSOL,
    price: token.price,
    timestamp: Date.now(),
    reason: 'Strategy entry'
  });

  console.log(`[BUY] ${token.symbol} @ ${token.price.toFixed(8)} | Cost: ${amountSOL} SOL`);
}

function executeSell(position, reason = 'Manual') {
  const proceeds = position.amountTokens * position.currentPrice;
  const fee = proceeds * 0.01;
  const net = proceeds - fee;

  botState.paperBalance += net;
  const pnl = net - position.costSOL;
  botState.stats.totalPnL += pnl;

  if (pnl >= 0) botState.stats.wins++;
  else botState.stats.losses++;

  botState.tradeHistory.unshift({
    id: uid(),
    type: 'SELL',
    symbol: position.symbol,
    name: position.name,
    amountSOL: net,
    price: position.currentPrice,
    pnlPercent: position.pnlPercent,
    pnlSOL: pnl,
    timestamp: Date.now(),
    reason
  });

  botState.positions = botState.positions.filter(p => p.id !== position.id);
  console.log(`[SELL ${reason}] ${position.symbol} | PnL: ${pnl.toFixed(4)} SOL (${position.pnlPercent.toFixed(1)}%)`);
}

setInterval(() => {
  if (botState.isRunning) runTradingCycle();
}, 2500);

// ====================== HTTP SERVER ======================
const mime = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJSON(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  const pathname = parsed.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    return res.end();
  }

  if (pathname === '/api/state' && req.method === 'GET') {
    return sendJSON(res, 200, {
      ...botState,
      tradeHistory: botState.tradeHistory.slice(0, 50),
      discoveredTokens: botState.discoveredTokens.slice(0, 20)
    });
  }

  if (pathname === '/api/start' && req.method === 'POST') {
    if (botState.isRunning) return sendJSON(res, 200, { success: false, message: 'Bot already running' });
    botState.isRunning = true;
    botState.startedAt = Date.now();
    console.log('🚀 Bot STARTED (demo)');
    return sendJSON(res, 200, { success: true, message: 'Bot started' });
  }

  if (pathname === '/api/stop' && req.method === 'POST') {
    botState.isRunning = false;
    console.log('⏹ Bot STOPPED');
    return sendJSON(res, 200, { success: true, message: 'Bot stopped' });
  }

  if (pathname === '/api/settings' && req.method === 'POST') {
    const body = await parseBody(req);
    botState.settings = { ...botState.settings, ...body };
    return sendJSON(res, 200, { success: true, settings: botState.settings });
  }

  if (pathname === '/api/reset-demo' && req.method === 'POST') {
    botState.isRunning = false;
    botState.paperBalance = 10.0;
    botState.solPriceUSD = 175.0;
    botState.positions = [];
    botState.tradeHistory = [];
    botState.discoveredTokens = [];
    botState.stats = { totalTrades: 0, wins: 0, losses: 0, totalPnL: 0 };
    botState.startedAt = null;
    return sendJSON(res, 200, { success: true, message: 'Demo wallet reset to 10 SOL' });
  }

  if (pathname.startsWith('/api/sell/') && req.method === 'POST') {
    const id = pathname.split('/').pop();
    const pos = botState.positions.find(p => p.id === id);
    if (!pos) return sendJSON(res, 404, { success: false, message: 'Position not found' });
    executeSell(pos, 'Manual');
    return sendJSON(res, 200, { success: true });
  }

  if (pathname === '/api/mode' && req.method === 'POST') {
    return sendJSON(res, 200, {
      success: false,
      message: 'Live mode requires RPC + wallet signing. Stay in Demo. See README for real integration using the two GitHub repos.'
    });
  }

  if (pathname === '/api/health') {
    return sendJSON(res, 200, { status: 'ok', mode: botState.mode });
  }

  // Static files
  let filePath = path.join(__dirname, 'public', pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403); return res.end('Forbidden');
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (pathname !== '/') {
        filePath = path.join(__dirname, 'public', 'index.html');
        return fs.readFile(filePath, (err2, data2) => {
          if (err2) { res.writeHead(404); return res.end('Not found'); }
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(data2);
        });
      }
      res.writeHead(404);
      return res.end('Not found');
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('\n🚀 Meme Trade Bot running at http://localhost:' + PORT);
  console.log('   Mode: DEMO (paper trading with fake SOL)');
  console.log('   Open the URL, hit Start, and watch it trade!\n');
});
