// 화면: 머리(총자산·탭)와 탭 여덟 개. 여기서는 HTML 글자만 만들고, 눌렀을 때 하는 일은 app.js 가 맡는다.
import { S, D, DEMO, PX, CATS, ASSET_CATS, quote, fxUSD, fxOf, sectorOf, today } from './store.js';
import { summary, positions, byName, bySector, dividends, monthlyNet, acctCash } from './model.js';
import { SY, syncOn } from './sync.js';
import { esc, won, man, num, qty, p1, md, px, chg, delta, money, CUR_SYM } from './ui.js';
import { stackBar, legend, sparkline, monthBars } from './charts.js';

export const TABS = [
  ['home', '🏠', '홈'], ['hold', '💼', '보유'], ['log', '📝', '기록'], ['plans', '🌱', '모으기'], ['watch', '⭐', '관심'],
  ['map', '🗺', '업종지도'], ['notes', '🔍', '리서치'], ['tools', '🧪', '분석·도구'], ['set', '⚙️', '가족·설정'],
];
const CAT_CLS = { stock: 's1', brokerCash: 's2', deposit: 's3', saving: 's4', realEstate: 's5', bond: 's6', crypto: 's7', metal: 's8', other: 's0' };
const MEM_CLS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8'];
export const memCls = (id) => MEM_CLS[Math.max(0, S.members.findIndex((m) => m.id === id)) % MEM_CLS.length];
const SECTOR_EMOJI = {
  반도체: '💾', '2차전지': '🔋', 자동차: '🚗', 조선: '🚢', 방산: '🛡', 전력설비: '⚡', 원전: '⚛️', 은행: '🏦', 보험: '☂️', 증권: '📊', 바이오: '🧬',
  인터넷: '🌐', 게임: '🎮', 엔터: '🎤', 통신: '📡', 음식료: '🍱', 화장품: '💄', 유통: '🛒', 화학: '🧪', 철강: '🔩', 건설: '🏗', 지주사: '🏢', 운송: '✈️',
  로봇: '🤖', 유틸리티: '💡', '국내 지수': '📈', '미국 지수': '🗽', '주식·채권 혼합': '⚖️', 단기채: '💵', '미국 빅테크': '💻', '미국 반도체': '🧠',
  '미국 산업재': '🏭', '미국 금융': '💳', '미국 소비재': '🛍', 기타: '📁',
};
const semo = (s) => SECTOR_EMOJI[s] || '📁';
const mem = (id) => S.members.find((m) => m.id === id) || { name: '?', emoji: '❔' };

const card = (title, body, extra = '', cls = '') => `<section class="card ${cls}"><header><h2>${title}</h2>${extra}</header>${body}</section>`;
const seg = (act, cur, opts) => `<div class="seg" role="tablist">${opts.map(([v, l]) => `<button role="tab" aria-selected="${cur === v}" data-act="${act}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
const chips = (act, cur, opts) => `<div class="chips">${opts.map(([v, l]) => `<button class="chip-btn" aria-pressed="${cur === v}" data-act="${act}" data-v="${esc(v)}">${l}</button>`).join('')}</div>`;
const memberChips = (act, cur) => (S.members.length > 1 ? chips(act, cur, [['', '👨‍👩‍👧 전체'], ...S.members.map((m) => [m.id, `${m.emoji} ${esc(m.name)}`])]) : '');
const stat = (label, value, sub = '') => `<div><span>${label}</span><b>${value}</b>${sub ? `<em>${sub}</em>` : ''}</div>`;
const prog = (ratio, cls = 's1') => `<div class="prog-track" role="img" aria-label="${p1(ratio)}"><i class="${cls}" style="width:${Math.max(0, Math.min(1, ratio)) * 100}%"></i></div>`;
const empty = (msg) => `<p class="empty">${msg}</p>`;

// ───────────────────────── 모으기(정기 매수)
const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const planWhen = (every) => { const [k, v] = String(every || 'daily').split(':'); return k === 'weekly' ? `매주 ${WD[+v] || ''}요일` : k === 'monthly' ? `매월 ${v}일` : '매일'; };
// 한 달에 몇 번 사는가(어림): 매일 = 거래일 약 21일, 매주 = 약 4.35번
const planPerMonth = (every) => { const k = String(every || 'daily').split(':')[0]; return k === 'weekly' ? 52 / 12 : k === 'monthly' ? 1 : 21; };
export function plans(ui) {
  const allPlans = S.plans || [];
  const list = allPlans.filter((p) => !ui.member || p.memberId === ui.member);
  const monthly = (p) => { if (p.on === false) return 0; const q = quote(p.name); return q ? q.krw * p.qty * planPerMonth(p.every) : 0; };
  const top = `${memberChips('plan-member', ui.member)}
    <section class="card sumcard">
      <div class="row between"><span class="small muted">한 달에 모으는 금액 <span>(지금 시세로 어림)</span></span><span class="small muted">진행 중 ${list.filter((p) => p.on !== false).length}건</span></div>
      <p class="big">${won(list.reduce((s, p) => s + monthly(p), 0))}</p>
      <p class="small muted">매일은 한 달 21거래일, 매주는 4.35번으로 계산해요. 실제 체결가와는 다를 수 있어요.</p>
    </section>`;
  if (!allPlans.length) return `${top}${card('🌱 모으기', empty('아직 적어 둔 모으기가 없어요. 증권사에서 자동으로 사고 있는 일정을 여기에 적어 두세요.'), '<button class="btn sm primary" data-act="add-plan">＋ 모으기 추가</button>')}`;
  const body = S.members.filter((m) => !ui.member || m.id === ui.member).map((m) => {
    const mine = list.filter((p) => p.memberId === m.id);
    if (!mine.length) return card(`${m.emoji} ${esc(m.name)}`, empty('적어 둔 모으기가 없어요.'), `<button class="btn sm" data-act="add-plan" data-v="${m.id}">＋ 추가</button>`);
    const accts = [...new Set(mine.map((p) => p.accountId))];
    const rows = accts.map((aid) => {
      const a = S.accounts.find((x) => x.id === aid);
      const ps = mine.filter((p) => p.accountId === aid);
      return `<h3 class="subhead">${esc(a?.name || '(지워진 계좌)')} <small class="muted">월 약 ${won(ps.reduce((s, p) => s + monthly(p), 0))}</small></h3>
        <ul class="list">${ps.map((p) => { const q = quote(p.name); return `<li><button class="lrow" data-act="edit-plan" data-v="${p.id}"><span class="tag ${p.on === false ? 'out' : 'in'}">${p.on === false ? '멈춤' : planWhen(p.every)}</span><span>${esc(p.name)}<small>${p.qty}주씩${p.auto ? ' · 앱에 자동 반영' : ''}${p.memo ? ` · ${esc(p.memo)}` : ''}</small></span><b>${q && p.on !== false ? `월 ${won(monthly(p))}` : '—'}</b></button></li>`; }).join('')}</ul>`;
    }).join('');
    return card(`${m.emoji} ${esc(m.name)}`, rows, `<span class="small muted">월 약 ${won(mine.reduce((s, p) => s + monthly(p), 0))}</span> <button class="btn sm" data-act="add-plan" data-v="${m.id}">＋ 추가</button>`);
  }).join('');
  return `${top}${body}<p class="small muted">「앱에 자동 반영」은 증권사와 자동 연동이 안 되는 계좌(삼성증권 등)용이에요. 켜 두면 평일 저녁에 일정대로 수량을 늘리고 그만큼 예수금을 줄여요. 실제 주문을 내는 것은 아니에요. 메리츠·토스처럼 잔고가 자동으로 들어오는 계좌는 꺼 두세요.</p>`;
}

