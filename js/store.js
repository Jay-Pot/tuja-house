// 데이터 보관 — 이 기기의 브라우저(localStorage)에 저장하고, 동기화를 켜면 sync.js 가 내 비공개 저장소와 맞춘다.
const KEY = 'tuja-house-v2';
const DEV_KEY = 'tuja-house-device';
const PX_KEY = 'tuja-house-prices';

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 자산 종류. 앞의 둘(주식·주식예수금)은 증권 계좌에서 나오고, 나머지는 구성원이 직접 적는 자산.
export const CATS = [
  { key: 'stock', label: '주식', emoji: '📈' },
  { key: 'brokerCash', label: '주식예수금', emoji: '🏦' },
  { key: 'deposit', label: '예금·현금', emoji: '💵' },
  { key: 'saving', label: '적금·청약', emoji: '🔒' },
  { key: 'realEstate', label: '부동산', emoji: '🏠' },
  { key: 'bond', label: '채권', emoji: '📜' },
  { key: 'crypto', label: '암호화폐', emoji: '💎' },
  { key: 'metal', label: '금/은', emoji: '🪙' },
  { key: 'other', label: '기타', emoji: '📦' },
];
export const ASSET_CATS = CATS.slice(2);
export const LIQUID = new Set(['brokerCash', 'deposit']);

// 기기끼리 맞추는 묶음들. 모든 항목은 id 와 u(마지막으로 고친 시각)를 가진다.
export const COLLS = ['members', 'accounts', 'holdings', 'assets', 'trades', 'flows', 'watch', 'notes', 'links', 'payouts', 'wanted', 'docs', 'history'];

function blank() {
  return {
    v: 2,
    members: [{ id: 'm1', name: '나', emoji: '🧑', goal: 0, u: 0 }],
    accounts: [], holdings: [], assets: [], trades: [], flows: [], watch: [], notes: [], links: [], payouts: [], wanted: [], docs: [], history: [],
    meta: { goal: 0, targets: {}, u: 0 },
    deleted: {},
  };
}

function normalize(s) {
  const b = blank();
  const o = { ...b, ...s };
  for (const c of COLLS) if (!Array.isArray(o[c])) o[c] = b[c];
  o.meta = { ...b.meta, ...(s.meta || {}) };
  o.deleted = { ...(s.deleted || {}) };
  if (!o.members.length) o.members = b.members;
  return o;
}

