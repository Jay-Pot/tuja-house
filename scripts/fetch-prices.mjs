// 시세 받아 오기 — 깃허브 Actions(또는 내 컴퓨터의 node)가 돌린다. 설치할 것 없음(node 18 이상).
//   node scripts/fetch-prices.mjs [출력폴더] [--full]
// 만드는 파일
//   prices.json     대표 종목(data/tickers.json): 현재가, 등락, 60·200일선, 52주 고저, 최근 1년 배당 + 시장 지표
//   all-<시장>.json  상장 종목 전체(kr 국내 · us 미국 · jp 일본 · hk 홍콩 · cn 중국 · vn 베트남): 이름, 코드, 현재가, 등락 — 종목 검색과 시세용
//   h/<코드>.json    대표 종목의 일봉 200일 + 200일선 (종목 차트를 열 때만 읽는다)
// 평소에는 장이 열린 쪽(한국/미국)의 현재가만 새로 받고, 일봉·배당은 --full(장 마감 뒤·수동 실행·처음)일 때만 받는다.
// 못 받은 것은 출력폴더에 있던 직전 값을 그대로 둔다.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' };
const args = process.argv.slice(2);
const outDir = args.find((a) => !a.startsWith('--')) || fileURLToPath(new URL('../data/', import.meta.url));
const KEEP = 200;       // 상세 차트에 쓰는 거래일 수
const US_PAGES = 10;    // 미국 거래소마다 시가총액 상위 몇 쪽(쪽당 100종목)

const tickers = JSON.parse(await readFile(new URL('../data/tickers.json', import.meta.url), 'utf8'));
const names = Object.keys(tickers).filter((k) => !k.startsWith('_'));
const num = (s) => Number(String(s ?? '').replace(/,/g, ''));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const keyOf = (n) => tickers[n].code || tickers[n].symbol;

async function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: UA, signal: AbortSignal.timeout(12000) });
      if (r.ok) return await r.json();
      if (r.status === 404 || r.status === 400) return null;
    } catch { /* 다시 시도 */ }
    await new Promise((res) => setTimeout(res, 800 * (i + 1)));
  }
  return null;
}
const readJSON = async (p) => { try { return JSON.parse((await readFile(p, 'utf8')).replace(/^﻿/, '')); } catch { return null; } };

await mkdir(join(outDir, 'h'), { recursive: true });
const prevData = await readJSON(join(outDir, 'prices.json'));

// ── 전체 종목 훑기(네이버 시가총액 순 목록: 이름·코드·현재가·등락이 한 번에 온다) ──
// 시장마다 파일을 나눈다: all-kr(국내) · all-us(미국) · all-jp(일본) · all-hk(홍콩) · all-cn(중국) · all-vn(베트남)
async function pages(urlOf, maxPages) {
  const out = [];
  for (let p = 1; p <= maxPages; p++) {
    const j = await getJSON(urlOf(p));
    const list = j?.stocks || [];
    out.push(...list);
    if (list.length < 100) break;
  }
  return out;
}
const MKT = ['kr', 'us', 'jp', 'hk', 'cn', 'vn'];
const CUR = { kr: 'KRW', us: 'USD', jp: 'JPY', hk: 'HKD', cn: 'CNY', vn: 'VND' };
const all = {}, swept = {};
for (const m of MKT) all[m] = (await readJSON(join(outDir, `all-${m}.json`)))?.items || {};
const firstRun = !Object.keys(all.kr).length;

const full = args.includes('--full') || !prevData || firstRun;
const now0 = new Date(), hour = now0.getUTCHours(), minute = now0.getUTCMinutes();
let doKR = full || args.includes('--kr') || hour <= 7;                    // 한국 장: 09~16시 KST
let doUS = full || args.includes('--us') || (hour >= 13 && hour <= 21);   // 미국 장: 22:30~06시 KST 무렵
if (!doKR && !doUS) doKR = doUS = true;
const doAsia = full || args.includes('--asia') || (hour <= 8 && minute < 15); // 일본·홍콩·중국·베트남은 장중 한 시간에 한 번

