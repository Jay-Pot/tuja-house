// 계산: 저장된 내용 + 시세 → 화면에 쓰는 합계들. 화면과 무관한 순수 계산만 둔다.
import { S, CATS, quote, fxUSD, sectorOf, put, today } from './store.js';

const sum = (arr, f) => arr.reduce((a, x) => a + (f(x) || 0), 0);

// 보유 종목 한 줄씩: 평가액(수량 × 현재가, 시세가 없으면 적어 둔 평가액), 손익, 오늘 변동
export function positions(memberId) {
  const acct = new Map(S.accounts.map((a) => [a.id, a]));
  return S.holdings.map((h) => {
    const a = acct.get(h.accountId);
    if (!a || (memberId && a.memberId !== memberId)) return null;
    const q = quote(h.name);
    const value = q ? h.qty * q.krw : (h.value || 0);
    const day = q ? value - value / (1 + q.chg / 100) : 0;
    const pl = h.cost != null && h.cost > 0 ? value - h.cost : null;
    return { ...h, account: a, memberId: a.memberId, q, value, day, pl, plPct: pl != null ? pl / h.cost : null, sector: sectorOf(h.name), cur: q?.cur || 'KRW' };
  }).filter(Boolean);
}

export const acctCash = (a) => (a.cashKRW || 0) + (a.cashUSD || 0) * fxUSD();

// 전체(또는 한 구성원) 요약
export function summary(memberId) {
  const pos = positions(memberId);
  const accounts = S.accounts.filter((a) => !memberId || a.memberId === memberId);
  const assets = S.assets.filter((a) => !memberId || a.memberId === memberId);
  const byCat = Object.fromEntries(CATS.map((c) => [c.key, 0]));
  byCat.stock = sum(pos, (p) => p.value);
  byCat.brokerCash = sum(accounts, acctCash);
  for (const a of assets) byCat[a.cat] = (byCat[a.cat] || 0) + (a.value || 0);
  const total = sum(Object.values(byCat), (v) => v);
  const withCost = pos.filter((p) => p.pl != null);
  const cost = sum(withCost, (p) => p.cost);
  const pl = sum(withCost, (p) => p.pl);
  const day = sum(pos, (p) => p.day);
  const usdStock = sum(pos.filter((p) => p.cur === 'USD'), (p) => p.value);
  const usdCash = sum(accounts, (a) => (a.cashUSD || 0) * fxUSD());
  // 통화별 투자 자산(원화 환산): 주식은 종목 통화, 예수금은 원화·달러, 예금·현금은 원화로 센다
  const byCur = {};
  for (const p of pos) byCur[p.cur] = (byCur[p.cur] || 0) + p.value;
  byCur.KRW = (byCur.KRW || 0) + sum(accounts, (a) => a.cashKRW || 0) + byCat.deposit;
  byCur.USD = (byCur.USD || 0) + usdCash;
  return {
    pos, accounts, assets, byCat, total, cost, pl, plPct: cost ? pl / cost : null, day,
    dayPct: total - day ? day / (total - day) : 0,
    names: new Set(pos.map((p) => p.name)).size,
    usd: usdStock + usdCash, usdStock, usdCash, byCur,
    liquid: byCat.brokerCash + byCat.deposit,
  };
}

// 종목별로 합치기(여러 계좌에 흩어진 같은 종목)
export function byName(pos) {
  const m = new Map();
  for (const p of pos) {
    const g = m.get(p.name) || { name: p.name, qty: 0, value: 0, cost: 0, hasCost: true, day: 0, q: p.q, sector: p.sector, rows: [] };
    g.qty += p.qty || 0; g.value += p.value; g.day += p.day;
    if (p.cost != null && p.cost > 0) g.cost += p.cost; else g.hasCost = false;
    g.rows.push(p);
    m.set(p.name, g);
  }
  return [...m.values()].map((g) => ({ ...g, pl: g.hasCost ? g.value - g.cost : null, plPct: g.hasCost && g.cost ? (g.value - g.cost) / g.cost : null }));
}

// 업종별 합계
export function bySector(pos) {
  const m = new Map();
  for (const g of byName(pos)) {
    const s = m.get(g.sector) || { sector: g.sector, value: 0, pl: 0, hasPl: false, day: 0, names: [] };
    s.value += g.value; s.day += g.day;
    if (g.pl != null) { s.pl += g.pl; s.hasPl = true; }
    s.names.push(g.name);
    m.set(g.sector, s);
  }
  return [...m.values()].sort((a, b) => b.value - a.value);
}

// 예상 연 배당(세전): 지난 1년 동안 준 주당 배당 × 지금 수량
export function dividends(pos) {
  const rows = byName(pos).map((g) => ({ name: g.name, amount: g.q && g.q.div ? g.qty * g.q.div * g.q.fx : 0, yield: g.q && g.q.div ? g.q.div / g.q.raw : 0 })).filter((r) => r.amount > 0);
  rows.sort((a, b) => b.amount - a.amount);
  return { rows, total: sum(rows, (r) => r.amount) };
}

// 매매일지 → 달마다 넣은 돈(매수 − 매도)
export function monthlyNet(memberId, months = 12) {
  const acct = new Map(S.accounts.map((a) => [a.id, a]));
  const m = new Map();
  for (const t of S.trades) {
    if (memberId && acct.get(t.accountId)?.memberId !== memberId) continue;
    const k = t.date.slice(0, 7);
    const g = m.get(k) || { month: k, buy: 0, sell: 0 };
    g[t.side === 'buy' ? 'buy' : 'sell'] += t.qty * t.price;
    m.set(k, g);
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-months).map((g) => ({ ...g, net: g.buy - g.sell }));
}

// 하루에 한 번, 그날 총자산을 자산 추이에 남긴다(같은 날이면 덮어쓴다).
export function snapshot() {
  const all = summary();
  if (!all.total) return;
  const byMember = Object.fromEntries(S.members.map((m) => [m.id, Math.round(summary(m.id).total)]));
  const id = today();
  const old = S.history.find((h) => h.id === id);
  const next = { id, date: id, total: Math.round(all.total), stock: Math.round(all.byCat.stock), byMember };
  if (old && old.total === next.total && old.stock === next.stock) return;
  if (old && Date.now() - (old.u || 0) < 30 * 60 * 1000) return; // 시세가 움직일 때마다 올리지 않도록 30분에 한 번만
  put('history', next);
  S.history.sort((a, b) => a.id.localeCompare(b.id));
}

// 매매 기록을 잔고에 반영: 수량·매입금액, 그리고 그 계좌 원화 예수금
export function applyTrade(t) {
  const sign = t.side === 'buy' ? 1 : -1;
  const amt = t.qty * t.price;
  let h = S.holdings.find((x) => x.accountId === t.accountId && x.name === t.name);
  if (!h) {
    if (sign < 0) return;
    h = { accountId: t.accountId, name: t.name, qty: 0, value: 0, cost: 0 };
  }
  const unit = h.qty ? (h.value || 0) / h.qty : t.price;
  if (h.cost != null) h.cost = sign > 0 ? h.cost + amt : (h.qty ? h.cost * Math.max(0, h.qty - t.qty) / h.qty : 0);
  h.qty = Math.max(0, h.qty + sign * t.qty);
  h.value = Math.max(0, sign > 0 ? (h.value || 0) + amt : unit * h.qty);
  put('holdings', h);
  const a = S.accounts.find((x) => x.id === t.accountId);
  if (a) { a.cashKRW = Math.max(0, (a.cashKRW || 0) - sign * amt); put('accounts', a); }
}
