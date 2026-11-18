/**
 * Meme Trade Bot - Frontend
 * Polls the local server for state and drives the UI.
 */

const API = '';

let state = null;
let pollTimer = null;

// DOM refs
const $ = (sel) => document.querySelector(sel);
const balanceValue = $('#balanceValue');
const pnlSummary = $('#pnlSummary');
const statusPill = $('#statusPill');
const statusText = $('#statusText');
const modeBadge = $('#modeBadge');
const btnStart = $('#btnStart');
const btnStop = $('#btnStop');
const btnReset = $('#btnReset');
const btnConnectWallet = $('#btnConnectWallet');
const btnSaveSettings = $('#btnSaveSettings');
const positionsList = $('#positionsList');
const tokenFeed = $('#tokenFeed');
const historyList = $('#historyList');
const posCount = $('#posCount');
const toastEl = $('#toast');

function showToast(msg, duration = 2800) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');
  setTimeout(() => toastEl.classList.add('hidden'), duration);
}

async function fetchState() {
  try {
    const res = await fetch(`${API}/api/state`);
    state = await res.json();
    render();
  } catch (err) {
    console.error('Failed to fetch state', err);
  }
}

function render() {
  if (!state) return;

  // Balance
  const solPrice = state.solPriceUSD || 175;
  const usdBalance = state.paperBalance * solPrice;
  balanceValue.innerHTML = `${state.paperBalance.toFixed(4)} <span>SOL</span>`;
  
  const balanceUSD = document.getElementById('balanceUSD');
  if (balanceUSD) {
    balanceUSD.textContent = `≈ $${usdBalance.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}`;
  }

  const pnl = state.stats.totalPnL;
  const pnlUsd = pnl * solPrice;
  pnlSummary.textContent = `PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(4)} SOL ($${pnlUsd >= 0 ? '+' : ''}${pnlUsd.toFixed(2)})`;
  pnlSummary.className = 'balance-sub ' + (pnl > 0 ? 'positive' : pnl < 0 ? 'negative' : '');

  // Status
  if (state.isRunning) {
    statusPill.classList.add('running');
    statusText.textContent = 'Running';
    btnStart.disabled = true;
    btnStop.disabled = false;
  } else {
    statusPill.classList.remove('running');
    statusText.textContent = 'Stopped';
    btnStart.disabled = false;
    btnStop.disabled = true;
  }

  modeBadge.textContent = state.mode === 'demo' ? 'DEMO MODE' : 'LIVE MODE';

  // Stats
  $('#statTrades').textContent = state.stats.totalTrades;
  $('#statWins').textContent = state.stats.wins;
  $('#statLosses').textContent = state.stats.losses;
  const total = state.stats.wins + state.stats.losses;
  $('#statWinRate').textContent = total > 0 ? `${Math.round((state.stats.wins / total) * 100)}%` : '—';

  // Positions
  posCount.textContent = state.positions.length;
  if (state.positions.length === 0) {
    positionsList.innerHTML = '<div class="empty">No open positions. Start the bot to begin trading.</div>';
  } else {
    positionsList.innerHTML = state.positions.map(p => {
      const cls = p.pnlPercent >= 0 ? 'pos' : 'neg';
      const sign = p.pnlPercent >= 0 ? '+' : '';
      return `
        <div class="pos-card">
          <div>
            <div class="name">${escapeHtml(p.name)}</div>
            <div class="symbol">${escapeHtml(p.symbol)}</div>
          </div>
          <div class="pnl ${cls}">${sign}${p.pnlPercent.toFixed(1)}%</div>
          <div class="meta">
            Entry ${p.entryPrice.toFixed(8)} → ${p.currentPrice.toFixed(8)} · 
            ${p.costSOL.toFixed(3)} SOL · ${p.source}
          </div>
          <div class="actions">
            <button class="btn-sell" data-id="${p.id}">Sell Now</button>
          </div>
        </div>
      `;
    }).join('');

    positionsList.querySelectorAll('.btn-sell').forEach(btn => {
      btn.addEventListener('click', () => sellPosition(btn.dataset.id));
    });
  }

  // Token feed
  if (!state.discoveredTokens || state.discoveredTokens.length === 0) {
    tokenFeed.innerHTML = '<div class="empty">Waiting for new launches...</div>';
  } else {
    tokenFeed.innerHTML = state.discoveredTokens.slice(0, 15).map(t => `
      <div class="token-item">
        <div class="left">
          <div class="name">${escapeHtml(t.name)} <span style="color:var(--text-muted);font-weight:400">$${escapeHtml(t.symbol)}</span></div>
          <div class="meta">Liq $${(t.liquidityUSD/1000).toFixed(1)}k · MC $${(t.marketCapUSD/1000).toFixed(0)}k · ${t.holders} holders</div>
        </div>
        <span class="source">${t.source}</span>
      </div>
    `).join('');
  }

  // History
  if (!state.tradeHistory || state.tradeHistory.length === 0) {
    historyList.innerHTML = '<div class="empty">No trades yet.</div>';
  } else {
    historyList.innerHTML = state.tradeHistory.slice(0, 25).map(h => {
      const typeCls = h.type.toLowerCase();
      const time = new Date(h.timestamp).toLocaleTimeString();
      let right = '';
      if (h.type === 'SELL' && h.pnlPercent != null) {
        const sign = h.pnlPercent >= 0 ? '+' : '';
        right = `${sign}${h.pnlPercent.toFixed(1)}%`;
      } else {
        right = `${h.amountSOL?.toFixed(3) || '—'} SOL`;
      }
      return `
        <div class="hist-item">
          <span class="type ${typeCls}">${h.type}</span>
          <div>
            <div class="sym">${escapeHtml(h.symbol)}</div>
            <div class="detail">${time} · ${h.reason || ''}</div>
          </div>
          <div class="right">${right}</div>
        </div>
      `;
    }).join('');
  }

  // Sync settings inputs (only if not focused)
  const settings = state.settings;
  if (document.activeElement?.id !== 'setAmount') $('#setAmount').value = settings.tradeAmountSOL;
  if (document.activeElement?.id !== 'setMaxPos') $('#setMaxPos').value = settings.maxPositions;
  if (document.activeElement?.id !== 'setSL') $('#setSL').value = settings.stopLossPercent;
  if (document.activeElement?.id !== 'setTP') $('#setTP').value = settings.takeProfitPercent;
  if (document.activeElement?.id !== 'setMinLiq') $('#setMinLiq').value = settings.minLiquidityUSD;
  if (document.activeElement?.id !== 'setMaxMC') $('#setMaxMC').value = settings.maxMarketCapUSD;
  $('#setAutoSell').checked = settings.autoSell;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Actions
btnStart.addEventListener('click', async () => {
  const res = await fetch(`${API}/api/start`, { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    showToast('🚀 Auto-trading started (Demo)');
    fetchState();
  } else {
    showToast(data.message || 'Failed to start');
  }
});

btnStop.addEventListener('click', async () => {
  const res = await fetch(`${API}/api/stop`, { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    showToast('⏹ Bot stopped');
    await fetchState();
    // Show cool report card after a short delay so state is fresh
    setTimeout(() => showTradeReport(), 300);
  }
});

btnReset.addEventListener('click', async () => {
  if (!confirm('Reset demo wallet to 10 SOL and clear all positions/history?')) return;
  const res = await fetch(`${API}/api/reset-demo`, { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    showToast('Demo wallet reset to 10 SOL');
    fetchState();
  }
});

btnConnectWallet.addEventListener('click', () => {
  showToast('Real wallet connect (Phantom/Solflare) is prepared in the codebase structure. For safety, this demo stays paper-only. See README for live integration steps using the two source repos.');
});

btnSaveSettings.addEventListener('click', async () => {
  const body = {
    tradeAmountSOL: parseFloat($('#setAmount').value) || 0.1,
    maxPositions: parseInt($('#setMaxPos').value) || 5,
    stopLossPercent: parseFloat($('#setSL').value) || -40,
    takeProfitPercent: parseFloat($('#setTP').value) || 80,
    minLiquidityUSD: parseFloat($('#setMinLiq').value) || 5000,
    maxMarketCapUSD: parseFloat($('#setMaxMC').value) || 500000,
    autoSell: $('#setAutoSell').checked
  };
  const res = await fetch(`${API}/api/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (data.success) {
    showToast('Settings saved');
    fetchState();
  }
});

async function sellPosition(id) {
  const res = await fetch(`${API}/api/sell/${id}`, { method: 'POST' });
  const data = await res.json();
  if (data.success) {
    showToast('Position sold');
    fetchState();
  }
}

// Boot
fetchState();
pollTimer = setInterval(fetchState, 1500);

// ====================== TRADE REPORT CARD ======================

function showTradeReport() {
  if (!state) return;
  const modal = document.getElementById('reportModal');
  if (!modal) return;
  drawReportCard();
  modal.classList.remove('hidden');
}

function hideTradeReport() {
  const modal = document.getElementById('reportModal');
  if (modal) modal.classList.add('hidden');
}

function drawReportCard() {
  const canvas = document.getElementById('reportCanvas');
  if (!canvas || !state) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0e14');
  bg.addColorStop(0.5, '#12161f');
  bg.addColorStop(1, '#0d111a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle grid
  ctx.strokeStyle = 'rgba(20, 241, 149, 0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y < H; y += 30) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Top accent bar
  const accent = ctx.createLinearGradient(0, 0, W, 0);
  accent.addColorStop(0, '#14f195');
  accent.addColorStop(1, '#00d4ff');
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 6);

  // Title
  ctx.fillStyle = '#14f195';
  ctx.font = 'bold 22px Inter, system-ui, sans-serif';
  ctx.fillText('⚡ MEME TRADE BOT', 32, 48);

  ctx.fillStyle = '#8b95a8';
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.fillText('SESSION REPORT  •  DEMO MODE', 32, 72);

  // Date
  const now = new Date();
  ctx.fillStyle = '#8b95a8';
  ctx.font = '12px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.fillText(now.toLocaleString(), W - 32, 48);
  ctx.textAlign = 'left';

  // Big PnL
  const pnl = state.stats.totalPnL || 0;
  const solPrice = state.solPriceUSD || 175;
  const pnlUsd = pnl * solPrice;
  const isProfit = pnl >= 0;

  ctx.fillStyle = isProfit ? 'rgba(20, 241, 149, 0.08)' : 'rgba(255, 77, 106, 0.08)';
  roundRect(ctx, 32, 100, W - 64, 110, 16);
  ctx.fill();

  ctx.strokeStyle = isProfit ? 'rgba(20, 241, 149, 0.35)' : 'rgba(255, 77, 106, 0.35)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, 32, 100, W - 64, 110, 16);
  ctx.stroke();

  ctx.fillStyle = '#8b95a8';
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.fillText(isProfit ? 'TOTAL PROFIT' : 'TOTAL LOSS', 52, 130);

  ctx.fillStyle = isProfit ? '#14f195' : '#ff4d6a';
  ctx.font = 'bold 42px JetBrains Mono, monospace';
  const sign = isProfit ? '+' : '';
  ctx.fillText(sign + pnl.toFixed(4) + ' SOL', 52, 178);

  ctx.fillStyle = isProfit ? 'rgba(20, 241, 149, 0.8)' : 'rgba(255, 77, 106, 0.8)';
  ctx.font = '16px JetBrains Mono, monospace';
  ctx.fillText('≈ ' + sign + '$' + Math.abs(pnlUsd).toFixed(2), 52, 200);

  // Stats boxes
  const statsY = 240;
  const boxW = (W - 64 - 24) / 3;
  const totalClosed = (state.stats.wins || 0) + (state.stats.losses || 0);
  const winRate = totalClosed > 0 ? Math.round((state.stats.wins / totalClosed) * 100) + '%' : '—';

  const stats = [
    { label: 'TRADES', value: String(state.stats.totalTrades || 0) },
    { label: 'WIN RATE', value: winRate },
    { label: 'BALANCE', value: (state.paperBalance || 0).toFixed(2) + ' SOL' }
  ];

  stats.forEach((s, i) => {
    const x = 32 + i * (boxW + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    roundRect(ctx, x, statsY, boxW, 70, 12);
    ctx.fill();

    ctx.fillStyle = '#8b95a8';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.fillText(s.label, x + 14, statsY + 26);

    ctx.fillStyle = '#e8ecf4';
    ctx.font = 'bold 18px JetBrains Mono, monospace';
    ctx.fillText(s.value, x + 14, statsY + 52);
  });

  // Footer
  ctx.fillStyle = '#5a6478';
  ctx.font = '11px Inter, system-ui, sans-serif';
  ctx.fillText('Demo only  •  Not financial advice  •  meme-trade-bot', 32, H - 28);

  // Corner accent
  ctx.strokeStyle = 'rgba(20, 241, 149, 0.25)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W - 40, H - 20);
  ctx.lineTo(W - 20, H - 20);
  ctx.lineTo(W - 20, H - 40);
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// Modal buttons
document.getElementById('closeReport')?.addEventListener('click', hideTradeReport);
document.getElementById('closeReport2')?.addEventListener('click', hideTradeReport);
document.querySelector('#reportModal .modal-backdrop')?.addEventListener('click', hideTradeReport);

document.getElementById('downloadReport')?.addEventListener('click', () => {
  const canvas = document.getElementById('reportCanvas');
  if (!canvas) return;
  const link = document.createElement('a');
  const pnl = state?.stats?.totalPnL || 0;
  const tag = pnl >= 0 ? 'profit' : 'loss';
  link.download = 'meme-bot-report-' + tag + '-' + Date.now() + '.png';
  link.href = canvas.toDataURL('image/png');
  link.click();
  showToast('Image downloaded!');
});