// 국내·일본 등: 이름 → [코드, 거래소, 현재가, 등락%]   (같은 이름이 또 나오면 뒤에 코드를 붙인다)
function put(map, name, row) { map[map[name] && map[name][0] !== row[0] ? `${name} ${row[0]}` : name] = row; }
if (doKR) {
  const kr = {};
  for (const [mkt, path] of [['KS', 'KOSPI'], ['KQ', 'KOSDAQ']]) {
    for (const s of await pages((p) => `https://m.stock.naver.com/api/stocks/marketValue/${path}?page=${p}&pageSize=100`, 40)) {
      const price = num(s.closePrice);
      if (s.stockName && s.itemCode && price) put(kr, s.stockName, [s.itemCode, mkt, price, num(s.fluctuationsRatio) || 0]);
    }
  }
  if (Object.keys(kr).length > 500) { all.kr = kr; swept.kr = true; } // 일부만 받아졌으면 직전 목록을 그대로 둔다
}
const world = (ex, max) => pages((p) => `https://api.stock.naver.com/stock/exchange/${ex}/marketValue?page=${p}&pageSize=100`, max);
if (doUS) {
  const us = {}; // 미국: 심볼 → [한글 이름, 거래소, 현재가, 등락%]
  for (const ex of ['NASDAQ', 'NYSE', 'AMEX']) {
    for (const s of await world(ex, 60)) {
      const price = num(s.closePrice);
      if (s.symbolCode && price && !us[s.symbolCode]) us[s.symbolCode] = [s.stockName || s.stockNameEng || s.symbolCode, ex, price, num(s.fluctuationsRatio) || 0];
    }
  }
  if (Object.keys(us).length > 300) { all.us = us; swept.us = true; }
}
if (doAsia) {
  for (const [m, exs, min] of [['jp', ['TOKYO'], 300], ['hk', ['HONG_KONG'], 300], ['cn', ['SHANGHAI', 'SHENZHEN'], 300], ['vn', ['HOCHIMINH', 'HANOI'], 50]]) {
    const map = {};
    for (const ex of exs) {
      for (const s of await world(ex, 60)) {
        const price = num(s.closePrice);
        if (s.stockName && s.symbolCode && price) put(map, s.stockName, [s.symbolCode, ex, price, num(s.fluctuationsRatio) || 0]);
      }
    }
    if (Object.keys(map).length > min) { all[m] = map; swept[m] = true; }
  }
}

// 야후 표기(일봉용): 일본 .T · 홍콩 .HK(네 자리) · 상하이 .SS · 선전 .SZ
const yahooOf = (m, row) => (m === 'kr' ? `${row[0]}.${row[1]}` : m === 'jp' ? `${row[0]}.T` : m === 'hk' ? `${String(Number(row[0])).padStart(4, '0')}.HK` : m === 'cn' ? `${row[0]}.${row[1] === 'SHANGHAI' ? 'SS' : 'SZ'}` : null);
const SUFFIX = { jp: ' (일본)', hk: ' (홍콩)', cn: ' (중국)', vn: ' (베트남)' };

// ── (선택) 보유·관심에 담은 종목도 차트 대상에 넣기 ──
// 내 비공개 보관함(data.json)에서 종목 "이름"만 읽어, 대표 목록에 없는 종목을 이번 실행의 대상에 더한다.
// 저장소 설정에 변수 DATA_REPO(아이디/저장소)와 비밀값 DATA_TOKEN 을 넣었을 때만 동작한다. 없으면 건너뛴다.
async function heldNames() {
  let j = null;
  if (process.env.DATA_FILE) j = await readJSON(process.env.DATA_FILE);
  else if (process.env.DATA_REPO && process.env.DATA_TOKEN) {
    try {
      const r = await fetch(`https://api.github.com/repos/${process.env.DATA_REPO}/contents/data.json`, { headers: { Authorization: `Bearer ${process.env.DATA_TOKEN}`, Accept: 'application/vnd.github.raw+json' }, signal: AbortSignal.timeout(12000) });
      if (r.ok) j = await r.json(); else console.log(`보관함을 읽지 못함(${r.status}) — 대표 종목만 받는다`);
    } catch { console.log('보관함을 읽지 못함 — 대표 종목만 받는다'); }
  }
  const s = j?.state || j;
  if (!s) return [];
  return [...new Set([...(s.holdings || []).map((h) => h.name), ...(s.watch || []).map((w) => w.name), ...(s.wanted || []).map((w) => w.name)].filter(Boolean))];
}
let extras = 0;
for (const n of await heldNames()) {
  if (tickers[n] || extras >= 80) continue;
  const k = all.kr[n];
  const sym = n.endsWith('.US') ? n.slice(0, -3) : n;
  if (k) tickers[n] = { code: k[0], mkt: k[1], extra: true };
  else if (all.us[sym]) tickers[n] = { symbol: sym.replace(/[ .]/g, '-'), extra: true };
  else {
    // 일본·홍콩·중국: 앱에서 이름이 겹칠 때 붙인 " (일본)" 같은 꼬리를 떼고 찾는다
    const hit = ['jp', 'hk', 'cn'].map((m) => [m, all[m][n] || (n.endsWith(SUFFIX[m]) ? all[m][n.slice(0, -SUFFIX[m].length)] : null)]).find(([, row]) => row);
    if (!hit) continue;
    tickers[n] = { mk: hit[0], ysym: yahooOf(hit[0], hit[1]), key: yahooOf(hit[0], hit[1]), row: hit[1], extra: true };
  }
  names.push(n);
  extras++;
}