// ───────────────────────── 머리: 이름, 총자산, 도구
export function head() {
  const all = summary();
  const first = S.history[0];
  const since = first && first.id !== today() ? `<span class="since">${first.date} → 오늘 ${delta(all.total - first.total, first.total ? (all.total - first.total) / first.total : null)}</span>` : '';
  const goal = S.meta.goal || 0;
  const pxd = PX.data;
  const hr = new Date().getHours();
  const hello = hr < 5 ? '고요한 밤이에요' : hr < 11 ? '맑은 아침이에요' : hr < 17 ? '오후의 평온' : hr < 21 ? '저녁이에요' : '하루 마무리';
  const syncLabel = { off: '동기화 꺼짐', busy: '동기화 중…', ok: '동기화됨', error: '동기화 오류', offline: '오프라인' }[syncOn() ? SY.state === 'off' ? 'busy' : SY.state : 'off'];
  return `${DEMO.on ? '<div class="demobar">🎬 데모 모드 — 가상의 가족 자료를 보여 드려요. 실제 자료는 그대로 있고, 여기서 고친 것은 저장되지 않아요. <button class="btn sm" data-act="toggle-demo">종료</button></div>' : ''}<div class="brandrow">
      <div class="logo" aria-hidden="true"><span class="bean"></span></div>
      <div><h1>재현애 투자하우스 <small>INVEST HOUSE</small></h1><p class="tagline">${hello} · 차곡차곡 쌓이는 우리 집 자산</p></div>
    </div>
    <div class="headrow">
      <div class="total">
        <p class="label">우리 가족 총 자산</p>
        <p class="big">${won(all.total)}</p>
        <p class="sub">오늘 ${delta(all.day, all.dayPct)}${since ? ` · ${since}` : ''}</p>
        ${goal ? `<p class="sub">목표 <b>${won(goal)}</b> · 달성률 <b class="accent">${p1(all.total / goal)}</b></p>` : ''}
      </div>
      <div class="tools">
        <button class="tool ${pxd && PX.from === 'net' ? 'live' : ''}" data-act="refresh-all" title="시세와 계좌 자료(동기화)를 함께 다시 받기"><i></i><b>↻ 새로고침</b> 시세 ${pxd ? new Date(pxd.updatedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '없음'}</button>
        <button class="tool sync ${syncOn() ? SY.state : 'off'}" data-act="go-sync" title="${esc(SY.msg || syncLabel)}"><i></i>${syncLabel}</button>
        <button class="tool" data-act="toggle-demo" title="가상의 자료로 둘러보기 (실제 자료에는 영향 없음)" aria-pressed="${DEMO.on}">🎬 데모${DEMO.on ? ' 종료' : ''}</button>
        <button class="tool ico" data-act="toggle-usd" title="달러로 보기 / 원화로 보기" aria-pressed="${!!D.usd}">${D.usd ? '$' : '₩'}</button>
        <button class="tool ico" data-act="toggle-hide" title="금액 가리기" aria-pressed="${D.hide}">${D.hide ? '🙈' : '👁️'}</button>
        <button class="tool ico" data-act="toggle-theme" title="밝게 · 어둡게 · 기기 설정대로">${{ auto: '🌗', light: '☀️', dark: '🌙' }[D.theme]}</button>
        <button class="tool ico" data-act="toggle-font" title="글자 크기">가${'+'.repeat(D.font)}</button>
      </div>
    </div>`;
}
export const tabsNav = (tab) => `<div class="tabs-in">${TABS.map(([k, e, l]) => `<a href="#${k}" aria-current="${tab === k ? 'page' : 'false'}"><span aria-hidden="true">${e}</span> ${l}</a>`).join('')}</div>`;

function hello() {
  return `<section class="card hello">
    <h2>아직 담긴 자산이 없어요</h2>
    <p>세 가지 방법이 있어요. 다른 기기에서 이미 쓰고 있다면 <b>동기화 연결</b>만 하면 그대로 따라옵니다.</p>
    <div class="row"><button class="btn primary" data-act="import-file">가져오기 파일 고르기</button><button class="btn" data-act="add-account">계좌 직접 추가</button><a class="btn" href="#set">동기화 연결</a></div>
  </section>`;
}

// ───────────────────────── 홈
const ring = (ratio) => {
  const r = 42, c = 2 * Math.PI * r, k = Math.max(0, Math.min(1, ratio));
  return `<svg class="ring" viewBox="0 0 100 100" role="img" aria-label="달성률 ${p1(ratio)}"><circle cx="50" cy="50" r="${r}" class="ring-bg"/><circle cx="50" cy="50" r="${r}" class="ring-fg" stroke-dasharray="${(c * k).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 50 50)"/><text x="50" y="56" text-anchor="middle">${Math.round(ratio * 100)}%</text></svg>`;
};
const avatar = (m) => `<span class="avatar ${memCls(m.id)}">${m.emoji}</span>`;

export const HOME_CARDS = [['links', '🔗 바로가기'], ['market', '🌏 시장'], ['goal', '🎯 목표 달성률'], ['liquid', '💧 총 유동성'], ['alloc', '🧺 자산 배분'], ['currency', '💱 통화별 투자 자산'], ['sector', '🏷 업종 비중'], ['trend', '📈 자산 추이'], ['div', '💰 배당'], ['net', '💸 투입 금액']];
export function homeOrder() {
  const known = HOME_CARDS.map((c) => c[0]);
  const order = (D.homeOrder || []).filter((id) => known.includes(id));
  return [...order, ...known.filter((id) => !order.includes(id))];
}