function load() {
  try {
    localStorage.removeItem('tuja-house-v1'); // 규칙 기반이던 첫 버전의 저장분
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch { /* 깨진 저장분은 버린다 */ }
  return blank();
}

export let S = load();

// 이 기기에만 두는 설정(동기화하지 않는다): 화면 설정과 동기화 연결 정보
export const D = (() => {
  const d = { repo: '', token: '', theme: 'auto', hide: false, font: 0, usd: false };
  try { Object.assign(d, JSON.parse(localStorage.getItem(DEV_KEY) || '{}')); } catch { /* 기본값 */ }
  return d;
})();
export function saveDevice() { localStorage.setItem(DEV_KEY, JSON.stringify(D)); }

// 문서 본문은 용량이 커서 자료와 따로, 이 기기에는 문서마다 한 칸씩 저장한다
const DOC_KEY = 'tuja-house-doc-';
export const docGet = (id) => { try { return localStorage.getItem(DOC_KEY + id); } catch { return null; } };
export const docSet = (id, text) => { try { localStorage.setItem(DOC_KEY + id, text); return true; } catch { return false; } };
export const docDel = (id) => { try { localStorage.removeItem(DOC_KEY + id); } catch { /* 없음 */ } };
export const docId = (title) => { let h = 5381; for (const c of title) h = ((h * 33) ^ c.codePointAt(0)) >>> 0; return `d${h.toString(36)}`; };

const listeners = [];
export function onChange(fn) { listeners.push(fn); }
export function save(silent) {
  if (DEMO.on) return; // 데모 중에는 아무것도 저장하지 않는다
  localStorage.setItem(KEY, JSON.stringify(S));
  if (!silent) listeners.forEach((fn) => fn());
}

export function replaceState(next) { if (DEMO.on) return; S = normalize(next); save(true); }

// ── 데모 모드: 가상의 가족 자료를 보여 준다. 실제 자료는 건드리지 않고, 저장·동기화도 멈춘다. ──
export const DEMO = { on: false };
export function enterDemo() {
  const now = Date.now(), day = 86400000;
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  const mk = (rows) => rows.map((r, i) => ({ ...r, id: r.id || `d${i}-${Math.random().toString(36).slice(2, 7)}`, u: now }));
  const members = [{ id: 'dm1', name: '아빠', emoji: '🧑', goal: 1.5e9 }, { id: 'dm2', name: '엄마', emoji: '👩', goal: 8e8 }, { id: 'dm3', name: '딸', emoji: '👧', goal: 1e8 }];
  const accounts = [
    { id: 'da1', memberId: 'dm1', name: '종합', cashKRW: 4200000, cashUSD: 1500 }, { id: 'da2', memberId: 'dm1', name: '연금저축', cashKRW: 800000, cashUSD: 0 },
    { id: 'da3', memberId: 'dm2', name: 'ISA', cashKRW: 2600000, cashUSD: 0 }, { id: 'da4', memberId: 'dm3', name: '주니어', cashKRW: 300000, cashUSD: 0 },
  ];
  const H = [['da1', '삼성전자', 120, 21e6], ['da1', 'SK하이닉스', 8, 7.2e6], ['da1', 'NVDA', 40, 6.1e6], ['da1', 'KO', 60, 6.9e6], ['da1', 'NAVER', 15, 3.4e6],
    ['da2', 'KODEX 200', 300, 21e6], ['da2', 'KODEX 미국S&P500', 500, 9.8e6], ['da3', '신한지주', 200, 9.4e6], ['da3', 'KODEX 미국나스닥100', 260, 5.9e6], ['da3', '현대차', 20, 5.2e6],
    ['da4', 'KODEX 200', 30, 2.0e6], ['da4', 'AAPL', 5, 1.9e6]];
  const demo = normalize({
    v: 2, members: mk(members), accounts: mk(accounts),
    holdings: mk(H.map(([accountId, name, qty, cost]) => ({ accountId, name, qty, cost, value: cost }))),
    assets: mk([{ memberId: 'dm1', cat: 'realEstate', name: '아파트', value: 9.5e8 }, { memberId: 'dm1', cat: 'deposit', name: '비상금 통장', value: 5e7 }, { memberId: 'dm2', cat: 'deposit', name: '파킹통장', value: 4e7 }, { memberId: 'dm2', cat: 'saving', name: '청약', value: 1.2e7 }, { memberId: 'dm1', cat: 'bond', name: '국채', value: 3e7 }, { memberId: 'dm3', cat: 'saving', name: '적금', value: 8.5e6 }, { memberId: 'dm1', cat: 'metal', name: '금 현물', value: 1.4e7 }]),
    trades: mk([[40, 'da1', '삼성전자', 'buy', 20, 185000], [33, 'da3', '신한지주', 'buy', 50, 46000], [21, 'da1', 'NVDA', 'buy', 5, 230000], [12, 'da2', 'KODEX 200', 'buy', 30, 76000], [5, 'da1', 'KO', 'sell', 10, 128000]].map(([d, accountId, name, side, qty, price]) => ({ date: iso(now - d * day), accountId, name, side, qty, price, memo: '데모' }))),
    flows: mk([[30, 'dm1', 'in', '급여', 6e6], [28, 'dm1', 'out', '투자 이체', 2e6], [15, 'dm2', 'in', '급여', 4e6], [3, 'dm1', 'in', '배당·이자', 180000]].map(([d, memberId, type, cat, amount]) => ({ date: iso(now - d * day), memberId, type, cat, amount, memo: '' }))),
    watch: mk([{ name: '한화에어로스페이스', group: '방산' }, { name: 'HD현대일렉트릭', group: '전력설비' }, { name: 'TSLA', group: '미국' }, { name: '알테오젠', group: '바이오' }]),
    notes: mk([{ date: iso(now - 6 * day), kind: 'stock', title: '반도체 업황 메모', name: '삼성전자', url: '', body: '재고 조정이 끝나 가는지 다음 분기 실적에서 확인.\n데모용 노트입니다.' }, { date: iso(now - 2 * day), kind: 'market', title: '금리 인하 기대', name: '', url: '', body: '채권 비중을 늘릴지 검토. 데모용 노트입니다.' }]),
    links: mk([{ name: '네이버증권', url: 'https://m.stock.naver.com', emoji: '📈' }, { name: 'FRED', url: 'https://fred.stlouisfed.org', emoji: '📊' }]),
    payouts: mk([{ date: iso(now - 20 * day), memberId: 'dm1', name: 'KO', amount: 42000, status: 'paid', memo: '' }, { date: iso(now + 12 * day), memberId: 'dm2', name: '신한지주', amount: 110000, status: 'due', memo: '' }]),
    history: Array.from({ length: 30 }, (_, i) => { const t = 1.21e9 * (1 + 0.0012 * i + 0.012 * Math.sin(i / 3)); const d = iso(now - (30 - i) * day); return { id: d, date: d, total: Math.round(t), stock: Math.round(t * 0.085), byMember: { dm1: Math.round(t * 0.9), dm2: Math.round(t * 0.085), dm3: Math.round(t * 0.015) }, u: now }; }),
    meta: { goal: 3e9, targets: { stock: 20, brokerCash: 3, deposit: 10, saving: 2, realEstate: 55, bond: 5, crypto: 2, metal: 3 }, u: now },
  });
  DEMO.on = true;
  S = demo;
}
export function exitDemo() { DEMO.on = false; S = load(); }

// ── 고치기 · 지우기 (동기화가 알아볼 수 있게 시각을 남긴다) ──
export function put(coll, obj) {
  if (!obj.id) obj.id = uid();
  obj.u = Date.now();
  const i = S[coll].findIndex((x) => x.id === obj.id);
  if (i >= 0) S[coll][i] = obj; else S[coll].push(obj);
  save();
  return obj;
}
function drop(coll, id) {
  S[coll] = S[coll].filter((x) => x.id !== id);
  S.deleted[id] = Date.now();
}
export function del(coll, id) {
  if (coll === 'members') {
    S.accounts.filter((a) => a.memberId === id).forEach((a) => del('accounts', a.id));
    S.assets.filter((a) => a.memberId === id).forEach((a) => drop('assets', a.id));
  }
  if (coll === 'accounts') S.holdings.filter((h) => h.accountId === id).forEach((h) => drop('holdings', h.id));
  drop(coll, id);
  save();
}
export function setMeta(patch) { S.meta = { ...S.meta, ...patch, u: Date.now() }; save(); }
export const setGoal = (v) => setMeta({ goal: v });

export function resetAll() {
  const now = Date.now();
  const deleted = { ...S.deleted };
  for (const c of COLLS) for (const x of S[c]) if (!(c === 'members' && x.id === 'm1')) deleted[x.id] = now;
  S = blank();
  S.members[0].u = now;
  S.deleted = deleted;
  S.meta.u = now;
  save();
}

// ── 두 기기의 내용 합치기: 항목마다 더 나중에 고친 쪽을 쓰고, 지운 것은 지운 채로 둔다 ──
export function merge(a, b) {
  const out = normalize({ v: 2 });
  out.members = [];
  const deleted = { ...(a.deleted || {}) };
  for (const [id, t] of Object.entries(b.deleted || {})) deleted[id] = Math.max(deleted[id] || 0, t);
  for (const c of COLLS) {
    const m = new Map();
    for (const x of [...(a[c] || []), ...(b[c] || [])]) {
      const cur = m.get(x.id);
      if (!cur || (x.u || 0) > (cur.u || 0)) m.set(x.id, x);
    }
    out[c] = [...m.values()].filter((x) => !(deleted[x.id] >= (x.u || 0)));
  }
  out.history.sort((x, y) => x.id.localeCompare(y.id));
  out.meta = (b.meta?.u || 0) > (a.meta?.u || 0) ? b.meta : (a.meta || out.meta);
  out.deleted = deleted;
  if (!out.members.length) out.members = blank().members;
  return out;
}

// 내용이 같은지 비교할 때 쓰는 정렬된 글자열
export function canon(s) {
  const o = { meta: s.meta, deleted: Object.fromEntries(Object.entries(s.deleted || {}).sort()) };
  for (const c of COLLS) o[c] = [...(s[c] || [])].sort((x, y) => String(x.id).localeCompare(String(y.id)));
  return JSON.stringify(o);
}

// ── 잔고 CSV: account,name,qty,value_krw[,cost_krw] ──
export function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) throw new Error('내용이 비어 있어요.');
  const head = lines[0].split(',').map((x) => x.trim().toLowerCase());
  const ix = { account: head.indexOf('account'), name: head.indexOf('name'), qty: head.indexOf('qty'), value: head.indexOf('value_krw'), cost: head.indexOf('cost_krw') };
  if (ix.account < 0 || ix.name < 0 || ix.value < 0) throw new Error('첫 줄이 account,name,qty,value_krw 여야 해요.');
  const rows = [];
  for (const line of lines.slice(1)) {
    const c = line.split(',').map((x) => x.trim());
    const value = Number(c[ix.value]);
    if (!c[ix.account] || !c[ix.name] || !Number.isFinite(value)) throw new Error(`읽을 수 없는 줄: ${line}`);
    const q = ix.qty >= 0 ? c[ix.qty] : '';
    const cost = ix.cost >= 0 && c[ix.cost] ? Number(c[ix.cost]) : null;
    rows.push({ account: c[ix.account], name: c[ix.name], qty: q === '' ? null : Number(q), value, cost: Number.isFinite(cost) ? cost : null });
  }
  return rows;
}