// ── 야후 일봉: 종가, 날짜, 현재가, 전일 대비, 최근 1년 배당 ──
async function yahoo(symbol, range = '2y') {
  const j = await getJSON(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d&events=div`);
  const res = j?.chart?.result?.[0];
  if (!res) return null;
  const raw = res.indicators?.quote?.[0]?.close || [];
  const days = [], closes = [];
  (res.timestamp || []).forEach((t, i) => { if (raw[i] != null) { days.push(Math.floor((t + (res.meta.gmtoffset || 0)) / 86400)); closes.push(raw[i]); } });
  const price = res.meta.regularMarketPrice ?? closes.at(-1);
  if (price == null) return null;
  const mp = res.meta.regularMarketChangePercent;
  const prev = typeof mp === 'number' ? price / (1 + mp / 100) : (closes.length >= 2 ? closes.at(-2) : res.meta.chartPreviousClose);
  const yearAgo = Date.now() / 1000 - 365 * 86400;
  const div = Object.values(res.events?.dividends || {}).filter((d) => d.date >= yearAgo).reduce((a, d) => a + d.amount, 0);
  return { price, chg: prev ? (price / prev - 1) * 100 : 0, days, closes, div, cur: res.meta.currency, at: new Date((res.meta.regularMarketTime || 0) * 1000).toISOString() };
}

// 이동평균·52주 고저 등 일봉에서 뽑는 값
function stats(closes, price) {
  const c = closes.slice();
  if (!c.length) return {};
  c[c.length - 1] = price; // 오늘 봉은 현재가로
  const o = {};
  if (c.length >= 60) o.ma60 = mean(c.slice(-60));
  if (c.length >= 200) o.ma200 = mean(c.slice(-200));
  if (c.length >= 220) o.ma200slope = o.ma200 / mean(c.slice(-220, -20)) - 1; // 200일선의 20거래일 기울기
  const y = c.slice(-250);
  o.hi52 = Math.max(...y); o.lo52 = Math.min(...y);
  return o;
}
function historyFile(days, closes, cur) {
  const r = (v) => (cur === 'KRW' ? Math.round(v) : Math.round(v * 100) / 100);
  const ma = closes.map((_, i) => (i >= 199 ? r(mean(closes.slice(i - 199, i + 1))) : null));
  return { cur, t: days.slice(-KEEP), c: closes.slice(-KEEP).map(r), m: ma.slice(-KEEP) };
}

// ── 대표 종목 ──
const items = {};
let histOk = 0;
const STAT_KEYS = ['ma60', 'ma200', 'ma200slope', 'hi52', 'lo52', 'div'];
for (const n of names) {
  const t = tickers[n];
  const mk = t.mk || (t.code ? 'kr' : 'us');
  const ysym = t.ysym || (t.code ? `${t.code}.${t.mkt || 'KS'}` : t.symbol);
  const old = prevData?.items?.[n];
  const open = mk === 'kr' ? doKR : mk === 'us' ? doUS : doAsia;
  if (!full && !open && old) { items[n] = old; continue; } // 장이 닫힌 쪽은 직전 값 그대로
  const sw = t.row || (mk === 'kr' ? all.kr[n] : all.us[t.symbol.replace('-', '.')] || all.us[t.symbol.replace('-', ' ')] || all.us[t.symbol]);
  const y = full ? await yahoo(ysym) : (sw ? null : await yahoo(ysym, '5d'));
  const live = sw ? { price: sw[2], chg: sw[3] } : (y && { price: y.price, chg: y.chg });
  if (!live) { if (old) items[n] = { ...old, stale: true }; continue; }
  const it = { key: t.key || keyOf(n), price: live.price, chg: live.chg, cur: CUR[mk], src: sw ? 'naver' : 'yahoo', sector: t.sector || null };
  if (t.extra) it.extra = true;
  // 새로 담긴 종목은 평소 실행 때도 일봉을 한 번 받아 둔다
  const firstTime = t.extra && !old;
  const yy = firstTime && !full ? await yahoo(ysym) : y;
  if (yy && (full || firstTime)) {
    Object.assign(it, stats(yy.closes, live.price), { div: yy.div || 0 });
    await writeFile(join(outDir, 'h', `${it.key}.json`), JSON.stringify(historyFile(yy.days, yy.closes, it.cur)));
    histOk++;
  } else if (y && full) {
    Object.assign(it, stats(y.closes, live.price), { div: y.div || 0 });
    await writeFile(join(outDir, 'h', `${it.key}.json`), JSON.stringify(historyFile(y.days, y.closes, it.cur)));
    histOk++;
  } else if (old) {
    for (const k of STAT_KEYS) if (old[k] != null) it[k] = old[k];
  }
  items[n] = it;
}

// ── 시장 지표: 60거래일 종가 고점 대비 + 작은 추이선 ──
const indices = {};
const MARKET = [['KOSPI', '^KS11', '코스피', 2], ['SP500', '^GSPC', 'S&P 500', 2], ['NASDAQ', '^IXIC', '나스닥', 2], ['USDKRW', 'KRW=X', '달러/원', 1], ['GOLD', 'GC=F', '금($/oz)', 1]];
for (const [key, symbol, label, dp] of MARKET) {
  const y = await yahoo(symbol, '6mo');
  if (!y || !y.closes.length) { if (prevData?.indices?.[key]) indices[key] = { ...prevData.indices[key], stale: true }; continue; }
  const last60 = y.closes.slice(-60);
  const high60 = Math.max(...last60, y.price);
  const p = 10 ** dp;
  indices[key] = { label, last: y.price, high60, dd: y.price / high60 - 1, chg: y.chg, at: y.at, spark: last60.map((v) => Math.round(v * p) / p), t: y.days.slice(-60) };
}
let usdkrw = indices.USDKRW?.last;
if (!usdkrw) usdkrw = (await getJSON('https://open.er-api.com/v6/latest/USD'))?.rates?.KRW || prevData?.fx?.USDKRW || null;

// 환율(원화 환산용): 엔 · 홍콩달러 · 위안 · 동
const fx = { USDKRW: usdkrw };
for (const [k, s] of [['JPYKRW', 'JPYKRW=X'], ['HKDKRW', 'HKDKRW=X'], ['CNYKRW', 'CNYKRW=X'], ['VNDKRW', 'VNDKRW=X']]) {
  fx[k] = (await yahoo(s, '5d'))?.price || null;
}
if (Object.values(fx).some((v) => !v)) {
  // 야후에 없는 통화는 달러 기준 환율표로 계산한다(1 통화 = 원/달러 ÷ 그 통화/달러)
  const er = (await getJSON('https://open.er-api.com/v6/latest/USD'))?.rates;
  for (const k of Object.keys(fx)) if (!fx[k]) fx[k] = (er?.KRW && er[k.slice(0, 3)] ? er.KRW / er[k.slice(0, 3)] : null) || prevData?.fx?.[k] || null;
}

const now = new Date().toISOString();
await writeFile(join(outDir, 'prices.json'), JSON.stringify({ updatedAt: now, fx, items, indices }, null, 1));
for (const m of MKT) if (swept[m]) await writeFile(join(outDir, `all-${m}.json`), JSON.stringify({ updatedAt: now, cur: CUR[m], items: all[m] }));

const missing = names.filter((n) => !items[n]);
if (extras) console.log(`보유·관심에서 더한 종목 ${extras}개`);
console.log(`${full ? '전체' : `현재가만(${[doKR && '한국', doUS && '미국', doAsia && '아시아'].filter(Boolean).join('·')})`} · 대표 ${Object.keys(items).length}/${names.length}개 · 일봉 ${histOk}개 · 전체 목록 ${MKT.map((m) => `${m} ${Object.keys(all[m]).length}`).join(' · ')} · 환율 ${usdkrw}`);
if (missing.length) console.log('못 받은 대표 종목:', missing.join(', '));
if (Object.keys(items).length === 0) process.exit(1);
