// 앱 뼈대: 화면 바꾸기, 버튼·입력 처리, 대화상자.
import * as store from './store.js';
import { S as _S, D, put, del, quote, sectorOf, today, uid, ASSET_CATS, CATS } from './store.js';
import { summary, byName, snapshot, applyTrade, acctCash } from './model.js';
import * as views from './views.js';
import * as toolsMod from './tools.js';
import { startSync, syncNow, onSync, syncOn, SY, putDoc, getDoc } from './sync.js';
import { drawTrend, drawPrice } from './charts.js';
import { $, esc, won, num, p1, px, chg, delta, toast, openDialog, closeDialog, download, initTips, hideTip } from './ui.js';

const S = () => store.S;
const TAB_KEYS = views.TABS.map((t) => t[0]);
const ui = { member: '', holdMode: 'name', sort: 'value', logMode: 'trade', logSide: '', trend: 'family', watchGroup: '', watchView: 'detail', watchRange: 120, sector: '', mapSort: 'chg', noteKind: '', noteQ: '', tool: 'sim', toolState: {}, stockRange: 200, imgRange: 'area/year', editCards: false, editLinks: false };

const tab = () => { const h = location.hash.slice(1); return TAB_KEYS.includes(h) ? h : 'home'; };

function applyDevice() {
  const r = document.documentElement;
  if (D.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = D.theme;
  document.body.style.zoom = [1, 1.1, 1.2][D.font] || 1;
}

function render() {
  hideTip();
  const t = tab();
  $('#head').innerHTML = views.head();
  const bar = $('#tabs'), left = bar.firstElementChild?.scrollLeft || 0;
  bar.innerHTML = views.tabsNav(t);
  const nav = bar.firstElementChild;
  nav.scrollLeft = left;
  const cur = nav.querySelector('[aria-current="page"]');
  if (cur && (cur.offsetLeft - nav.offsetLeft < nav.scrollLeft || cur.offsetLeft - nav.offsetLeft + cur.offsetWidth > nav.scrollLeft + nav.clientWidth)) nav.scrollLeft = cur.offsetLeft - nav.offsetLeft - 40;
  $('#view').innerHTML = t === 'tools' ? toolsMod.view(ui) : views[t](ui);
  const pending = $('#view output[data-async]');
  if (pending) runTool(pending.closest('form'));
  if (t === 'home') drawHome();
  if (t === 'watch' && ui.watchView === 'chart') document.querySelectorAll('[data-chart]').forEach(async (el) => drawPrice(el, await store.loadHistory(el.dataset.chart), ui.watchRange));
}

function drawHome() {
  const h = S().history;
  let series;
  if (ui.trend === 'member' && S().members.length > 1) series = S().members.map((m) => ({ label: `${m.emoji} ${m.name}`, cls: views.memCls(m.id).replace('s', 'c'), pts: h.filter((x) => x.byMember?.[m.id] != null).map((x) => ({ date: x.date, v: x.byMember[m.id] })) })).filter((s) => s.pts.length);
  else series = [{ label: ui.trend === 'stock' ? '주식' : '가족', cls: 'c1', pts: h.map((x) => ({ date: x.date, v: ui.trend === 'stock' ? x.stock : x.total })) }];
  drawTrend($('#trend'), series);
}

// ───────────────────────── 대화상자
const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`;
const memberSel = (cur) => `<select name="memberId">${S().members.map((m) => opt(m.id, `${m.emoji} ${esc(m.name)}`, cur)).join('')}</select>`;
const acctSel = (cur) => `<select name="accountId" required>${S().accounts.map((a) => opt(a.id, `${S().members.find((m) => m.id === a.memberId)?.emoji || ''} ${esc(a.name)}`, cur)).join('')}</select>`;
const foot = (delAct, id) => `<div class="row wide">${delAct ? `<button type="button" class="btn danger" data-act="${delAct}" data-v="${id}">삭제</button>` : ''}<span class="grow"></span><button type="button" class="btn" data-act="close">취소</button><button class="btn primary">저장</button></div>`;
const tickerList = (id) => `<datalist id="${id}">${store.tickerNames().map((n) => `<option>${esc(n)}</option>`).join('')}</datalist>`;
const EMOJIS = ['🧑', '👩', '👨', '👧', '👦', '👶', '🐶', '🐱', '🥐', '🫘', '🏠', '💼'];

const dialogs = {
  member(m) {
    openDialog(`<form method="dialog" class="form" data-form="member"><h3>${m ? '구성원 고치기' : '구성원 추가'}</h3><input type="hidden" name="id" value="${m?.id || ''}">
      <label>이름<input name="name" required value="${esc(m?.name || '')}" placeholder="아내"></label>
      <label>아이콘<select name="emoji">${EMOJIS.map((e) => opt(e, e, m?.emoji || '👩')).join('')}</select></label>
      <label class="wide">개인 목표(원) <small>비워도 돼요</small><input name="goal" type="number" min="0" step="any" inputmode="numeric" value="${m?.goal || ''}"></label>
      ${foot(m && S().members.length > 1 ? 'del-member' : '', m?.id)}</form>`);
  },
  account(a, memberId) {
    openDialog(`<form method="dialog" class="form" data-form="account"><h3>${a ? '계좌 고치기' : '증권 계좌 추가'}</h3><input type="hidden" name="id" value="${a?.id || ''}">
      <label>구성원${memberSel(a?.memberId || memberId || ui.member)}</label>
      <label>계좌 이름<input name="name" required value="${esc(a?.name || '')}" placeholder="ISA"></label>
      <label>원화 예수금(원)<input name="cashKRW" type="number" min="0" step="any" inputmode="numeric" value="${a ? Math.round(a.cashKRW || 0) : ''}"></label>
      <label>달러 예수금($)<input name="cashUSD" type="number" min="0" step="any" inputmode="decimal" value="${a?.cashUSD || ''}"></label>
      <p class="small muted wide">계좌번호는 적지 마세요. 이름만 있으면 됩니다. MMF·현금성 자산도 예수금에 합쳐 적어요.</p>
      ${foot(a ? 'del-account' : '', a?.id)}</form>`);
  },
  holding(h, accountId, name) {
    if (!S().accounts.length) return dialogs.account(null);
    const q = h ? quote(h.name) : null;
    openDialog(`<form method="dialog" class="form" data-form="holding"><h3>${h ? '보유 종목 고치기' : '보유 종목 추가'}</h3><input type="hidden" name="id" value="${h?.id || ''}">
      <label class="wide">계좌${acctSel(h?.accountId || accountId)}</label>
      <label class="wide">종목<input name="name" data-ticker autocomplete="off" required value="${esc(h?.name || name || '')}" placeholder="종목 이름·코드로 찾기"></label>
      <label>수량<input name="qty" type="number" min="0" step="any" inputmode="decimal" required value="${h?.qty ?? ''}"></label>
      <label>매입금액(원) <small>수익률 계산용</small><input name="cost" type="number" min="0" step="any" inputmode="numeric" value="${h?.cost != null ? Math.round(h.cost) : ''}"><button type="button" class="link" data-act="fill-cost">지금 가격으로 채우기</button></label>
      <label>평가액(원) <small>시세가 없는 종목만</small><input name="value" type="number" min="0" step="any" inputmode="numeric" value="${h?.value ? Math.round(h.value) : ''}"></label>
      <label>업종 <small>비우면 자동</small><input name="sector" list="dl-sec" value="${esc(h?.sector || '')}" placeholder="${esc(h ? sectorOf(h.name) : '자동')}"></label>
      <datalist id="dl-sec">${store.sectorNames().map((s) => `<option>${esc(s)}</option>`).join('')}</datalist>
      <p class="small muted wide">${q ? `시세가 있어서 평가액은 수량 × 현재가(${px(q)})로 계산돼요.` : '이름을 치면 상장 종목에서 찾아 줘요. 고르면 시세가 자동으로 붙어요.'}</p>
      ${foot(h ? 'del-holding' : '', h?.id)}</form>`);
  },
  asset(a, memberId, cat) {
    openDialog(`<form method="dialog" class="form" data-form="asset"><h3>${a ? '자산 고치기' : '자산 추가'}</h3><input type="hidden" name="id" value="${a?.id || ''}">
      <label>구성원${memberSel(a?.memberId || memberId)}</label>
      <label>종류<select name="cat">${ASSET_CATS.map((c) => opt(c.key, `${c.emoji} ${c.label}`, a?.cat || cat)).join('')}</select></label>
      <label class="wide">이름<input name="name" required value="${esc(a?.name || '')}" placeholder="예: 비상금 통장"></label>
      <label class="wide">금액(원)<input name="value" type="number" min="0" step="any" inputmode="numeric" required value="${a ? Math.round(a.value) : ''}"></label>
      <label class="wide">메모<input name="memo" value="${esc(a?.memo || '')}"></label>
      ${foot(a ? 'del-asset' : '', a?.id)}</form>`);
  },
  payout(p, name) {
    openDialog(`<form method="dialog" class="form" data-form="payout"><h3>${p ? '배당 기록 고치기' : '배당 등록'}</h3><input type="hidden" name="id" value="${p?.id || ''}">
      <label>날짜<input type="date" name="date" required value="${p?.date || today()}"></label>
      <label>구성원${memberSel(p?.memberId || ui.member)}</label>
      <label class="wide">종목<input name="name" data-ticker autocomplete="off" required value="${esc(p?.name || name || '')}" placeholder="종목 이름·코드로 찾기"></label>
      <label>받은 금액(원) <small>세후 실수령</small><input name="amount" type="number" min="0" step="any" inputmode="numeric" required value="${p?.amount ?? ''}"></label>
      <label>상태<select name="status">${opt('paid', '지급 완료', p?.status)}${opt('due', '지급 예정', p?.status)}</select></label>
      <label class="wide">메모<input name="memo" value="${esc(p?.memo || '')}"></label>
      ${foot(p ? 'del-payout' : '', p?.id)}</form>`);
  },
  // preset: 종목 상세에서 바로 열 때 미리 채울 값 { name, side, accountId, price }
  trade(t, preset = {}) {
    if (!S().accounts.length) return dialogs.account(null);
    t = t || (preset.name ? { ...preset, _new: true } : null);
    const isNew = !t || t._new;
    openDialog(`<form method="dialog" class="form" data-form="trade"><h3>${isNew ? '매매 기록' : '매매 기록 고치기'}</h3><input type="hidden" name="id" value="${isNew ? '' : t.id}">
      <label>날짜<input type="date" name="date" required value="${t?.date || today()}"></label>
      <label>계좌${acctSel(t?.accountId)}</label>
      <label class="wide">종목<input name="name" data-ticker autocomplete="off" required value="${esc(t?.name || '')}"></label>
      <label>구분<select name="side">${opt('buy', '매수', t?.side)}${opt('sell', '매도', t?.side)}</select></label>
      <label>수량<input name="qty" type="number" min="0" step="any" inputmode="decimal" required value="${t?.qty ?? ''}"></label>
      <label class="wide">단가(원) <small>해외 주식은 원화로 환산한 값 · 종목을 고르면 지금 가격이 채워져요</small><input name="price" type="number" min="0" step="any" inputmode="decimal" required value="${t?.price ?? ''}"></label>
      <p class="small muted wide" data-trade-sum></p>
      <label class="wide">메모<input name="memo" value="${esc(t?.memo || '')}" placeholder="왜 샀는지 한 줄"></label>
      ${isNew ? '<label class="check wide"><input type="checkbox" name="apply" checked> 잔고에도 반영 (수량·매입금액·원화 예수금)</label>' : ''}
      ${foot(isNew ? '' : 'del-trade', t?.id)}</form>`);
    tradeSum($('#dlg form'));
  },
  flow(f) {
    openDialog(`<form method="dialog" class="form" data-form="flow"><h3>${f ? '입출금 고치기' : '입출금 기록'}</h3><input type="hidden" name="id" value="${f?.id || ''}">
      <label>날짜<input type="date" name="date" required value="${f?.date || today()}"></label>
      <label>구성원${memberSel(f?.memberId || ui.member)}</label>
      <label>구분<select name="type">${opt('in', '입금', f?.type)}${opt('out', '출금', f?.type)}</select></label>
      <label>종류<select name="cat">${views.FLOW_CATS.map((c) => opt(c, c, f?.cat)).join('')}</select></label>
      <label class="wide">금액(원)<input name="amount" type="number" min="0" step="any" inputmode="numeric" required value="${f?.amount ?? ''}"></label>
      <label class="wide">메모<input name="memo" value="${esc(f?.memo || '')}"></label>
      ${foot(f ? 'del-flow' : '', f?.id)}</form>`);
  },
  watch(name) {
    const groups = [...new Set(S().watch.map((w) => w.group).filter(Boolean))];
    openDialog(`<form method="dialog" class="form" data-form="watch"><h3>관심 종목 추가</h3>
      <label class="wide">종목<input name="name" data-ticker autocomplete="off" required value="${esc(name || '')}" placeholder="종목 이름·코드로 찾기"></label>
      <label class="wide">묶음 <small>비우면 미분류</small><input name="group" list="dl-g" placeholder="예: 조선"></label>
      <label class="wide">메모<input name="memo"></label>
      <p class="small muted wide">국내 · 미국 · 일본 · 홍콩 · 중국 · 베트남 상장 종목을 이름이나 코드로 찾을 수 있어요. 차트·200일선·배당은 대표 종목과 차트 대상에 든 종목만 나옵니다.</p>
      <datalist id="dl-g">${groups.map((g) => `<option>${esc(g)}</option>`).join('')}</datalist>${foot()}</form>`);
  },
  note(n, name) {
    openDialog(`<form method="dialog" class="form" data-form="note"><h3>${n ? '노트 고치기' : '리서치 노트'}</h3><input type="hidden" name="id" value="${n?.id || ''}">
      <label>날짜<input type="date" name="date" required value="${n?.date || today()}"></label>
      <label>종류<select name="kind">${views.NOTE_KINDS.map(([k, l]) => opt(k, l, n?.kind || (name ? 'stock' : 'market'))).join('')}</select></label>
      <label class="wide">제목<input name="title" required value="${esc(n?.title || '')}"></label>
      <label>종목 <small>선택</small><input name="name" data-ticker autocomplete="off" value="${esc(n?.name || name || '')}"></label>
      <label>링크 <small>선택</small><input name="url" type="url" value="${esc(n?.url || '')}" placeholder="https://"></label>
      <label class="wide">내용<textarea name="body" rows="9" class="prose">${esc(n?.body || '')}</textarea></label>
      ${n?.url ? `<p class="wide small"><a href="${esc(n.url)}" target="_blank" rel="noopener noreferrer">🔗 링크 열기</a></p>` : ''}
      ${foot(n ? 'del-note' : '', n?.id)}</form>`, 'wide');
  },
  link(l) {
    openDialog(`<form method="dialog" class="form" data-form="link"><h3>${l ? '바로가기 고치기' : '바로가기 추가'}</h3><input type="hidden" name="id" value="${l?.id || ''}">
      <label>이름<input name="name" required value="${esc(l?.name || '')}" placeholder="네이버증권"></label>
      <label>아이콘 <small>선택</small><input name="emoji" maxlength="4" value="${esc(l?.emoji || '')}" placeholder="🔗"></label>
      <label class="wide">주소<input name="url" required value="${esc(l?.url || '')}" placeholder="https://" inputmode="url" autocapitalize="off" spellcheck="false"></label>
      ${foot(l ? 'del-link' : '', l?.id)}</form>`);
  },
  goal() {
    openDialog(`<form method="dialog" class="form" data-form="goal"><h3>가족 목표</h3>
      <label class="wide">목표 금액(원)<input name="goal" type="number" min="0" step="any" inputmode="numeric" value="${S().meta.goal || ''}" placeholder="1000000000"></label>
      <p class="small muted wide">구성원별 목표는 가족·설정에서 구성원 '편집'으로 정해요.</p>${foot()}</form>`);
  },
  csv() {
    openDialog(`<form method="dialog" class="form" data-form="csv"><h3>잔고 CSV 가져오기</h3>
      <p class="small muted wide">첫 줄은 <code>account,name,qty,value_krw</code> (매입금액이 있으면 <code>,cost_krw</code>). 수량이 빈 줄은 그 계좌의 예수금으로 합쳐요. CSV에 나온 계좌만 새 잔고로 바뀝니다.</p>
      <label class="wide">누구 계좌인가요${memberSel(ui.member)}</label>
      <label class="wide">CSV<textarea name="csv" rows="9" required placeholder="account,name,qty,value_krw&#10;ISA,KODEX 200,48,4261680&#10;ISA,예수금,,2000000"></textarea></label>
      <div class="row wide"><span class="grow"></span><button type="button" class="btn" data-act="close">취소</button><button class="btn primary">가져오기</button></div></form>`);
  },
  bulkCost() {
    const pos = summary(ui.member || undefined).pos;
    if (!pos.length) return toast('보유 종목이 없어요.');
    const byAcct = new Map();
    for (const p of pos) { if (!byAcct.has(p.account.id)) byAcct.set(p.account.id, []); byAcct.get(p.account.id).push(p); }
    const rows = [...byAcct.values()].map((list) => `<tr class="grp"><td colspan="4">${esc(S().members.find((m) => m.id === list[0].memberId)?.emoji || '')} ${esc(list[0].account.name)}</td></tr>${
      list.map((p) => `<tr><td>${esc(p.name)}<small>${num(p.qty, 4)}주 · 지금 ${px(p.q)}</small></td>
        <td><input type="number" step="any" min="0" inputmode="decimal" data-avg="${p.id}" data-qty="${p.qty}" data-fx="${p.q?.cur === 'USD' ? p.q.fx : 1}" placeholder="${p.q?.cur === 'USD' ? '$ 평단' : '평단'}" value="${p.cost && p.qty ? +(p.cost / p.qty / (p.q?.cur === 'USD' ? p.q.fx : 1)).toFixed(p.q?.cur === 'USD' ? 2 : 0) : ''}"></td>
        <td><input type="number" step="any" min="0" inputmode="numeric" name="cost-${p.id}" placeholder="매입금액(원)" value="${p.cost != null ? Math.round(p.cost) : ''}"></td></tr>`).join('')}`).join('');
    openDialog(`<form method="dialog" class="form" data-form="bulk"><h3>매입금액 한꺼번에 넣기</h3>
      <p class="small muted wide">증권사 앱의 <b>평균단가</b>나 <b>매입금액</b> 중 편한 쪽만 적으면 돼요. 평단을 적으면 매입금액(평단 × 수량)이 자동으로 채워집니다. 미국 주식의 평단은 달러로 적고, 지금 환율로 원화 환산해요(살 때 환율과 다르면 매입금액 칸에 원화 금액을 직접 적는 편이 정확합니다).</p>
      <div class="scroll wide"><table class="bulk"><thead><tr><th>종목</th><th>평단</th><th>매입금액(원)</th></tr></thead><tbody>${rows}</tbody></table></div>
      <div class="row wide"><span class="grow"></span><button type="button" class="btn" data-act="close">취소</button><button class="btn primary">저장</button></div></form>`, 'wide');
  },
  importPick() {
    openDialog(`<form method="dialog" class="form" data-form="pick"><h3>가져오기 / 복원</h3>
      <p class="small muted wide">가져오기 파일(app_import_날짜.json)이나 잔고 CSV는 고른 구성원의 계좌로 들어가요. 백업 파일을 고르면 전체를 그 백업 내용으로 되돌립니다.</p>
      <label class="wide">누구 계좌인가요${memberSel(ui.member)}</label>
      <div class="row wide"><span class="grow"></span><button type="button" class="btn" data-act="close">취소</button><button class="btn primary">파일 고르기</button></div></form>`);
  },
  reset() {
    openDialog(`<div class="form"><h3>⚠️ 전체 데이터 초기화</h3>
      <p class="wide">구성원 ${S().members.length}명, 계좌 ${S().accounts.length}개, 보유 ${S().holdings.length}줄, 매매 ${S().trades.length}건, 노트 ${S().notes.length}개가 모두 지워지고 구성원 "나"만 남아요.${syncOn() ? ' <b>동기화가 켜져 있어서 다른 기기에서도 지워집니다.</b>' : ''} 되돌릴 수 없으니 먼저 백업을 저장하세요.</p>
      <div class="row wide"><button class="btn" data-act="backup">전체 백업 ↓</button><span class="grow"></span><button class="btn" data-act="close">취소</button><button class="btn danger" data-act="reset-go">초기화 실행</button></div></div>`);
  },
  stock(name) {
    const q = quote(name);
    const rows = summary().pos.filter((p) => p.name === name);
    const g = byName(rows)[0];
    const notes = S().notes.filter((n) => n.name === name).sort((a, b) => b.date.localeCompare(a.date));
    const watched = S().watch.find((w) => w.name === name);
    const kr = q?.cur === 'KRW';
    // 차트 자료가 없는 해외 종목은 "보고 싶은 종목"에 올려 둔다. 시세를 받는 쪽이 다음 실행 때 이 목록의 일봉도 받는다.
    let wanted = false;
    if (q && !q.full && !kr && !store.DEMO.on) {
      wanted = true;
      if (!S().wanted.some((w) => w.name === name)) {
        S().wanted.filter((w) => !S().holdings.some((h) => h.name === w.name)).sort((a, b) => a.u - b.u).slice(0, Math.max(0, S().wanted.length - 39)).forEach((w) => del('wanted', w.id));
        put('wanted', { name });
      }
    }
    const tvSym = !q ? '' : kr ? `KRX:${q.code || q.key}` : q.market === 'jp' ? `TSE:${q.code}` : q.market === 'hk' ? `HKEX:${Number(q.code)}` : q.market === 'cn' ? `${q.key.endsWith('.SS') ? 'SSE' : 'SZSE'}:${q.code}` : q.key.replace('-', '.');
    const tv = q ? `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}` : '';
    const naverWorld = q && ['jp', 'hk', 'cn'].includes(q.market) ? `<a href="https://m.stock.naver.com/worldstock/stock/${esc(q.key)}/total" target="_blank" rel="noopener noreferrer">네이버증권</a> · ` : '';
    const r52 = q && q.hi52 > q.lo52 ? (q.raw - q.lo52) / (q.hi52 - q.lo52) : null;
    const st = (l, v, s = '') => `<div><span>${l}</span><b>${v}</b>${s ? `<em>${s}</em>` : ''}</div>`;
    openDialog(`<div class="stock" data-stock="${esc(name)}">
      <header class="row between"><div><h3>${esc(name)} <span class="badge">${esc(sectorOf(name))}</span></h3><p class="hl">${px(q)} <span class="small">${q ? chg(q.chg) : '시세 없음'}</span></p></div>
        <span class="row"><button class="btn sm" data-act="toggle-watch" data-v="${esc(name)}">${watched ? '⭐ 관심 해제' : '☆ 관심'}</button><button class="btn sm" data-act="close">닫기</button></span></header>
      ${q?.full ? `<div class="seg" role="tablist">${[[60, '3개월'], [120, '6개월'], [200, '10개월']].map(([v, l]) => `<button role="tab" aria-selected="${ui.stockRange === v}" data-act="stock-range" data-v="${v}">${l}</button>`).join('')}</div>
      <div id="pchart" class="chart"></div>
      <div class="tiles flat">${st('200일선 대비', q.ma200 ? chg((q.raw / q.ma200 - 1) * 100) : '—', q.ma200slope != null ? `기울기 ${(q.ma200slope * 100).toFixed(1)}%` : '')}${st('60일선 대비', q.ma60 ? chg((q.raw / q.ma60 - 1) * 100) : '—')}${st('52주 범위', r52 != null ? `${Math.round(r52 * 100)}%` : '—', q.hi52 ? `${num(q.lo52, kr ? 0 : 2)} ~ ${num(q.hi52, kr ? 0 : 2)}` : '')}${st('배당률', q.div ? p1(q.div / q.raw) : '—', q.div ? `최근 1년 주당 ${num(q.div, kr ? 0 : 2)}` : '')}</div>` : (q && q.cur === 'KRW' && q.code
        ? `<div class="seg" role="tablist">${[['area/year', '1년'], ['area/year3', '3년'], ['candle/day', '일봉'], ['candle/week', '주봉']].map(([v, l]) => `<button role="tab" aria-selected="${ui.imgRange === v}" data-act="img-range" data-v="${v}">${l}</button>`).join('')}</div>
           <div class="nchart"><img src="https://ssl.pstatic.net/imgfinance/chart/item/${ui.imgRange}/${esc(q.code)}.png?t=${Math.floor(Date.now() / 600000)}" alt="${esc(name)} 차트" loading="lazy" referrerpolicy="no-referrer"></div>
           <p class="small muted">네이버 증권의 차트 그림이에요. 200일선·배당까지 보려면 이 종목을 보유나 관심에 담아 두세요(차트 자동 추가를 켠 경우).</p>`
        : q ? `<p class="small muted">${wanted ? '이 종목을 차트 대상에 올려 뒀어요. 차트 자동 추가를 켜 두었다면 다음 시세 갱신(15~30분) 뒤부터 차트·200일선이 나옵니다.' : '차트 자료가 아직 없어요.'} 아래 링크에서 바로 볼 수도 있어요.</p>` : '<p class="small muted">상장 종목 목록에 없는 이름이라 시세가 없어요.</p>')}
      <h4>내 보유</h4>
      ${g ? `<p class="small">${num(g.qty, 4)}주 · ${won(g.value)}${g.pl != null ? ` · ${delta(g.pl, g.plPct)}` : ''}</p>
        <ul class="list">${rows.map((p) => `<li><button class="lrow" data-act="edit-holding" data-v="${p.id}"><span>${esc(p.account.name)}<small>${num(p.qty, 4)}주${p.cost ? ` · 매입 ${won(p.cost)}` : ''}</small></span><b>${won(p.value)}${p.pl != null ? `<small>${delta(p.pl, p.plPct)}</small>` : ''}</b></button></li>`).join('')}</ul>` : '<p class="small muted">보유하고 있지 않아요.</p>'}
      <div class="row"><button class="btn sm primary" data-act="quick-trade" data-v="${esc(name)}" data-side="buy">＋ 매수 기록</button>${g ? `<button class="btn sm" data-act="quick-trade" data-v="${esc(name)}" data-side="sell">− 매도 기록</button>` : ''}<button class="btn sm" data-act="add-holding-named" data-v="${esc(name)}">보유 직접 추가</button><button class="btn sm" data-act="add-note" data-v="${esc(name)}">✏️ 노트 쓰기</button></div>
      ${notes.length ? `<h4>리서치 노트</h4><ul class="list">${notes.map((n) => `<li><button class="lrow" data-act="edit-note" data-v="${n.id}"><span>${esc(n.title)}<small>${n.date} · ${esc((n.body || '').slice(0, 60))}</small></span></button></li>`).join('')}</ul>` : ''}
      ${q ? `<p class="small links">더 보기: ${kr ? `<a href="https://m.stock.naver.com/domestic/stock/${esc(q.key)}/total" target="_blank" rel="noopener noreferrer">네이버증권</a> · ` : `${naverWorld}<a href="https://finance.yahoo.com/quote/${esc(q.key)}" target="_blank" rel="noopener noreferrer">야후 파이낸스</a> · `}<a href="${esc(tv)}" target="_blank" rel="noopener noreferrer">트레이딩뷰 차트</a></p>` : ''}
    </div>`, 'wide');
    if (q?.full) store.loadHistory(q.key).then((h) => { if ($('#dlg [data-stock]')?.dataset.stock === name) drawPrice($('#pchart'), h, ui.stockRange); });
  },
};

// ───────────────────────── 파일
let importMember = 'm1';
function pickFile() {
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,.csv,application/json,text/csv' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0];
    if (!f) return;
    try {
      const text = await f.text();
      if (/\.csv$/i.test(f.name)) toast(`계좌 ${store.importRows(store.parseCSV(text), importMember)}개의 잔고를 가져왔어요.`);
      else toast(store.importData(JSON.parse(text), importMember));
      snapshot();
      render();
    } catch (e) { toast(`가져오지 못했어요: ${e.message}`); }
  });
  inp.click();
}

// ───────────────────────── 문서(선별노트 등)
function pickDoc() {
  if (store.DEMO.on) return toast('데모 중에는 문서를 올릴 수 없어요.');
  const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.html,.htm,.md,.txt,text/html,text/plain' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast('2MB보다 큰 문서는 올릴 수 없어요.');
    const text = await f.text();
    const html = /\.html?$/i.test(f.name);
    const title = (html && text.match(/<title>([^<]{1,80})<\/title>/i)?.[1].trim()) || f.name.replace(/\.[^.]+$/, '').replace(/[_-]?\d{4}-\d{2}-\d{2}$/, '');
    const id = store.docId(title);
    if (!store.docSet(id, text)) return toast('이 기기의 저장 공간이 모자라요.');
    put('docs', { id, title, date: (f.name.match(/\d{4}-\d{2}-\d{2}/) || [today()])[0], size: f.size, html, file: f.name });
    render();
    if (!syncOn()) return toast(`"${title}"을 이 기기에 넣었어요. 동기화를 연결하면 다른 기기에서도 보여요.`);
    toast('문서를 보관함에 올리는 중…');
    try { await putDoc(id, text); toast(`"${title}"을 올렸어요. 다른 기기에서도 열 수 있어요.`); } catch (e) { toast(`보관함에 올리지 못했어요: ${e.message}`); }
  });
  inp.click();
}
async function openDoc(id) {
  const d = S().docs.find((x) => x.id === id);
  if (!d) return;
  let text = store.docGet(id);
  if (text == null) {
    if (!syncOn()) return toast('이 기기에는 문서 본문이 없어요. 올린 기기에서 동기화를 연결해 주세요.');
    toast('문서를 받아 오는 중…');
    try { text = await getDoc(id); store.docSet(id, text); } catch (e) { return toast(e.message); }
  }
  // 문서 안의 스크립트가 앱의 저장분을 건드리지 못하게 격리된 틀(sandbox) 안에서 보여 준다
  const body = d.html ? text : `<pre style="white-space:pre-wrap;font:15px/1.6 system-ui,sans-serif;padding:16px">${esc(text)}</pre>`;
  openDialog(`<div class="docbar"><b>${esc(d.title)}</b><span class="muted small">${d.date}</span><span class="grow"></span><button class="btn sm danger" data-act="del-doc" data-v="${d.id}">삭제</button><button class="btn sm" data-act="close">닫기</button></div>
    <iframe class="docframe" sandbox="allow-scripts allow-popups" referrerpolicy="no-referrer" title="${esc(d.title)}"></iframe>`, 'doc');
  $('#dlg .docframe').srcdoc = body;
}

function exportTrades() {
  const acct = new Map(S().accounts.map((a) => [a.id, a]));
  const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const lines = ['date,member,account,side,name,qty,price,total,memo'];
  for (const t of [...S().trades].sort((a, b) => a.date.localeCompare(b.date))) {
    const a = acct.get(t.accountId);
    lines.push([t.date, S().members.find((m) => m.id === a?.memberId)?.name, a?.name, t.side, t.name, t.qty, t.price, t.qty * t.price, t.memo].map(cell).join(','));
  }
  download(`매매일지_${today()}.csv`, `﻿${lines.join('\n')}`, 'text/csv;charset=utf-8');
}

// ───────────────────────── 홈 카드 순서 · 종목 찾기 목록
function moveCard(id, dir) {
  const hidden = new Set(D.homeHidden || []);
  const order = views.homeOrder();
  const vis = order.filter((x) => !hidden.has(x));
  const i = vis.indexOf(id), j = i + dir;
  if (i < 0 || j < 0 || j >= vis.length) return;
  const a = order.indexOf(vis[i]), b = order.indexOf(vis[j]);
  [order[a], order[b]] = [order[b], order[a]];
  D.homeOrder = order; store.saveDevice(); render();
}
function closeAc() { document.querySelectorAll('.ac').forEach((x) => x.remove()); }
function showAc(inp) {
  closeAc();
  // 처음 찾기 시작할 때 해외 종목 목록(미국·일본·홍콩·중국·베트남)도 받아 온다
  if (!store.ALL.full && !showAc.loading) {
    showAc.loading = true;
    store.loadMarkets('vn', 60).then(() => { showAc.loading = false; if (document.activeElement === inp) showAc(inp); });
  }
  const hits = store.searchTickers(inp.value, 8);
  if (!hits.length && !store.ALL.full && inp.value.trim()) {
    const wait = document.createElement('div');
    wait.className = 'ac';
    wait.innerHTML = '<p class="small muted">해외 종목 목록을 받는 중이에요…</p>';
    inp.closest('label').append(wait);
    return;
  }
  if (!hits.length || (hits.length === 1 && hits[0].name === inp.value.trim())) return;
  const box = document.createElement('div');
  box.className = 'ac';
  box.innerHTML = hits.map((h) => { const q = quote(h.name); return `<button type="button" data-act="ac-pick" data-v="${esc(h.name)}"><span>${esc(h.name)}<small>${esc(h.sub)}</small></span><b>${q ? px(q) : ''}<small>${q ? chg(q.chg) : ''}</small></b></button>`; }).join('')
    + (store.ALL.full ? '' : '<p class="small muted">해외 종목 목록을 받는 중이에요…</p>');
  inp.closest('label').append(box);
}

// ───────────────────────── 버튼
const find = (coll, id) => S()[coll].find((x) => x.id === id);
const setUi = (k) => (el) => { ui[k] = el.dataset.v; render(); };
const removeAnd = (coll, msg) => (el) => { del(coll, el.dataset.v); closeDialog(); render(); if (msg) toast(msg); };

const actions = {
  'hold-member': setUi('member'), 'log-member': setUi('member'), 'hold-mode': setUi('holdMode'), 'log-mode': setUi('logMode'), 'log-side': setUi('logSide'),
  'trend-mode': setUi('trend'), 'watch-group': setUi('watchGroup'), 'watch-view': setUi('watchView'), 'map-sort': setUi('mapSort'), 'note-kind': setUi('noteKind'),
  'watch-range': (el) => { ui.watchRange = +el.dataset.v; render(); },
  'pick-sector': (el) => { ui.sector = ui.sector === el.dataset.v ? '' : el.dataset.v; render(); },
  'stock-range': (el) => { ui.stockRange = +el.dataset.v; dialogs.stock($('#dlg [data-stock]').dataset.stock); },
  'open-stock': (el) => dialogs.stock(el.dataset.v),
  'add-member': () => dialogs.member(null), 'edit-member': (el) => dialogs.member(find('members', el.dataset.v)),
  'add-account': (el) => dialogs.account(null, el.dataset.v), 'edit-account': (el) => dialogs.account(find('accounts', el.dataset.v)),
  'add-holding': (el) => dialogs.holding(null, el.dataset.v), 'add-holding-named': (el) => dialogs.holding(null, null, el.dataset.v), 'edit-holding': (el) => dialogs.holding(find('holdings', el.dataset.v)),
  'add-asset': (el) => dialogs.asset(null, ...el.dataset.v.split('|')), 'edit-asset': (el) => dialogs.asset(find('assets', el.dataset.v)),
  'add-trade': () => dialogs.trade(null), 'edit-trade': (el) => dialogs.trade(find('trades', el.dataset.v)),
  'add-flow': () => dialogs.flow(null), 'edit-flow': (el) => dialogs.flow(find('flows', el.dataset.v)),
  'add-watch': () => dialogs.watch(), 'add-note': (el) => dialogs.note(null, el.dataset.v), 'edit-note': (el) => dialogs.note(find('notes', el.dataset.v)),
  'bulk-cost': () => dialogs.bulkCost(),
  'pick-tool': (el) => { ui.tool = el.dataset.v; render(); },
  'add-doc': () => pickDoc(), 'open-doc': (el) => openDoc(el.dataset.v),
  'del-doc': (el) => { del('docs', el.dataset.v); store.docDel(el.dataset.v); closeDialog(); render(); toast('문서를 목록에서 지웠어요.'); },
  'img-range': (el) => { ui.imgRange = el.dataset.v; dialogs.stock($('#dlg [data-stock]').dataset.stock); },
  'toggle-demo': () => { if (store.DEMO.on) store.exitDemo(); else store.enterDemo(); closeDialog(); render(); scrollTo(0, 0); toast(store.DEMO.on ? '데모 모드예요. 실제 자료는 그대로 있어요.' : '데모를 끝냈어요. 실제 자료로 돌아왔습니다.'); },
  'add-payout': () => dialogs.payout(null), 'edit-payout': (el) => dialogs.payout(find('payouts', el.dataset.v)), 'del-payout': removeAnd('payouts'),
  'quick-trade': (el) => {
    const name = el.dataset.v, q = quote(name);
    const held = S().holdings.filter((h) => h.name === name).sort((a, b) => b.qty - a.qty)[0];
    dialogs.trade(null, { name, side: el.dataset.side, accountId: held?.accountId, price: q ? Math.round(q.krw) : '', qty: '' });
  },
  'fill-cost': () => { const f = $('#dlg form'), q = quote(f.name.value.trim()); if (q && Number(f.qty.value) > 0) f.cost.value = Math.round(Number(f.qty.value) * q.krw); else toast('종목과 수량을 먼저 넣어 주세요.'); },
  'fv-fill': (el) => { ui.toolState.fv = { ...(ui.toolState.fv || {}), pv: el.dataset.v }; render(); },
  'tax-fill': (el) => { ui.toolState.tax = { gain: el.dataset.v }; render(); },
  'fv-goal': (el) => { store.setGoal(Number(el.dataset.v)); render(); toast(`가족 목표를 ${won(Number(el.dataset.v))}로 저장했어요.`); },
  'del-history': (el) => { del('history', el.dataset.v); render(); },
  'toggle-usd': () => { D.usd = !D.usd; store.saveDevice(); render(); toast(D.usd ? '달러로 보여 줘요 (지금 환율 기준).' : '원화로 보여 줘요.'); },
  'add-link': () => dialogs.link(null), 'edit-link': (el) => dialogs.link(find('links', el.dataset.v)), 'del-link': removeAnd('links'),
  'toggle-edit-links': () => { ui.editLinks = !ui.editLinks; render(); },
  'seed-links': () => { [['네이버증권', 'https://m.stock.naver.com', '📈'], ['토스증권', 'https://tossinvest.com', '💰'], ['FRED', 'https://fred.stlouisfed.org', '📊'], ['Investing', 'https://kr.investing.com', '🌐']].forEach(([name, url, emoji]) => put('links', { name, url, emoji })); render(); },
  'toggle-edit-cards': () => { ui.editCards = !ui.editCards; render(); },
  'card-up': (el) => moveCard(el.dataset.v, -1), 'card-down': (el) => moveCard(el.dataset.v, 1),
  'card-hide': (el) => { D.homeHidden = [...new Set([...(D.homeHidden || []), el.dataset.v])]; store.saveDevice(); render(); },
  'card-show': (el) => { D.homeHidden = (D.homeHidden || []).filter((x) => x !== el.dataset.v); store.saveDevice(); render(); },
  'ac-pick': (el) => { const inp = el.closest('label').querySelector('input'); inp.value = el.dataset.v; closeAc(); inp.dispatchEvent(new Event('input', { bubbles: true })); closeAc(); inp.form?.querySelector('[name=qty]')?.focus(); },
  'edit-goal': () => dialogs.goal(), 'paste-csv': () => dialogs.csv(), reset: () => dialogs.reset(), close: () => closeDialog(),
  'del-member': removeAnd('members', '구성원과 그 계좌·자산을 지웠어요.'), 'del-account': removeAnd('accounts', '계좌와 그 안의 종목을 지웠어요.'), 'del-holding': removeAnd('holdings'),
  'del-asset': removeAnd('assets'), 'del-trade': removeAnd('trades', '기록만 지웠어요. 잔고 수량은 그대로예요.'), 'del-flow': removeAnd('flows'), 'del-note': removeAnd('notes'),
  'toggle-watch': (el) => { const w = S().watch.find((x) => x.name === el.dataset.v); if (w) del('watch', w.id); else put('watch', { name: el.dataset.v, group: sectorOf(el.dataset.v) }); render(); dialogs.stock(el.dataset.v); },
  'import-file': () => { if (S().members.length > 1) dialogs.importPick(); else { importMember = S().members[0].id; pickFile(); } },
  backup: () => { download(`투자하우스_백업_${today()}.json`, store.exportBackup()); toast('백업 파일을 저장했어요.'); },
  'export-trades': () => { exportTrades(); toast(`매매일지 ${S().trades.length}건을 CSV로 저장했어요.`); },
  'reset-go': () => { store.resetAll(); closeDialog(); render(); toast('초기화했어요.'); },
  'snap-now': () => { const old = S().history.find((h) => h.id === today()); if (old) old.u = 0; snapshot(); render(); toast('지금 자산을 기록했어요.'); },
  // 상단 새로고침: 시세와 보관함(동기화)을 함께 다시 받는다
  'refresh-all': async () => {
    toast('다시 받는 중…');
    const [ok] = await Promise.all([store.loadPrices(), syncOn() ? syncNow() : false]);
    snapshot(); render();
    const syncBad = syncOn() && SY.state !== 'ok' && SY.state !== 'busy';
    toast(syncBad ? `${ok ? '시세는 받았지만 ' : ''}동기화하지 못했어요. ${SY.msg || ''}`.trim() : ok ? (syncOn() ? '시세와 계좌 자료를 다시 받았어요.' : '시세를 다시 받았어요.') : '시세를 받지 못했어요.');
  },
  'refresh-px': async () => { const ok = await store.loadPrices(); snapshot(); render(); toast(ok ? '시세를 다시 받았어요.' : '시세를 받지 못했어요.'); },
  'toggle-hide': () => { D.hide = !D.hide; store.saveDevice(); render(); },
  'toggle-theme': () => { D.theme = { auto: 'light', light: 'dark', dark: 'auto' }[D.theme]; store.saveDevice(); applyDevice(); render(); toast({ auto: '기기 설정대로', light: '밝게', dark: '어둡게' }[D.theme]); },
  'toggle-font': () => { D.font = (D.font + 1) % 3; store.saveDevice(); applyDevice(); render(); },
  'go-sync': () => { if (syncOn()) syncNow().then((c) => { c && render(); toast(SY.state === 'ok' ? '동기화했어요.' : (SY.msg || '동기화하지 못했어요.')); }); else location.hash = '#set'; },
  'sync-now': () => actions['go-sync'](),
  'sync-off': () => { D.token = ''; store.saveDevice(); SY.state = 'off'; SY.msg = ''; render(); toast('이 기기의 연결을 끊었어요. 내용은 이 기기에 그대로 남아 있어요.'); },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.matches('input, select, textarea')) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});
document.addEventListener('change', (e) => {
  if (e.target.dataset?.act === 'hold-sort') { ui.sort = e.target.value; render(); }
});

// ───────────────────────── 입력 양식
const n0 = (v) => (v === '' || v == null ? null : Number(v));
const forms = {
  member(f) { const m = find('members', f.id) || {}; put('members', { ...m, name: f.name.trim(), emoji: f.emoji, goal: n0(f.goal) || 0 }); },
  account(f) { const a = find('accounts', f.id) || {}; put('accounts', { ...a, memberId: f.memberId, name: f.name.trim(), cashKRW: n0(f.cashKRW) || 0, cashUSD: n0(f.cashUSD) || 0 }); },
  holding(f) { const h = find('holdings', f.id) || {}; put('holdings', { ...h, accountId: f.accountId, name: f.name.trim(), qty: Number(f.qty), cost: n0(f.cost), value: n0(f.value) || 0, sector: f.sector.trim() }); },
  bulk(f) {
    let n = 0;
    for (const [k, v] of Object.entries(f)) {
      if (!k.startsWith('cost-')) continue;
      const h = find('holdings', k.slice(5)), cost = n0(v);
      if (h && (h.cost ?? null) !== cost) { put('holdings', { ...h, cost }); n++; }
    }
    toast(n ? `${n}줄의 매입금액을 저장했어요.` : '바뀐 것이 없어요.');
  },
  asset(f) { const a = find('assets', f.id) || {}; put('assets', { ...a, memberId: f.memberId, cat: f.cat, name: f.name.trim(), value: Number(f.value), memo: f.memo.trim() }); },
  trade(f) {
    const old = find('trades', f.id);
    const t = { ...(old || {}), date: f.date, accountId: f.accountId, name: f.name.trim(), side: f.side, qty: Number(f.qty), price: Number(f.price), memo: f.memo.trim() };
    if (!(t.qty > 0) || !(t.price > 0)) throw new Error('수량과 단가를 확인해 주세요.');
    put('trades', t);
    if (!old && f.apply) applyTrade(t);
    toast(`${t.side === 'buy' ? '매수' : '매도'} ${won(t.qty * t.price)} ${old ? '고쳤어요' : '기록했어요'}.`);
  },
  flow(f) {
    const amount = Number(f.amount);
    if (!(amount > 0)) throw new Error('금액을 확인해 주세요.');
    put('flows', { ...(find('flows', f.id) || {}), date: f.date, memberId: f.memberId, type: f.type, cat: f.cat, amount, memo: f.memo.trim() });
  },
  watch(f) { const n = f.name.trim(); if (!S().watch.some((w) => w.name === n)) put('watch', { name: n, group: f.group.trim(), memo: f.memo.trim() }); },
  note(f) { put('notes', { ...(find('notes', f.id) || {}), date: f.date, kind: f.kind, title: f.title.trim(), name: f.name.trim(), url: f.url.trim(), body: f.body }); },
  goal(f) { store.setGoal(n0(f.goal) || 0); },
  payout(f) {
    const amount = Number(f.amount);
    if (!(amount > 0)) throw new Error('금액을 확인해 주세요.');
    put('payouts', { ...(find('payouts', f.id) || {}), date: f.date, memberId: f.memberId, name: f.name.trim(), amount, status: f.status, memo: f.memo.trim() });
  },
  link(f) {
    let url = f.url.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url.replace(/^[a-z]+:\/*/i, '')}`;
    try { new URL(url); } catch { throw new Error('주소를 확인해 주세요.'); }
    put('links', { ...(find('links', f.id) || {}), name: f.name.trim(), url, emoji: f.emoji.trim() });
  },
  rebal(f) {
    const targets = {};
    for (const c of CATS) { const v = n0(f[c.key]); if (v) targets[c.key] = v; }
    store.setMeta({ targets });
    ui.toolState.rebal = {};
    toast('목표 비중을 저장했어요.');
  },
  csv(f) { toast(`계좌 ${store.importRows(store.parseCSV(f.csv), f.memberId)}개의 잔고를 가져왔어요.`); },
  pick(f) { importMember = f.memberId; closeDialog(); pickFile(); return 'stay'; },
  sync(f) {
    const repo = f.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('저장소는 "아이디/이름" 모양으로 적어 주세요.');
    D.repo = repo; D.token = f.token.trim(); store.saveDevice();
    SY.state = 'busy';
    syncNow().then(() => { snapshot(); render(); toast(SY.state === 'ok' ? '연결됐어요. 이제 자동으로 맞춰요.' : (SY.msg || '연결하지 못했어요.')); });
  },
};