// 수량이 없는 줄(예수금·MMF 등)은 그 계좌의 예수금으로 합친다.
// 같은 구성원·같은 이름의 계좌는 통째로 새 잔고로 바꾼다. id 를 이름에서 만들어 두 기기에서 따로 불러와도 겹치지 않는다.
export function importRows(rows, memberId) {
  const now = Date.now();
  const byAcct = new Map();
  for (const r of rows) { if (!byAcct.has(r.account)) byAcct.set(r.account, []); byAcct.get(r.account).push(r); }
  for (const [name, list] of byAcct) {
    const id = `a-${memberId}-${name}`;
    const old = S.accounts.find((a) => a.id === id);
    const cash = list.filter((r) => r.qty == null).reduce((a, r) => a + r.value, 0);
    const acct = { id, memberId, name, cashKRW: cash, cashUSD: old?.cashUSD || 0, u: now };
    S.accounts = S.accounts.filter((a) => a.id !== id).concat(acct);
    const keep = new Set();
    for (const r of list.filter((x) => x.qty != null)) {
      const hid = `h-${id}-${r.name}`;
      const prev = S.holdings.find((h) => h.id === hid);
      keep.add(hid);
      const cost = r.cost ?? (prev && prev.qty === r.qty ? prev.cost : null);
      S.holdings = S.holdings.filter((h) => h.id !== hid).concat({ id: hid, accountId: id, name: r.name, qty: r.qty, value: r.value, cost, u: now });
      delete S.deleted[hid];
    }
    for (const h of S.holdings.filter((x) => x.accountId === id && !keep.has(x.id))) drop('holdings', h.id);
    delete S.deleted[id];
  }
  save();
  return byAcct.size;
}