export function home(ui) {
  const all = summary();
  const stockTotal = all.byCat.stock || 1;
  const hidden = new Set(D.homeHidden || []);
  const built = {};
  // 카드 하나: 제목 · 설명 · 오른쪽 도구 · 내용.  half 는 넓은 화면에서 두 칸에 하나씩.
  const hc = (id, title, sub, body, extra = '', half = false) => {
    const edit = ui.editCards ? `<span class="edit"><button class="mini" data-act="card-up" data-v="${id}" aria-label="위로">↑</button><button class="mini" data-act="card-down" data-v="${id}" aria-label="아래로">↓</button><button class="mini" data-act="card-hide" data-v="${id}">🙈 숨기기</button></span>` : extra;
    built[id] = `<section class="card ${half ? 'half' : ''} ${ui.editCards ? 'editing' : ''}"><header><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${edit}</header>${ui.editCards ? '' : body}</section>`;
  };

  // 바로가기
  hc('links', '🔗 바로가기', '', S.links.length
    ? `<div class="links-row">${S.links.map((l) => (ui.editLinks
      ? `<button class="shortcut" data-act="edit-link" data-v="${l.id}"><span>${esc(l.emoji || '🔗')}</span>${esc(l.name)} ✎</button>`
      : `<a class="shortcut" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer"><span>${esc(l.emoji || '🔗')}</span>${esc(l.name)}</a>`)).join('')}<button class="shortcut add" data-act="add-link">＋ 추가</button></div>`
    : `<div class="links-row"><button class="shortcut add" data-act="add-link">＋ 바로가기 추가</button><button class="shortcut add" data-act="seed-links">예시 넣기 (네이버증권 · 토스증권 · FRED · Investing)</button></div>`,
    S.links.length ? `<button class="btn sm ghost" data-act="toggle-edit-links">${ui.editLinks ? '✓ 마치기' : '⚙️ 관리'}</button>` : '');

  const idx = PX.data?.indices || {};
  if (Object.keys(idx).length) {
    hc('market', '🌏 시장', '최근 60거래일 흐름', `<div class="mkt">${Object.entries(idx).map(([k, i]) => `<div data-tip="${esc(`<b>${esc(i.label)}</b><br>60일 고점 ${num(i.high60, 2)}<br>고점 대비 ${(i.dd * 100).toFixed(1)}%`)}">
      <span>${esc(i.label)}</span><b>${num(i.last, k === 'USDKRW' || k === 'GOLD' ? 1 : 2)}</b><em>${chg(i.chg)}</em>${sparkline(i.spark)}</div>`).join('')}</div>`);
  }
  if (!all.total) return hello() + (built.market || '') + built.links;

  // 목표
  const goal = S.meta.goal || 0;
  const withGoal = S.members.filter((m) => m.goal);
  hc('goal', '🎯 목표 달성률', '', goal || withGoal.length ? `<div class="goalwrap">
      ${goal ? `<div class="goal">${ring(all.total / goal)}<div><span class="small muted">가족 합산</span><b class="pct accent">${p1(all.total / goal)}</b><span class="small muted">${won(all.total)} / ${won(goal)}</span><span class="small">남은 금액 <b>${won(Math.max(0, goal - all.total))}</b></span></div></div>` : ''}
      <ul class="mgoals">${withGoal.map((m) => { const t = summary(m.id).total; return `<li>${avatar(m)}<span class="mg-name">${esc(m.name)}<small>남은 ${won(Math.max(0, m.goal - t))}</small></span>${prog(t / m.goal, memCls(m.id))}<b>${Math.round((t / m.goal) * 100)}%</b></li>`; }).join('')}</ul></div>`
    : empty('가족 목표 금액을 정하면 달성률이 보여요.'), '<button class="btn sm ghost" data-act="edit-goal">목표 설정</button>');

  // 유동성
  const lq = [{ label: '주식예수금', value: all.byCat.brokerCash, cls: 's3' }, { label: '예금·현금', value: all.byCat.deposit, cls: 's6' }, { label: '🔒 적금·청약', value: all.byCat.saving, cls: 's0' }];
  hc('liquid', '💧 총 유동성 <span class="muted">즉시 가용</span>', '',
    `<p class="hl good">${won(all.liquid)}</p>
     <p class="small">+ 🔒 묶인 자금(적금·청약) <b>${won(all.byCat.saving)}</b> · 현금성 전체 <b>${won(all.liquid + all.byCat.saving)}</b></p>
     ${stackBar(lq)}<ul class="keys">${lq.map((s) => `<li><i class="chip ${s.cls}"></i>${s.label} ${p1(s.value / ((all.liquid + all.byCat.saving) || 1))}</li>`).join('')}</ul>
     <div class="scroll"><table><thead><tr><th>구성원</th><th>주식예수금</th><th>예금·현금</th><th>소계</th><th>적금·청약</th></tr></thead><tbody>
     ${S.members.map((m) => { const s = summary(m.id); return `<tr><td>${m.emoji} ${esc(m.name)}</td><td>${s.byCat.brokerCash ? won(s.byCat.brokerCash) : '—'}</td><td>${s.byCat.deposit ? won(s.byCat.deposit) : '—'}</td><td class="good">${won(s.liquid)}</td><td>${s.byCat.saving ? won(s.byCat.saving) : '—'}</td></tr>`; }).join('')}
     <tr class="sum"><td>합계</td><td>${won(all.byCat.brokerCash)}</td><td>${won(all.byCat.deposit)}</td><td class="good">${won(all.liquid)}</td><td>${won(all.byCat.saving)}</td></tr></tbody></table></div>
     <p class="small muted">달러 예수금 ${D.hide ? '•••' : `$${num(all.accounts.reduce((a, x) => a + (x.cashUSD || 0), 0), 2)}`} 포함 · $1 = ₩${num(fxUSD(), 0)}</p>`,
    `<span class="muted small">가족 자산의 ${p1(all.liquid / all.total)}</span>`);

  // 자산 배분
  const segsOf = (s) => CATS.map((c) => ({ label: c.label, emoji: c.emoji, value: s.byCat[c.key] || 0, cls: CAT_CLS[c.key] }));
  const catSegs = segsOf(all);
  hc('alloc', '🧺 자산 배분', '가족 합계 · 종류별 · 구성원별 한눈에',
    `<div class="row between"><span class="small muted">가족 합계</span><b class="hl sm">${won(all.total)}</b></div>${stackBar(catSegs)}
     <div class="cats">${catSegs.filter((s) => s.value > 0).map((s) => `<div class="cat b-${s.cls}"><span>${s.label}<em>${p1(s.value / all.total)}</em></span><b>${won(s.value)}</b><div class="prog-track"><i class="${s.cls}" style="width:${(s.value / all.total) * 100}%"></i></div></div>`).join('')}</div>
     <h3 class="rule">👥 구성원별 분포</h3>
     ${S.members.map((m) => { const s = summary(m.id); const sg = segsOf(s).filter((x) => x.value > 0); return `<div class="panel">
        <div class="row between"><span class="row">${avatar(m)}<b class="pname">${esc(m.name)}</b><span class="small muted">전체의 ${p1(s.total / all.total)} · 📈 ${s.names}종목 · 🏦 ${s.accounts.length}계좌</span></span><span class="ptotal"><b>${won(s.total)}</b>${s.plPct != null ? `<small>${delta(s.pl, s.plPct)}</small>` : ''}</span></div>
        ${stackBar(sg)}<ul class="keys">${sg.map((x) => `<li><i class="chip ${x.cls}"></i>${x.label} <b>${p1(x.value / (s.total || 1))}</b></li>`).join('')}</ul></div>`; }).join('')}`);

  // 통화
  const CUR_NAME = { KRW: '원화', USD: '달러', JPY: '엔', HKD: '홍콩달러', CNY: '위안', VND: '동' };
  const CUR_CLS = { KRW: 's1', USD: '3', JPY: '2', HKD: '4', CNY: '5', VND: '7' };
  const curs = Object.entries(all.byCur).filter(([, v]) => v > 0).sort((a, b) => (a[0] === 'KRW' ? -1 : b[0] === 'KRW' ? 1 : b[1] - a[1]));
  const curTotal = curs.reduce((a, [, v]) => a + v, 0) || 1;
  const curSegs = curs.map(([c, v]) => ({ label: CUR_NAME[c] || c, value: v, cls: `s${String(CUR_CLS[c] || '0').replace('s', '')}` }));
  hc('currency', '💱 통화별 투자 자산', '주식 + 예수금 + 예금·현금',
    `${stackBar(curSegs)}<div class="tiles flat two">${curs.map(([c, v]) => `<div><span>${CUR_SYM[c] || ''} ${CUR_NAME[c] || c} (${c}) <em class="accent">${p1(v / curTotal)}</em></span>
      <b>${c === 'KRW' ? won(v) : (D.hide ? `${CUR_SYM[c]}•••` : money(v / (fxOf(c) || 1), c))}</b>${c === 'KRW' ? '' : `<em>≈ ${won(v)} · ${CUR_SYM[c]}1 = ₩${num(fxOf(c), c === 'USD' ? 0 : 2)}</em>`}</div>`).join('')}</div>`);

  // 업종 비중
  const secs = bySector(all.pos);
  hc('sector', '🏷 업종 비중', '보유 주식을 업종별로 · 주식 안에서의 비중',
    secs.length ? secs.slice(0, 8).map((s, i) => `<div class="panel theme b-s${(i % 8) + 1}">
      <div class="row between"><span class="row"><b class="pname">${semo(s.sector)} ${esc(s.sector)}</b><span class="badge">${s.names.length}종목</span></span><span class="ptotal"><b>${won(s.value)}</b>${s.hasPl ? `<small>${delta(s.pl)}</small>` : ''}</span></div>
      <div class="row"><div class="prog-track grow"><i class="s${(i % 8) + 1}" style="width:${(s.value / stockTotal) * 100}%"></i></div><b class="tpct">${p1(s.value / stockTotal)}</b></div>
      <div class="chips sm">${s.names.slice(0, 6).map((n) => `<button class="badge" data-act="open-stock" data-v="${esc(n)}">${esc(n)}</button>`).join('')}${s.names.length > 6 ? `<span class="badge">외 ${s.names.length - 6}</span>` : ''}</div></div>`).join('')
      + (secs.length > 8 ? `<p class="small muted">외 ${secs.length - 8}개 업종</p>` : '') : empty('보유 종목이 없어요.'),
    '<a class="btn sm ghost" href="#map">업종지도 →</a>');

  // 자산 추이
  const hist = S.history, hs = hist.map((h) => h.total);
  hc('trend', '📈 자산 추이', `매일 자동 기록 (${hist.length}일 치)`,
    '<div id="trend" class="chart"></div>'
    + (hist.length ? `<div class="tiles flat">${stat('최고', won(Math.max(...hs)), md(hist[hs.indexOf(Math.max(...hs))].date))}${stat('최저', won(Math.min(...hs)), md(hist[hs.indexOf(Math.min(...hs))].date))}${stat('현재', won(all.total), hist.length > 1 ? delta(all.total - hs[0], hs[0] ? (all.total - hs[0]) / hs[0] : null) : '')}</div>` : ''),
    `<span class="row">${seg('trend-mode', ui.trend, [['family', '가족'], ['stock', '주식만'], ...(S.members.length > 1 ? [['member', '구성원별']] : [])])}<button class="btn sm ghost" data-act="snap-now">📸 지금 기록</button></span>`);

  // 배당
  const dv = dividends(all.pos);
  hc('div', '💰 배당', '연간 · 세전 어림', dv.total ? `<div class="tiles flat two"><div class="warm"><span>예상 연배당</span><b>${won(dv.total)}</b><em>주식 대비 ${p1(dv.total / stockTotal)}</em></div><div><span>월 평균</span><b>${won(dv.total / 12)}</b></div></div>
      <ul class="list">${dv.rows.slice(0, 5).map((r) => `<li><span>${esc(r.name)}<small>배당률 ${p1(r.yield)}</small></span><b>${won(r.amount)}</b></li>`).join('')}</ul>
      <p class="small muted">지난 1년 지급된 주당 배당·분배금 × 지금 수량. 실제와 다를 수 있어요.</p>` : empty('배당 자료가 있는 보유 종목이 없어요.'), '', true);

  // 투입 금액
  const net = monthlyNet(null, 12);
  const mKey = today().slice(0, 7), yKey = today().slice(0, 4);
  const cur = net.find((g) => g.month === mKey);
  const yNet = monthlyNet(null, 240).filter((g) => g.month.startsWith(yKey)).reduce((a, g) => a + g.net, 0);
  hc('net', '💸 투입 금액', '매매일지 기준 · 매수 − 매도 = 순투입',
    net.length ? `<div class="tiles flat">${stat(`이번 달 순투입 (${+mKey.slice(5)}월)`, won(cur?.net || 0))}${stat('이번 달 매수', cur ? won(cur.buy) : '—')}${stat('이번 달 매도', cur ? won(cur.sell) : '—')}${stat(`${yKey}년 순투입`, won(yNet))}</div>`
      + monthBars(net.map((g) => ({ label: g.month.slice(2).replace('-', '.'), value: g.net, tip: `<b>${g.month}</b><br>매수 ${won(g.buy)}<br>매도 ${won(g.sell)}<br>순투입 ${won(g.net)}` })))
      : empty('매매 기록이 쌓이면 달마다 얼마를 넣고 뺐는지 여기 모여요.'),
    '<a class="btn sm ghost" href="#log">자세히 보기 →</a>', true);

  const order = homeOrder().filter((id) => built[id]);
  const shown = order.filter((id) => !hidden.has(id));
  const hiddenList = order.filter((id) => hidden.has(id));
  const names = Object.fromEntries(HOME_CARDS);
  const bar = `<div class="row end cardbar">
      ${hiddenList.length ? `<span class="small muted">🙈 숨긴 카드 ${hiddenList.length}개</span>` : ''}
      ${ui.editCards ? hiddenList.map((id) => `<button class="btn sm ghost" data-act="card-show" data-v="${id}">${names[id]} 보이기</button>`).join('') : ''}
      <button class="btn sm ${ui.editCards ? 'primary' : 'ghost'}" data-act="toggle-edit-cards">${ui.editCards ? '✓ 편집 마치기' : '✏️ 카드 순서 편집'}</button></div>`;
  return `${bar}<div class="grid">${shown.map((id) => built[id]).join('')}</div>`;
}