document.addEventListener('submit', (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) { if (e.target.closest('[data-tool]')) e.preventDefault(); return; }
  e.preventDefault();
  const f = Object.fromEntries(new FormData(form));
  try {
    const stockOpen = $('#dlg [data-stock]');
    if (forms[form.dataset.form](f) === 'stay') return;
    if (form.closest('#dlg')) closeDialog();
    snapshot();
    render();
    if (stockOpen) dialogs.stock(stockOpen.dataset.stock);
  } catch (err) { toast(err.message); }
});

// ───────────────────────── 바로 계산되는 입력(검색 · 도구)
document.addEventListener('focusout', (e) => { if (e.target.matches?.('[data-ticker]')) setTimeout(() => { if (!document.activeElement?.closest?.('.ac')) closeAc(); }, 180); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAc(); });
// 매매 기록 창: 종목을 고르면 지금 가격(원화 환산)을 채우고, 수량 × 단가 합계를 보여 준다
function tradeSum(form) {
  const el = form?.querySelector('[data-trade-sum]');
  if (!el) return;
  const q = quote(form.name.value.trim()), amt = Number(form.qty.value) * Number(form.price.value);
  el.innerHTML = `${q ? `지금 ${px(q)}${q.cur === 'KRW' ? '' : ` ≈ ${won(q.krw)}`} ${chg(q.chg)}` : ''}${amt > 0 ? `${q ? ' · ' : ''}합계 <b>${won(amt)}</b>` : ''}`;
}
document.addEventListener('input', (e) => {
  const tf = e.target.closest?.('[data-form="trade"]');
  if (tf) {
    if (e.target.name === 'name') { const q = quote(tf.name.value.trim()); if (q && (!tf.price.value || tf.price.dataset.auto)) { tf.price.value = Math.round(q.krw); tf.price.dataset.auto = '1'; } }
    if (e.target.name === 'price') delete tf.price.dataset.auto;
    tradeSum(tf);
  }
  if (e.target.matches?.('[data-ticker]')) showAc(e.target);
  if (e.target.dataset?.avg) {
    const el = e.target, cost = el.closest('tr').querySelector(`[name="cost-${el.dataset.avg}"]`);
    cost.value = el.value === '' ? '' : Math.round(Number(el.value) * Number(el.dataset.qty) * Number(el.dataset.fx));
    return;
  }
  if (e.target.dataset?.act === 'note-q') {
    ui.noteQ = e.target.value;
    const pos = e.target.selectionStart;
    render();
    const box = $('[data-act="note-q"]');
    box.focus(); box.setSelectionRange(pos, pos);
    return;
  }
  const form = e.target.closest('[data-tool]');
  if (!form) return;
  if (e.target.type === 'range') { const lb = form.querySelector('[data-range-label]'); if (lb) lb.textContent = `${e.target.value}%`; }
  runTool(form);
});
// 도구: 칸을 채우는 대로 계산. 고른 값은 기억해 뒀다가 화면을 다시 그릴 때 되살린다.
function runTool(form) {
  const tool = form.dataset.tool;
  const raw = Object.fromEntries(new FormData(form));
  ui.toolState[tool] = { ...(ui.toolState[tool] || {}), ...raw };
  form.querySelectorAll('input[type=checkbox]').forEach((c) => { ui.toolState[tool][c.name] = c.checked ? 'on' : ''; });
  const out = form.querySelector('output');
  const r = toolsMod.calc(tool, ui.toolState[tool], ui);
  if (typeof r === 'string') out.innerHTML = r;
  else { out.textContent = '계산 중…'; r.then((html) => { if (out.isConnected) out.innerHTML = html; }); }
}
// 방향·전략·계산 모드를 바꾸면 입력칸 구성이 달라지므로 화면을 다시 그린다
document.addEventListener('change', (e) => {
  const form = e.target.closest?.('[data-tool]');
  if (form && e.target.matches('select[name=mode], select[name=strat]')) { runTool(form); render(); }
});