// 가져오기: invest/make_app_data.py 가 만든 파일, 또는 이 앱의 백업 파일.
export function importData(obj, memberId) {
  if (obj && obj.kind === 'tuja-house-backup' && obj.state) {
    const now = Date.now();
    const next = normalize(obj.state);
    // 복원은 "지금 이 내용으로" 라는 뜻이므로 시각을 새로 찍어 다른 기기에도 그대로 퍼지게 한다
    for (const c of COLLS) for (const x of next[c]) { x.u = now; delete next.deleted[x.id]; }
    for (const c of COLLS) for (const x of S[c]) if (!next[c].some((y) => y.id === x.id)) next.deleted[x.id] = now;
    next.meta.u = now;
    S = next;
    save();
    return '백업을 그대로 되돌렸어요.';
  }
  if (obj && obj.kind === 'tuja-house-import' && Array.isArray(obj.members)) {
    // 가족 잔고: 구성원 이름으로 찾고, 없으면 만든다. 아직 아무것도 없는 기본 구성원 '나'는 첫 사람 이름으로 바꿔 쓴다.
    const now = Date.now();
    const ids = {};
    obj.members.forEach((mb, i) => {
      let m = S.members.find((x) => x.name === mb.name);
      if (!m && i === 0 && S.members.length === 1 && S.members[0].id === 'm1' && !S.accounts.length) m = Object.assign(S.members[0], { name: mb.name, u: now });
      if (!m) { m = { id: `m-${mb.name}`, name: mb.name, emoji: ['🧑', '🙂', '😊', '🐣'][i % 4], goal: 0, u: now }; S.members.push(m); delete S.deleted[m.id]; }
      ids[mb.name] = m.id;
      importRows(mb.holdings, m.id);
    });
    for (const h of obj.history || []) {
      if (S.history.some((x) => x.id === h.date)) continue;
      S.history.push({ id: h.date, date: h.date, total: h.total, stock: h.stock, byMember: Object.fromEntries(Object.entries(h.byOwner || {}).map(([k, v]) => [ids[k] || k, v])), u: 1 });
    }
    S.history.sort((a, b) => a.id.localeCompare(b.id));
    save();
    return `${obj.members.map((m) => m.name).join(' · ')}의 잔고를 가져왔어요 (${obj.asOf || ''} 기준).`;
  }
  if (obj && obj.kind === 'tuja-house-import' && Array.isArray(obj.holdings)) {
    const n = importRows(obj.holdings, memberId);
    for (const h of obj.history || []) if (!S.history.some((x) => x.id === h.date)) S.history.push({ id: h.date, date: h.date, total: h.total, stock: h.stock, byMember: { [memberId]: h.total }, u: 1 });
    S.history.sort((a, b) => a.id.localeCompare(b.id));
    save();
    return `계좌 ${n}개의 잔고를 가져왔어요 (${obj.asOf || ''} 기준).`;
  }
  throw new Error('투자하우스 가져오기 파일이나 백업 파일이 아니에요.');
}