// ───────────────────────── 보유
function posRow(g, total, act, id) {
  const sub = `${qty(g.qty)}주${g.q ? ` × ${px(g.q)}` : ''}`;
  return `<li><button class="hrow" data-act="${act}" data-v="${esc(id)}">
    <span class="h-name">${esc(g.name)} <span class="badge">${semo(g.sector)} ${esc(g.sector)}</span></span>
    <span class="h-val">${won(g.value)}</span>
    <span class="h-sub">${sub} · ${p1(g.value / (total || 1))}</span>
    <span class="h-chg">${g.pl != null ? delta(g.pl, g.plPct) : ''} ${g.q ? chg(g.q.chg) : '<span class="muted">시세 없음</span>'}</span>
  </button></li>`;
}

export function hold(ui) {
  const s = summary(ui.member || undefined);
  if (!S.accounts.length) return hello();
  const sorters = { value: (a, b) => b.value - a.value, pl: (a, b) => (b.plPct ?? -9) - (a.plPct ?? -9), day: (a, b) => (b.q?.chg ?? -99) - (a.q?.chg ?? -99), name: (a, b) => a.name.localeCompare(b.name, 'ko') };
  const noCost = s.pos.filter((p) => p.pl == null).length;
  const top = `${memberChips('hold-member', ui.member)}
    <section class="card sumcard">
      <div class="row between"><span class="small muted">총 평가금액 <span>(주식)</span></span><span class="small muted">${s.names}개 종목 · ${s.accounts.length}계좌</span></div>
      <p class="hl big">${won(s.byCat.stock)}</p>
      <p class="small">${s.plPct != null ? `평가손익 ${delta(s.pl, s.plPct)} · ` : ''}오늘 ${delta(s.day, s.dayPct)} · 예수금 <b>${won(s.byCat.brokerCash)}</b></p>
      ${noCost ? `<p class="small muted">매입금액이 없는 종목 ${noCost}줄은 수익률에서 빠져 있어요. <button class="link" data-act="bulk-cost">매입금액 한꺼번에 넣기</button></p>` : ''}
    </section>
    <div class="row between">${seg('hold-mode', ui.holdMode, [['name', '종목별'], ['acct', '계좌별']])}
      <label class="sel">정렬<select data-act="hold-sort">${[['value', '평가액순'], ['pl', '수익률순'], ['day', '오늘 등락순'], ['name', '이름순']].map(([v, l]) => `<option value="${v}" ${ui.sort === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>`;
  let body;
  if (ui.holdMode === 'name') {
    const list = byName(s.pos).sort(sorters[ui.sort]);
    body = card('종목별 합계', list.length ? `<ul class="hlist">${list.map((g) => posRow(g, s.byCat.stock, 'open-stock', g.name)).join('')}</ul>` : empty('보유 종목이 없어요.'), `<span class="hd-val">${won(s.byCat.stock)}</span>`);
  } else {
    body = s.accounts.map((a) => {
      const rows = s.pos.filter((p) => p.accountId === a.id).sort(sorters[ui.sort]);
      const st = rows.reduce((x, p) => x + p.value, 0);
      return card(`${mem(a.memberId).emoji} ${esc(a.name)}`,
        `<ul class="hlist">${rows.map((p) => posRow(p, st + acctCash(a), 'edit-holding', p.id)).join('')}
          <li><button class="hrow" data-act="edit-account" data-v="${a.id}"><span class="h-name">예수금 <span class="badge">🏦 현금</span></span><span class="h-val">${won(acctCash(a))}</span>
            <span class="h-sub">원화 ${won(a.cashKRW || 0)}${a.cashUSD ? ` · 달러 ${D.hide ? '•••' : `$${num(a.cashUSD, 2)}`}` : ''}</span><span class="h-chg muted">계좌 고치기</span></button></li></ul>
         <div class="row"><button class="btn sm" data-act="add-holding" data-v="${a.id}">＋ 종목</button></div>`,
        `<span class="hd-val">${won(st + acctCash(a))}<em>${esc(mem(a.memberId).name)}</em></span>`);
    }).join('');
  }
  return `${top}<div class="grid cols">${body}</div>
    <div class="row"><button class="btn" data-act="add-holding">＋ 종목 추가</button><button class="btn" data-act="add-account">＋ 계좌 추가</button><button class="btn" data-act="bulk-cost">매입금액 한꺼번에 넣기</button><button class="btn" data-act="paste-csv">잔고 CSV 가져오기</button></div>`;
}

// ───────────────────────── 기록
export const FLOW_CATS = ['급여', '투자 이체', '배당·이자', '생활비', '세금·수수료', '기타'];
export function log(ui) {
  const acct = new Map(S.accounts.map((a) => [a.id, a]));
  const inMember = (memberId) => !ui.member || memberId === ui.member;
  const top = `${seg('log-mode', ui.logMode, [['trade', '📒 매매일지'], ['flow', '💵 현금흐름']])}${memberChips('log-member', ui.member)}`;
  if (ui.logMode === 'trade') {
    const list = S.trades.filter((t) => inMember(acct.get(t.accountId)?.memberId) && (!ui.logSide || t.side === ui.logSide)).sort((a, b) => b.date.localeCompare(a.date) || b.u - a.u);
    const buy = list.filter((t) => t.side === 'buy').reduce((a, t) => a + t.qty * t.price, 0);
    const sell = list.filter((t) => t.side === 'sell').reduce((a, t) => a + t.qty * t.price, 0);
    return `${top}<div class="tiles">${stat('매수 합계', won(buy))}${stat('매도 합계', won(sell))}${stat('순투입', won(buy - sell))}${stat('기록', `${list.length}건`)}</div>
      <div class="row between">${chips('log-side', ui.logSide, [['', '전체'], ['buy', '매수'], ['sell', '매도']])}<span class="row"><button class="btn sm" data-act="export-trades">CSV 저장</button><button class="btn primary sm" data-act="add-trade">＋ 매매 기록</button></span></div>
      ${card('매매일지', list.length ? `<ul class="list log">${list.map((t) => `<li><button class="lrow" data-act="edit-trade" data-v="${t.id}">
        <span class="tag ${t.side}">${t.side === 'buy' ? '매수' : '매도'}</span>
        <span>${esc(t.name)}<small>${t.date} · ${mem(acct.get(t.accountId)?.memberId).emoji} ${esc(acct.get(t.accountId)?.name || '지운 계좌')}${t.memo ? ` · ${esc(t.memo)}` : ''}</small></span>
        <b>${won(t.qty * t.price)}<small>${qty(t.qty)}주 × ₩${num(t.price)}</small></b></button></li>`).join('')}</ul>` : empty('아직 매매 기록이 없어요.'))}`;
  }
  const list = S.flows.filter((f) => inMember(f.memberId)).sort((a, b) => b.date.localeCompare(a.date) || b.u - a.u);
  const inn = list.filter((f) => f.type === 'in').reduce((a, f) => a + f.amount, 0);
  const out = list.filter((f) => f.type === 'out').reduce((a, f) => a + f.amount, 0);
  const cats = {};
  for (const f of list.filter((x) => x.type === 'out')) cats[f.cat || '기타'] = (cats[f.cat || '기타'] || 0) + f.amount;
  return `${top}<div class="tiles">${stat('입금 합계', won(inn))}${stat('출금 합계', won(out))}${stat('순 변동', delta(inn - out))}${stat('기록', `${list.length}건`)}</div>
    <div class="row between"><span></span><button class="btn primary sm" data-act="add-flow">＋ 입출금 기록</button></div>
    ${Object.keys(cats).length ? card('📊 출금 종류별 합계', `<ul class="list">${Object.entries(cats).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<li><span>${esc(k)}</span><b>${won(v)}<small>${p1(v / out)}</small></b></li>`).join('')}</ul>`) : ''}
    ${card('현금흐름', list.length ? `<ul class="list log">${list.map((f) => `<li><button class="lrow" data-act="edit-flow" data-v="${f.id}">
      <span class="tag ${f.type}">${f.type === 'in' ? '입금' : '출금'}</span>
      <span>${esc(f.cat || '기타')}<small>${f.date} · ${mem(f.memberId).emoji} ${esc(mem(f.memberId).name)}${f.memo ? ` · ${esc(f.memo)}` : ''}</small></span>
      <b>${won(f.amount)}</b></button></li>`).join('')}</ul>` : empty('아직 입출금 기록이 없어요.'))}`;
}

// ───────────────────────── 관심
const pos52 = (q) => (q && q.hi52 > q.lo52 ? (q.raw - q.lo52) / (q.hi52 - q.lo52) : null);
export function watch(ui) {
  const groups = [...new Set(S.watch.map((w) => w.group || '미분류'))];
  const list = S.watch.filter((w) => !ui.watchGroup || (w.group || '미분류') === ui.watchGroup);
  const held = new Set(S.holdings.map((h) => h.name));
  const top = `<div class="row between">${chips('watch-group', ui.watchGroup, [['', `전체 ${S.watch.length}`], ...groups.map((g) => [g, `${esc(g)} ${S.watch.filter((w) => (w.group || '미분류') === g).length}`])])}
    <button class="btn primary sm" data-act="add-watch">＋ 종목 추가</button></div>
    <div class="row between">${seg('watch-view', ui.watchView, [['detail', '📋 상세'], ['compact', '≡ 컴팩트'], ['tile', '▦ 타일'], ['chart', '📈 차트']])}
    ${ui.watchView === 'chart' ? seg('watch-range', String(ui.watchRange), [['60', '3개월'], ['120', '6개월'], ['200', '10개월']]) : ''}</div>`;
  if (!list.length) return top + card('관심 종목', empty('관심 종목을 추가하면 가격·등락·200일선 위치를 한눈에 볼 수 있어요.'));
  let body;
  if (ui.watchView === 'chart') {
    body = `<div class="grid cols">${list.map((w) => { const q = quote(w.name); return `<section class="card"><header><h2><button class="link strong" data-act="open-stock" data-v="${esc(w.name)}">${esc(w.name)}</button></h2><span class="hd-val">${px(q)}<em>${q ? chg(q.chg) : ''}</em></span></header>
      <div class="chart mini" data-chart="${esc(q?.key || '')}"></div></section>`; }).join('')}</div>`;
  } else if (ui.watchView === 'tile') {
    const heat = (v) => { const k = Math.min(1, Math.abs(v) / 5); return `background:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${Math.round(8 + k * 38)}%, var(--surface))`; };
    body = `<div class="secmap">${list.map((w) => { const q = quote(w.name); return `<button class="sec" style="${q ? heat(q.chg) : ''}" data-act="open-stock" data-v="${esc(w.name)}"><span class="sec-name">${esc(w.name)}</span><b>${q ? chg(q.chg) : '—'}</b><small>${px(q)}${held.has(w.name) ? ' · 보유' : ''}</small></button>`; }).join('')}</div>`;
  } else if (ui.watchView === 'compact') {
    body = card('관심 종목', `<ul class="list">${list.map((w) => { const q = quote(w.name); return `<li><button class="lrow" data-act="open-stock" data-v="${esc(w.name)}"><span>${esc(w.name)}${held.has(w.name) ? ' <span class="badge">보유</span>' : ''}</span><b>${px(q)} ${q ? chg(q.chg) : ''}</b></button></li>`; }).join('')}</ul>`);
  } else {
    body = card('관심 종목', `<ul class="list">${list.map((w) => {
      const q = quote(w.name), r = pos52(q);
      return `<li><button class="lrow" data-act="open-stock" data-v="${esc(w.name)}">
        <span>${esc(w.name)} <span class="badge">${semo(sectorOf(w.name))} ${esc(sectorOf(w.name))}</span>${held.has(w.name) ? ' <span class="badge">보유</span>' : ''}
          <small>${esc(w.group || '미분류')}${w.memo ? ` · ${esc(w.memo)}` : ''}${q?.ma200 ? ` · 200일선 대비 ${((q.raw / q.ma200 - 1) * 100).toFixed(1)}%` : ''}${r != null ? ` · 52주 범위의 ${Math.round(r * 100)}% 지점` : ''}${q?.div ? ` · 배당률 ${p1(q.div / q.raw)}` : ''}</small></span>
        <b>${px(q)}<small>${q ? chg(q.chg) : '시세 없음'}</small></b></button></li>`;
    }).join('')}</ul>`);
  }
  return top + body;
}

// ───────────────────────── 업종지도
export function map(ui) {
  const items = PX.data?.items || {};
  if (!Object.keys(items).length) return card('업종지도', empty('시세를 받지 못해서 지도를 그릴 수 없어요.'));
  const all = summary();
  const mine = new Map(byName(all.pos).map((g) => [g.name, g]));
  const watched = new Set(S.watch.map((w) => w.name));
  const secs = new Map();
  for (const [name, it] of Object.entries(items)) {
    const s = secs.get(it.sector || '기타') || { sector: it.sector || '기타', names: [], chg: 0, mine: 0 };
    s.names.push(name); s.chg += it.chg || 0; s.mine += mine.get(name)?.value || 0;
    secs.set(s.sector, s);
  }
  const list = [...secs.values()].map((s) => ({ ...s, avg: s.chg / s.names.length }));
  list.sort(ui.mapSort === 'mine' ? (a, b) => b.mine - a.mine || b.avg - a.avg : (a, b) => b.avg - a.avg);
  const heat = (v) => { const k = Math.min(1, Math.abs(v) / 5); return `background:color-mix(in srgb, var(${v >= 0 ? '--up' : '--down'}) ${Math.round(8 + k * 38)}%, var(--surface))`; };
  const stockTotal = all.byCat.stock || 1;
  const tiles = list.map((s) => `<button class="sec ${ui.sector === s.sector ? 'on' : ''}" style="${heat(s.avg)}" data-act="pick-sector" data-v="${esc(s.sector)}">
    <span class="sec-name">${semo(s.sector)} ${esc(s.sector)}</span><b>${chg(s.avg)}</b>
    <small>${s.names.length}종목${s.mine ? ` · 내 비중 ${p1(s.mine / stockTotal)}` : ''}</small></button>`).join('');
  let detail = '';
  const cur = secs.get(ui.sector);
  if (cur) {
    detail = card(`${semo(cur.sector)} ${esc(cur.sector)}`, `<ul class="list">${cur.names.sort((a, b) => (items[b].chg || 0) - (items[a].chg || 0)).map((n) => {
      const q = quote(n), g = mine.get(n);
      return `<li><button class="lrow" data-act="open-stock" data-v="${esc(n)}"><span>${esc(n)}${g ? ' <span class="badge">보유</span>' : ''}${watched.has(n) ? ' <span class="badge">⭐</span>' : ''}
        <small>${g ? `${won(g.value)} · ` : ''}${q?.ma200 ? `200일선 대비 ${((q.raw / q.ma200 - 1) * 100).toFixed(1)}%` : ''}</small></span><b>${px(q)}<small>${q ? chg(q.chg) : ''}</small></b></button></li>`;
    }).join('')}</ul>`, `<span class="muted small">평균 ${cur.names.length ? (list.find((x) => x.sector === cur.sector).avg).toFixed(2) : 0}%</span>`);
  }
  return `<div class="row between"><p class="small muted">칸 색은 오늘 평균 등락(빨강 상승 · 파랑 하락). 칸을 누르면 종목이 나와요.</p>${seg('map-sort', ui.mapSort, [['chg', '등락순'], ['mine', '내 비중순']])}</div>
    <div class="secmap">${tiles}</div>${detail}
    <p class="small muted center">${list.length}개 업종 · ${Object.keys(items).length}종목 · 업종 묶음과 대표 종목은 직접 정한 목록(data/tickers.json)이에요.</p>`;
}

// ───────────────────────── 리서치
export const NOTE_KINDS = [['stock', '🔬 종목'], ['market', '🌍 시장'], ['review', '📝 매매 복기'], ['idea', '💡 아이디어']];
export function notes(ui) {
  const q = ui.noteQ.trim().toLowerCase();
  const list = S.notes.filter((n) => (!ui.noteKind || n.kind === ui.noteKind) && (!q || `${n.title} ${n.name} ${n.body}`.toLowerCase().includes(q))).sort((a, b) => b.date.localeCompare(a.date) || b.u - a.u);
  const kind = Object.fromEntries(NOTE_KINDS);
  const docsCard = card('📄 문서 <span class="muted">선별노트처럼 통째로 보관하는 파일</span>',
    S.docs.length ? `<ul class="list">${[...S.docs].sort((a, b) => b.date.localeCompare(a.date)).map((d) => `<li><button class="lrow" data-act="open-doc" data-v="${d.id}"><span>${esc(d.title)}<small>${d.date} · ${esc(d.file || '')} · ${Math.round((d.size || 0) / 1024)}KB</small></span><b class="accent">열기</b></button></li>`).join('')}</ul>
      <p class="small muted">같은 제목의 파일을 다시 올리면 새 것으로 바뀌어요.</p>`
      : empty('HTML·텍스트 파일을 올리면 여기서 바로 열어 볼 수 있어요. 동기화를 켜 두면 다른 기기에서도 보입니다.'),
    '<button class="btn sm ghost" data-act="add-doc">＋ 문서 올리기</button>');
  return `<div class="row between">${chips('note-kind', ui.noteKind, [['', `전체 ${S.notes.length}`], ...NOTE_KINDS])}<button class="btn primary sm" data-act="add-note">＋ 노트 쓰기</button></div>
    ${docsCard}
    <input class="search" type="search" placeholder="노트 검색 (제목 · 종목 · 내용)" value="${esc(ui.noteQ)}" data-act="note-q">
    ${list.length ? `<div class="grid cols">${list.map((n) => `<button class="card note" data-act="edit-note" data-v="${n.id}">
      <header><h2>${esc(n.title || '제목 없음')}</h2><span class="muted small">${n.date}</span></header>
      <p class="small"><span class="badge">${kind[n.kind] || '노트'}</span>${n.name ? ` <span class="badge">${esc(n.name)}</span>` : ''}${n.url ? ' <span class="badge">🔗 링크</span>' : ''}</p>
      <p class="body">${esc((n.body || '').slice(0, 220))}${(n.body || '').length > 220 ? '…' : ''}</p></button>`).join('')}</div>` : card('리서치 노트', empty('종목을 왜 샀는지, 무엇을 보고 판단했는지 남겨 두는 곳이에요. 종목 상세에서도 바로 쓸 수 있어요.'))}`;
}

// (분석·도구 탭은 tools.js 에 있다)

// ───────────────────────── 가족·설정
export function set() {
  const all = summary();
  const syncCard = card('☁️ 기기 간 동기화',
    syncOn()
      ? `<p><b>${{ ok: '켜짐 — 동기화됨', busy: '동기화 중…', error: '오류', offline: '오프라인 — 연결되면 이어서 맞춰요', off: '연결 중…' }[SY.state]}</b>${SY.at ? ` <span class="muted small">마지막 ${SY.at.toLocaleTimeString('ko-KR')}</span>` : ''}</p>
         ${SY.msg ? `<p class="note warn">${esc(SY.msg)}</p>` : ''}
         <p class="small muted">저장소 <code>${esc(D.repo)}</code> 와 맞추는 중. 같은 저장소·토큰을 넣은 기기끼리(예: 내 휴대폰, 아내 휴대폰, PC) 같은 내용을 봅니다. 고치면 몇 초 뒤 올라가고, 다른 기기는 화면을 다시 볼 때와 1분마다 받아 와요.</p>
         <div class="row"><button class="btn" data-act="sync-now">지금 맞추기</button><button class="btn danger" data-act="sync-off">이 기기 연결 끊기</button></div>`
      : `<p class="small">내 깃허브의 <b>비공개 저장소</b> 하나를 보관함으로 씁니다. 저장소 이름과 토큰을 넣은 기기끼리 자동으로 같은 내용을 봐요.</p>
         <form class="form" data-form="sync">
           <label class="wide">저장소 (아이디/이름)<input name="repo" placeholder="내아이디/tuja-data" autocomplete="off" autocapitalize="off" spellcheck="false" required value="${esc(D.repo)}"></label>
           <label class="wide">토큰<input name="token" type="password" placeholder="github_pat_…" autocomplete="off" required></label>
           <button class="btn primary wide">연결</button></form>
         <details><summary>처음 준비하는 법 (한 번만)</summary><ol class="small">
           <li>깃허브에서 새 저장소를 <b>Private</b>으로 만든다. 이름 예: <code>tuja-data</code> (README 추가에 체크).</li>
           <li>깃허브 Settings → Developer settings → Fine-grained tokens → Generate new token.</li>
           <li>Repository access 는 <b>Only select repositories</b> → 방금 만든 저장소만. Permissions → Contents 를 <b>Read and write</b>.</li>
           <li>만들어진 토큰을 복사해 위 칸에 붙여 넣는다. 아내 기기에도 같은 저장소 이름과 토큰을 넣는다.</li>
           </ol><p class="small muted">토큰은 이 기기 안에만 저장되고, 그 저장소 한 곳만 읽고 쓸 수 있어요. 만료일이 지나면 새로 만들어 다시 넣어야 합니다.</p></details>`);

  const memberCards = S.members.map((m) => {
    const s = summary(m.id);
    const accts = s.accounts.map((a) => { const st = s.pos.filter((p) => p.accountId === a.id).reduce((x, p) => x + p.value, 0); return `<li><button class="lrow" data-act="edit-account" data-v="${a.id}"><span>${esc(a.name)}<small>주식 ${won(st)} · 예수금 ${won(acctCash(a))}</small></span><b>${won(st + acctCash(a))}</b></button></li>`; }).join('');
    const cats = ASSET_CATS.map((c) => {
      const items = s.assets.filter((a) => a.cat === c.key);
      return `<div class="catrow"><div class="cat-head"><span>${c.emoji} ${c.label}${items.length ? ` <span class="muted">${items.length}</span>` : ''}</span>${items.length ? `<b>${won(s.byCat[c.key])}</b>` : ''}<button class="link" data-act="add-asset" data-v="${m.id}|${c.key}">+ 추가</button></div>
        ${items.length ? `<ul class="list">${items.map((a) => `<li><button class="lrow" data-act="edit-asset" data-v="${a.id}"><span>${esc(a.name)}${a.memo ? `<small>${esc(a.memo)}</small>` : ''}</span><b>${won(a.value)}</b></button></li>`).join('')}</ul>` : ''}</div>`;
    }).join('');
    return card(`${m.emoji} ${esc(m.name)}`,
      `<p class="hl">${won(s.total)} <span class="muted small">전체의 ${p1(all.total ? s.total / all.total : 0)}${m.goal ? ` · 목표 ${p1(s.total / m.goal)}` : ''}</span></p>
       <div class="catrow"><div class="cat-head"><span>🏛 증권 계좌 <span class="muted">${s.accounts.length}</span></span><b>${won(s.byCat.stock + s.byCat.brokerCash)}</b><button class="link" data-act="add-account" data-v="${m.id}">+ 추가</button></div>${accts ? `<ul class="list">${accts}</ul>` : ''}</div>${cats}`,
      `<button class="link" data-act="edit-member" data-v="${m.id}">편집</button>`);
  }).join('');

  const dataCard = card('🗂 데이터', `<div class="row"><button class="btn" data-act="backup">전체 백업 ↓</button><button class="btn" data-act="import-file">가져오기 / 복원 ↑</button><button class="btn" data-act="paste-csv">잔고 CSV 가져오기</button><button class="btn danger" data-act="reset">초기화</button></div>
    <p class="small muted">${syncOn() ? '내용은 이 기기와 내 비공개 저장소에 있어요.' : '지금은 이 기기 브라우저에만 저장돼 있어요. 동기화를 연결하면 다른 기기와 맞춰집니다.'} 앱 코드가 올라가는 공개 저장소에는 내 자산 내용이 들어가지 않아요.</p>
    <p class="small muted">${PX.data ? `시세 ${new Date(PX.data.updatedAt).toLocaleString('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })} 기준${PX.from === 'cache' ? ' (저장해 둔 값)' : ''} · $1 = ₩${num(fxUSD(), 1)}` : '시세를 받지 못했어요.'}</p>`);

  return `<div class="row between"><h2 class="page">가족 구성원 관리</h2><span class="row"><button class="btn sm" data-act="edit-goal">🎯 가족 목표</button><button class="btn primary sm" data-act="add-member">＋ 구성원 추가</button></span></div>
    <div class="grid cols">${memberCards}${syncCard}${dataCard}</div>`;
}