// ───────────────────────── 시작
initTips();
applyDevice();
addEventListener('hashchange', () => { render(); scrollTo(0, 0); });
let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (tab() === 'home') drawHome(); }, 150); });
$('#dlg').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeDialog(); });

render();
onSync(() => { $('#head').innerHTML = views.head(); if (tab() === 'set' && !$('#view form:focus-within')) $('#view').innerHTML = views.set(ui); });
startSync(() => { if (!$('#dlg').open) render(); });
const safeRender = () => { if (!$('#dlg').open && !document.activeElement?.matches('input, textarea, select')) { snapshot(); render(); } };
// 종목 목록: 국내는 바로, 해외는 이미 받았거나 담아 둔 종목 중 못 찾은 것이 있을 때만 다시 받는다
const refreshMarkets = async () => {
  const have = store.MARKETS.filter((m) => store.ALL.data[m]);
  let changed = await store.loadMarkets(have.length ? have[have.length - 1] : 'kr');
  // 못 찾은 종목이 있으면 미국 → 일본 → … 순으로 찾을 때까지만 더 받는다
  for (const m of store.MARKETS.slice(1)) {
    if (!store.needsWorld()) break;
    if (!store.ALL.data[m]) changed = (await store.loadMarkets(m)) || changed;
  }
  if (changed) safeRender();
};
const refreshAll = () => store.loadPrices().then((ok) => { if (ok) { safeRender(); refreshMarkets(); } });
store.loadPrices().then(() => { snapshot(); render(); refreshMarkets(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshAll(); });
setInterval(() => { if (document.visibilityState === 'visible') refreshAll(); }, 5 * 60 * 1000);

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