export function exportBackup() {
  return JSON.stringify({ kind: 'tuja-house-backup', v: 2, at: new Date().toISOString(), state: S }, null, 1);
}

// ── 시세 ──
export const PX = { data: null, from: null, base: null };

export async function loadPrices() {
  const urls = [];
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  if (m) {
    const repo = location.pathname.split('/').filter(Boolean)[0];
    if (repo) urls.push(`https://raw.githubusercontent.com/${m[1]}/${repo}/data/prices.json`);
  }
  urls.push('data/prices.json');
  for (const u of urls) {
    try {
      const r = await fetch(`${u}?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
      if (!r.ok) continue;
      const d = await r.json();
      if (d && d.items) {
        PX.data = d; PX.from = 'net'; PX.base = u.replace(/prices\.json$/, '');
        try { localStorage.setItem(PX_KEY, JSON.stringify(d)); } catch { /* 용량 초과는 무시 */ }
        return true;
      }
    } catch { /* 다음 주소 */ }
  }
  try {
    const raw = localStorage.getItem(PX_KEY);
    if (raw) { PX.data = JSON.parse(raw); PX.from = 'cache'; return true; }
  } catch { /* 없음 */ }
  return false;
}

// 종목 일봉(200일 + 200일선). 상세나 차트를 열 때 그 종목 것만 받는다.
const histCache = new Map();
export async function loadHistory(key) {
  if (!key) return null;
  if (histCache.has(key)) return histCache.get(key);
  for (const base of [PX.base, 'data/'].filter(Boolean)) {
    try {
      const r = await fetch(`${base}h/${encodeURIComponent(key)}.json?t=${Math.floor(Date.now() / 3600000)}`);
      if (!r.ok) continue;
      const d = await r.json();
      histCache.set(key, d);
      return d;
    } catch { /* 다음 주소 */ }
  }
  return null;
}

export const fxUSD = () => PX.data?.fx?.USDKRW || 0;

// 상장 종목 전체(이름·코드·현재가·등락). 시장마다 파일이 따로 있고, 용량이 커서 필요할 때 받는다.
//   kr 국내 — 앱을 열면 받는다(대표 종목이 아닌 보유 종목의 시세에 필요)
//   us 미국 · jp 일본 · hk 홍콩 · cn 중국 · vn 베트남 — 종목을 찾기 시작하거나, 담아 둔 종목 중 못 찾은 것이 있을 때 받는다
export const MARKETS = ['kr', 'us', 'jp', 'hk', 'cn', 'vn'];
const MK = {
  kr: { label: '국내', cur: 'KRW' }, us: { label: '미국', cur: 'USD' }, jp: { label: '일본', cur: 'JPY' },
  hk: { label: '홍콩', cur: 'HKD' }, cn: { label: '중국', cur: 'CNY' }, vn: { label: '베트남', cur: 'VND' },
};
export const ALL = { data: {}, at: {}, ready: false, full: false };
let IDX = new Map();   // 앱에서 쓰는 종목 이름 → { m: 시장, row }
let SEARCH = [];       // 찾기용 [이름, 소문자 글자, 설명]

// 시장 순서대로 이름을 매긴다. 앞 시장에 같은 이름이 있으면 뒤에 꼬리를 붙인다(미국은 .US, 나머지는 " (일본)" 등).
function reindex() {
  const idx = new Map(), search = [];
  for (const m of MARKETS) {
    const items = ALL.data[m];
    if (!items) break; // 앞 시장이 아직 없으면 뒤 시장은 넣지 않는다(이름이 달라지지 않게)
    for (const [k, row] of Object.entries(items)) {
      const name = idx.has(k) ? (m === 'us' ? `${k}.US` : `${k} (${MK[m].label})`) : k;
      if (idx.has(name)) continue;
      idx.set(name, { m, row });
      search.push(m === 'us' ? [name, `${k} ${row[0]}`.toLowerCase(), `${row[0]} · ${row[1]}`] : [name, `${k} ${row[0]}`.toLowerCase(), `${row[0]} · ${m === 'kr' ? (row[1] === 'KQ' ? '코스닥' : '코스피') : MK[m].label}`]);
    }
  }
  IDX = idx; SEARCH = search;
  ALL.ready = !!ALL.data.kr;
  ALL.full = MARKETS.every((m) => ALL.data[m]);
}

// upTo 시장까지 차례로 받는다. 이미 받은 것은 maxAge(분)보다 오래됐을 때만 다시 받는다.
let loading = null;
export function loadMarkets(upTo = 'kr', maxAge = 15) {
  const run = async () => {
    let changed = false;
    for (const m of MARKETS.slice(0, MARKETS.indexOf(upTo) + 1)) {
      if (ALL.data[m] && Date.now() - ALL.at[m] < maxAge * 60000) continue;
      for (const base of [PX.base, 'data/'].filter(Boolean)) {
        try {
          const r = await fetch(`${base}all-${m}.json?t=${Math.floor(Date.now() / 60000)}`, { cache: 'no-store' });
          if (!r.ok) continue;
          ALL.data[m] = (await r.json()).items || {};
          ALL.at[m] = Date.now();
          changed = true;
          break;
        } catch { /* 다음 주소 */ }
      }
      if (!ALL.data[m]) break;
    }
    if (changed) reindex();
    return changed;
  };
  loading = (loading || Promise.resolve()).then(run, run);
  return loading;
}
// 담아 둔 종목 가운데 국내 목록만으로는 못 찾는 것이 있는지(있으면 해외 목록도 받아야 한다)
export const needsWorld = () => !ALL.full && [...S.holdings, ...S.watch].some((x) => !PX.data?.items?.[x.name] && !IDX.has(x.name));

const FX_KEY = { USD: 'USDKRW', JPY: 'JPYKRW', HKD: 'HKDKRW', CNY: 'CNYKRW', VND: 'VNDKRW' };
export const fxOf = (cur) => (cur === 'KRW' ? 1 : PX.data?.fx?.[FX_KEY[cur]] || 0);
const yahooKey = (m, row) => (m === 'jp' ? `${row[0]}.T` : m === 'hk' ? `${String(Number(row[0])).padStart(4, '0')}.HK` : m === 'cn' ? `${row[0]}.${row[1] === 'SHANGHAI' ? 'SS' : 'SZ'}` : row[0]);

// 원화 가격과 딸린 값들. 외화 종목은 환율을 곱한다. 대표 종목은 이동평균·배당까지, 나머지는 현재가·등락만 있다.
export function quote(name) {
  const it = PX.data?.items?.[name];
  if (it && it.price) {
    const fx = fxOf(it.cur);
    if (!fx) return null;
    return {
      krw: it.price * fx, raw: it.price, cur: it.cur, chg: it.chg || 0, stale: !!it.stale, fx, full: it.ma60 != null || it.hi52 != null,
      key: it.key, sector: it.sector || null, ma60: it.ma60, ma200: it.ma200, ma200slope: it.ma200slope,
      hi52: it.hi52, lo52: it.lo52, div: it.div || 0,
    };
  }
  const hit = IDX.get(name);
  if (!hit) return null;
  const { m, row } = hit, cur = MK[m].cur, fx = fxOf(cur);
  if (!fx) return null;
  return { krw: row[2] * fx, raw: row[2], cur, chg: row[3], fx, key: m === 'us' ? name.replace(/\.US$/, '') : yahooKey(m, row), code: m === 'us' ? name.replace(/\.US$/, '') : row[0], market: m, sector: null, div: 0, full: false, label: m === 'us' ? row[0] : null };
}
// 업종: 대표 종목은 목록의 분류, 그 밖의 종목은 보유 종목에 직접 적어 둔 업종, 없으면 '기타'
export const sectorOf = (name) => PX.data?.items?.[name]?.sector || S.holdings.find((h) => h.name === name && h.sector)?.sector || '기타';
export const tickerNames = () => Object.keys(PX.data?.items || {});
export const sectorNames = () => [...new Set([...Object.values(PX.data?.items || {}).map((i) => i.sector), ...S.holdings.map((h) => h.sector)].filter(Boolean))];
export const marketCount = () => IDX.size;

// 종목 찾기: 이름·코드·심볼로. 대표 종목을 먼저, 그다음 이름이 검색어로 시작하는 것, 그다음 포함하는 것.
export function searchTickers(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const out = [], seen = new Set();
  for (const [name, it] of Object.entries(PX.data?.items || {})) {
    const t = `${name} ${it.key}`.toLowerCase(), i = t.indexOf(q);
    if (i >= 0) { seen.add(name); out.push({ name, sub: `${it.sector || '담은 종목'} · ${{ KRW: '국내', USD: '미국', JPY: '일본', HKD: '홍콩', CNY: '중국' }[it.cur] || ''}`, rank: i === 0 ? 0 : 1 }); }
  }
  for (const [name, text, sub] of SEARCH) {
    if (seen.has(name)) continue;
    const i = text.indexOf(q);
    if (i < 0) continue;
    out.push({ name, sub, rank: i === 0 ? 2 : (text.includes(` ${q}`) ? 3 : 4) });
    if (out.length > 600) break;
  }
  return out.sort((a, b) => a.rank - b.rank || a.name.length - b.name.length).slice(0, limit);
}

// 대가 포트폴리오(공개 13F 자료). 저장소의 data/gurus.json 한 파일이고, 분기마다 새로 올린다. 내 자료와 섞이지 않는다.
export const GURUS = { data: null, failed: false };
export async function loadGurus() {
  try {
    const r = await fetch(`data/gurus.json?t=${Math.floor(Date.now() / 3600000)}`);
    if (!r.ok) throw new Error(r.status);
    GURUS.data = await r.json(); GURUS.failed = false;
    return true;
  } catch { GURUS.failed = true; return false; }
}
