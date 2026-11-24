// 분석·도구 탭: 도구 모음. view() 는 화면 글자를, calc() 는 입력값으로 계산한 결과 글자를 만든다.
import { S, D, PX, CATS, quote, sectorOf, loadHistory, fxUSD } from './store.js';
import { summary, byName, dividends } from './model.js';
import { esc, won, num, p1, md, px, chg, delta, money } from './ui.js';
import { monthBars } from './charts.js';

export const TOOLS = [
  ['sim', '🔬 매매 시뮬'], ['fv', '🧮 미래 가치'], ['rebal', '⚖️ 리밸런싱'], ['house', '💰 원금회수'], ['split', '🎯 분할 전략'],
  ['compare', '📊 수익률 비교'], ['hist', '📈 자산 추이'], ['divs', '💸 배당'], ['tech', '📐 종목 위치'], ['avg', '➗ 물타기'], ['tax', '🧾 세금'],
];
const card = (title, sub, body, extra = '') => `<section class="card"><header><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div>${extra}</header>${body}</section>`;
const empty = (msg) => `<p class="empty">${msg}</p>`;
const val = (st, k, d = '') => esc(st[k] ?? d);
const sel = (st, k, opts, d) => opts.map(([v, l]) => `<option value="${v}" ${(st[k] ?? d) === v ? 'selected' : ''}>${l}</option>`).join('');
const chk = (st, k) => (st[k] ? 'checked' : '');
const N = (v) => (v === '' || v == null ? NaN : Number(v));
const pos52 = (q) => (q && q.hi52 > q.lo52 ? (q.raw - q.lo52) / (q.hi52 - q.lo52) : null);
const TAX = 0.22, INFL = 0.025;

// ───────────────────────── 화면
export function view(ui) {
  const tool = TOOLS.some((t) => t[0] === ui.tool) ? ui.tool : 'sim';
  const st = ui.toolState[tool] || {};
  const chips = `<div class="chips toolnav">${TOOLS.map(([k, l]) => `<button class="chip-btn" aria-pressed="${tool === k}" data-act="pick-tool" data-v="${k}">${l}</button>`).join('')}</div>`;
  const out = (t) => { const r = calc(t, st, ui); return typeof r === 'string' ? r : '계산 중…'; };
  const all = summary();
  let body = '';

  if (tool === 'sim') {
    body = card('🔬 매매 시뮬레이션', '특정 종목을 더 사거나 팔았을 때 비중이 어떻게 바뀌는지 봅니다. 실제 잔고는 바뀌지 않아요.', `<form class="form calc" data-tool="sim">
      <label class="wide">종목<input name="name" data-ticker autocomplete="off" placeholder="종목 이름·코드로 찾기" value="${val(st, 'name')}"></label>
      <label>구분<select name="side">${sel(st, 'side', [['buy', '매수'], ['sell', '매도']], 'buy')}</select></label>
      <label>수량<input name="qty" type="number" step="any" min="0" inputmode="decimal" value="${val(st, 'qty')}"></label>
      <output class="wide">${out('sim')}</output></form>`);
  } else if (tool === 'fv') {
    body = card('🧮 미래 가치 계산기', '복리로 불어나는 모습을 네 가지 방향으로 계산합니다.', `<form class="form calc" data-tool="fv">
      <label class="wide">무엇을 구할까요<select name="mode">${sel(st, 'mode', [['fv', '미래값 — 이렇게 모으면 얼마가 될까'], ['pmt', '필요 월투자금 — 목표까지 매달 얼마'], ['years', '필요 기간 — 목표까지 몇 년'], ['rate', '필요 수익률 — 목표까지 연 몇 %']], 'fv')}</select></label>
      <label>초기 투자금(만원)<input name="pv" type="number" step="any" min="0" inputmode="decimal" value="${val(st, 'pv')}"></label>
      <label>월 투자금(만원)<input name="pmt" type="number" step="any" min="0" inputmode="decimal" value="${val(st, 'pmt')}" ${st.mode === 'pmt' ? 'disabled placeholder="계산됨"' : ''}></label>
      <label>연 수익률(%)<input name="r" type="number" step="any" inputmode="decimal" value="${val(st, 'r')}" ${st.mode === 'rate' ? 'disabled placeholder="계산됨"' : ''}></label>
      <label>투자 기간(년)<input name="y" type="number" step="any" min="0" inputmode="decimal" value="${val(st, 'y')}" ${st.mode === 'years' ? 'disabled placeholder="계산됨"' : ''}></label>
      ${st.mode && st.mode !== 'fv' ? `<label class="wide">목표 금액(만원)<input name="target" type="number" step="any" min="0" inputmode="decimal" value="${val(st, 'target', S.meta.goal ? Math.round(S.meta.goal / 1e4) : '')}"></label>` : ''}
      <div class="row wide"><span class="small muted">현재 자산 채우기</span><button type="button" class="btn sm ghost" data-act="fv-fill" data-v="${Math.round(all.total / 1e4)}">🏠 가족 전체</button>${S.members.length > 1 ? S.members.map((m) => `<button type="button" class="btn sm ghost" data-act="fv-fill" data-v="${Math.round(summary(m.id).total / 1e4)}">${m.emoji} ${esc(m.name)}</button>`).join('') : ''}</div>
      <label class="check wide"><input type="checkbox" name="infl" ${chk(st, 'infl')}> 인플레이션 반영 (연 2.5%로 나눈 실질 가치도 표시)</label>
      <label class="check wide"><input type="checkbox" name="tax" ${chk(st, 'tax')}> 세후 수익률 (수익률의 22%를 매년 뗀다고 보는 단순 가정)</label>
      <output class="wide">${out('fv')}</output></form>`);
  } else if (tool === 'rebal') {
    const tg = { ...(S.meta.targets || {}), ...st };
    body = card('⚖️ 자산 리밸런싱', '종류별 목표 비중을 적으면 지금과의 차이를 금액으로 보여 줍니다.', `<form class="form calc" data-tool="rebal" data-form="rebal">
      <div class="wide scroll"><table class="bulk"><thead><tr><th>종류</th><th>지금</th><th>목표 %</th></tr></thead><tbody>
      ${CATS.map((c) => `<tr><td>${c.emoji} ${c.label}</td><td>${won(all.byCat[c.key] || 0)}<small>${p1(all.total ? (all.byCat[c.key] || 0) / all.total : 0)}</small></td><td><input name="${c.key}" type="number" step="any" min="0" max="100" inputmode="decimal" value="${esc(tg[c.key] ?? '')}" placeholder="0"></td></tr>`).join('')}
      </tbody></table></div>
      <output class="wide">${calc('rebal', tg, ui)}</output>
      <div class="row wide"><span class="grow"></span><button class="btn primary">목표 비중 저장</button></div></form>`);
  } else if (tool === 'house') {
    body = card('💰 원금회수 전략', '충분히 오른 종목에서 원금만큼만 팔아 현금으로 돌리고, 남은 주식은 그대로 두는 방법입니다. 매입금액이 있는 종목만 계산해요.', `<form class="form calc" data-tool="house">
      <label class="wide">최소 수익률 <b data-range-label>${val(st, 'th', '30')}%</b><input name="th" type="range" min="0" max="200" step="5" value="${val(st, 'th', '30')}"></label>
      <label class="check wide"><input type="checkbox" name="tax" ${chk(st, 'tax')}> 양도세 22%를 뗀 뒤 원금 회수 (단순 가정)</label>
      <output class="wide plain">${out('house')}</output></form>
      <details><summary>📘 전략 설명</summary><ul class="small bullets"><li>매도 주식 수 = 원금 ÷ 현재가 (주 단위로 올림).</li><li>장점: 원금을 이미 돌려받았으니 남은 주식은 값이 떨어져도 원금 손실이 없습니다.</li><li>주의: 세금은 종목·국가·계좌에 따라 다릅니다. 여기 22%는 단순 가정이에요.</li></ul></details>`);
  } else if (tool === 'split') {
    const buy = (st.mode ?? 'buy') === 'buy';
    body = card('🎯 분할 전략', '한 번에 다 사거나 팔지 않고 여러 번에 나누는 계획을 세워 봅니다.', `<form class="form calc" data-tool="split">
      <label class="wide">종목<input name="name" data-ticker autocomplete="off" placeholder="종목 이름·코드로 찾기" value="${val(st, 'name')}"></label>
      <label>방향<select name="mode">${sel(st, 'mode', [['buy', '매수 (싸게 모으기)'], ['sell', '매도 (나눠서 익절)']], 'buy')}</select></label>
      <label>전략<select name="strat">${buy ? sel(st, 'strat', [['dca', '📅 정액 분할매수 (DCA)'], ['va', '📊 목표 잔고 따라가기 (Value Averaging)'], ['grid', '🪜 가격 구간별 매수 (Grid)']], 'dca') : sel(st, 'strat', [['ladder', '🪜 가격 구간별 분할 매도']], 'ladder')}</select></label>
      ${buy ? `<label>총 투자금(만원)<input name="total" type="number" step="any" min="0" inputmode="decimal" value="${val(st, 'total')}"></label>` : ''}
      <label>분할 횟수<input name="n" type="number" step="1" min="1" max="24" inputmode="numeric" value="${val(st, 'n', '5')}"></label>
      ${buy && (st.strat ?? 'dca') !== 'grid' ? `<label>주기<select name="period">${sel(st, 'period', [['5', '매주'], ['10', '2주마다'], ['21', '매월']], '21')}</select></label>` : `<label>구간 간격(%)<input name="step" type="number" step="any" min="0.5" inputmode="decimal" value="${val(st, 'step', '5')}"></label>`}
      <output class="wide plain" data-async>${out('split')}</output></form>`);
  } else if (tool === 'compare') body = card('📊 수익률 비교', '자산 추이 기록과 같은 기간의 시장 지수를 나란히 봅니다.', calc('compare', st, ui));
  else if (tool === 'hist') body = card('📈 자산 추이 기록', '날마다 자동으로 남긴 기록입니다. 잘못 남은 날은 지울 수 있어요.', calc('hist', st, ui), '<button class="btn sm ghost" data-act="snap-now">📸 지금 기록</button>');
  else if (tool === 'divs') body = card('💸 배당', '예상액은 지난 1년 지급된 주당 배당·분배금 × 지금 수량 (세전). 실제로 받은 배당은 직접 등록해요.', calc('divs', st, ui), '<button class="btn sm primary" data-act="add-payout">＋ 배당 등록</button>');
  else if (tool === 'tech') body = card('📐 보유 종목 위치', '200일선·52주 범위에서 지금 어디쯤인지', calc('tech', st, ui));
  else if (tool === 'avg') {
    body = card('➗ 물타기 평단', '더 샀을 때 평균 단가가 어떻게 바뀌는지', `<form class="form calc" data-tool="avg">
      <label>보유 수량<input name="q0" type="number" step="any" inputmode="decimal" value="${val(st, 'q0')}"></label><label>평단<input name="p0" type="number" step="any" inputmode="decimal" value="${val(st, 'p0')}"></label>
      <label>추가 수량<input name="q1" type="number" step="any" inputmode="decimal" value="${val(st, 'q1')}"></label><label>추가 단가<input name="p1" type="number" step="any" inputmode="decimal" value="${val(st, 'p1')}"></label>
      <output class="wide">${out('avg')}</output></form>`);
  } else if (tool === 'tax') {
    const usPl = all.pos.filter((p) => p.cur === 'USD' && p.pl != null).reduce((a, p) => a + p.pl, 0);
    body = card('🧾 양도소득세 어림', '기본공제 250만 원을 빼고 정해진 세율을 곱하는 단순 가정으로 계산합니다.', `<form class="form calc" data-tool="tax">
      <label class="wide">시장<select name="market">${sel(st, 'market', [['us', '해외주식 — 22%'], ['kr', '국내 대주주 — 3억 원까지 22%, 넘는 부분 27.5%']], 'us')}</select></label>
      <label class="wide">올해 양도차익(원) <small>판 금액 − 산 금액, 손실 난 종목과 합산</small><input name="gain" type="number" step="any" inputmode="numeric" value="${val(st, 'gain')}"></label>
      <div class="row wide"><span class="small muted">채우기</span><button type="button" class="btn sm ghost" data-act="tax-fill" data-v="${Math.round(usPl)}">지금 미국 종목을 다 판다면 (${won(usPl)})</button></div>
      <output class="wide">${out('tax')}</output></form>
      <p class="small muted">실제 세액은 환율 적용 방식, 손익 통산, 계좌 종류(ISA·연금 등)에 따라 달라집니다. 신고 전에 증권사 자료나 전문가에게 확인하세요.</p>`);
  }
  return `${chips}${body}`;
}

// ───────────────────────── 계산
function fvSeries(pv, pmt, rate, years) {
  const n = Math.round(years * 12), i = rate / 12, rows = [];
  let bal = pv;
  for (let m = 1; m <= n; m++) { bal = bal * (1 + i) + pmt; if (m % 12 === 0 || m === n) rows.push({ year: m / 12, paid: pv + pmt * m, bal }); }
  return { fv: bal, paid: pv + pmt * n, rows };
}
const eok = (manwon) => won(manwon * 1e4);

export function calc(tool, f, ui) {
  const all = summary();
  if (tool === 'sim') {
    const name = (f.name || '').trim(), q = quote(name), qty = N(f.qty);
    if (!q) return name ? '상장 종목에서 찾을 수 없는 이름이에요. 목록에서 골라 주세요.' : '종목과 수량을 넣으면 지금 가격으로 샀을(팔았을) 때 비중이 어떻게 바뀌는지 보여 줘요.';
    if (!(qty > 0)) return '수량을 넣어 주세요.';
    const sign = f.side === 'sell' ? -1 : 1, amt = qty * q.krw;
    const cur = byName(all.pos).find((g) => g.name === name)?.value || 0;
    const sec = sectorOf(name);
    const secCur = all.pos.filter((p) => p.sector === sec).reduce((a, p) => a + p.value, 0);
    const st = all.byCat.stock, st2 = Math.max(0, st + sign * amt);
    if (sign < 0 && amt > cur + 1) return `보유 평가액(${won(cur)})보다 많이 팔 수는 없어요.`;
    return `${sign > 0 ? '매수' : '매도'} 금액 <b>${won(amt)}</b> (${px(q)} × ${num(qty, 4)}주)<br>
      종목 비중 ${p1(st ? cur / st : 0)} → <b>${p1(st2 ? (cur + sign * amt) / st2 : 0)}</b> · ${esc(sec)} 업종 ${p1(st ? secCur / st : 0)} → <b>${p1(st2 ? (secCur + sign * amt) / st2 : 0)}</b><br>
      주식 비중 ${p1(all.total ? st / all.total : 0)} → <b>${p1(all.total ? st2 / all.total : 0)}</b> <span class="muted">(예수금으로 사고판다고 보고 총자산은 그대로)</span>`;
  }

  if (tool === 'fv') {
    const mode = f.mode || 'fv';
    let pv = N(f.pv) || 0, pmt = N(f.pmt) || 0, r = N(f.r), y = N(f.y);
    const target = N(f.target), k = f.tax ? 1 - TAX : 1;
    const need = (cond, msg) => (cond ? null : msg);
    let solved = '';
    if (mode === 'fv') { const e = need(r >= 0 && y > 0, '연 수익률과 기간을 넣어 주세요.'); if (e) return e; }
    if (mode === 'pmt') {
      const e = need(target > 0 && r >= 0 && y > 0, '목표 금액 · 연 수익률 · 기간을 넣어 주세요.'); if (e) return e;
      const n = Math.round(y * 12), i = (r / 100) * k / 12, g = (1 + i) ** n;
      pmt = Math.max(0, i ? (target - pv * g) * i / (g - 1) : (target - pv) / n);
      solved = `매달 <b>${eok(pmt)}</b>씩 넣으면 ${y}년 뒤 목표 ${eok(target)}에 닿아요.`;
    }
    if (mode === 'years') {
      const e = need(target > 0 && r >= 0 && (pmt > 0 || pv > 0), '목표 금액 · 연 수익률과, 초기 투자금이나 월 투자금을 넣어 주세요.'); if (e) return e;
      const i = (r / 100) * k / 12; let bal = pv, m = 0;
      while (bal < target && m < 1200) { bal = bal * (1 + i) + pmt; m++; }
      if (m >= 1200) return '이 조건으로는 100년 안에 목표에 닿지 않아요.';
      y = m / 12; solved = `목표 ${eok(target)}까지 <b>${Math.floor(m / 12)}년 ${m % 12}개월</b> 걸려요.`;
    }
    if (mode === 'rate') {
      const e = need(target > 0 && y > 0, '목표 금액과 기간을 넣어 주세요.'); if (e) return e;
      if (pv + pmt * y * 12 >= target) { r = 0; solved = '수익이 없어도 넣는 돈만으로 목표에 닿아요.'; } else {
        let lo = 0, hi = 1;
        for (let t = 0; t < 60; t++) { const mid = (lo + hi) / 2; if (fvSeries(pv, pmt, mid * k, y).fv >= target) hi = mid; else lo = mid; }
        if (hi > 0.99) return '연 100%로도 닿지 않는 목표예요. 기간이나 투자금을 늘려 보세요.';
        r = hi * 100; solved = `목표 ${eok(target)}까지 연 <b>${r.toFixed(2)}%</b>가 필요해요.`;
      }
    }
    const main = fvSeries(pv, pmt, (r / 100) * k, y);
    const scen = [['보수', r - 4], ['기본', r], ['낙관', r + 4]].map(([l, rr]) => `<div><span>${l} (${Math.max(0, rr).toFixed(1)}%)</span><b>${eok(fvSeries(pv, pmt, (Math.max(0, rr) / 100) * k, y).fv)}</b></div>`).join('');
    const real = f.infl ? main.fv / (1 + INFL) ** y : null;
    const rows = main.rows.filter((x, i, a) => a.length <= 12 || Number.isInteger(x.year) && (x.year <= 10 || x.year % 5 === 0) || i === a.length - 1);
    return `${solved ? `<p>${solved}</p>` : ''}
      <div class="tiles flat"><div><span>총 투자결과</span><b>${eok(main.fv)}</b>${real != null ? `<em>물가 반영 ${eok(real)}</em>` : ''}</div><div><span>총 투자원금</span><b>${eok(main.paid)}</b></div><div><span>총 수익률</span><b>${main.paid ? `${((main.fv / main.paid - 1) * 100).toFixed(1)}%` : '—'}</b></div><div><span>불어난 돈</span><b>${eok(main.fv - main.paid)}</b></div></div>
      <div class="tiles flat">${scen}</div>
      ${monthBars(main.rows.filter((x) => Number.isInteger(x.year)).map((x) => ({ label: `${x.year}`, value: x.bal, tip: `<b>${x.year}년 차</b><br>잔고 ${eok(x.bal)}<br>원금 ${eok(x.paid)}` })))}
      <div class="scroll"><table><thead><tr><th>년차</th><th>투자원금</th><th>불어난 돈</th><th>투자결과</th></tr></thead><tbody>${rows.map((x) => `<tr><td>${Number.isInteger(x.year) ? x.year : x.year.toFixed(1)}</td><td>${eok(x.paid)}</td><td>${eok(x.bal - x.paid)}</td><td>${eok(x.bal)}</td></tr>`).join('')}</tbody></table></div>
      <div class="row"><button type="button" class="btn sm ghost" data-act="fv-goal" data-v="${Math.round(main.fv * 1e4)}">🎯 이 결과를 가족 목표로 저장</button></div>
      <p class="small muted">매달 말에 넣고 달마다 (연 수익률 ÷ 12) 이자가 붙는 월복리 가정. 수익률이 매년 같다고 본 단순 계산이라 실제와 다릅니다.</p>`;
  }

  if (tool === 'rebal') {
    const sum = CATS.reduce((a, c) => a + (N(f[c.key]) || 0), 0);
    if (!sum) return '목표 비중(%)을 적어 보세요. 합이 100%가 되게 맞추면 됩니다.';
    const rows = CATS.filter((c) => (N(f[c.key]) || 0) > 0 || all.byCat[c.key] > 0).map((c) => {
      const t = (N(f[c.key]) || 0) / 100, cur = all.byCat[c.key] || 0, goal = all.total * t, d = goal - cur;
      return `<tr><td>${c.emoji} ${c.label}</td><td>${p1(all.total ? cur / all.total : 0)} → ${p1(t)}</td><td>${won(goal)}</td><td>${Math.abs(d) < 1 ? '—' : d > 0 ? `<span class="up">⬆ 부족 ${won(d)}</span>` : `<span class="down">⬇ 초과 ${won(-d)}</span>`}</td></tr>`;
    }).join('');
    return `<p>목표 합계 <b class="${Math.abs(sum - 100) < 0.05 ? 'good' : 'up'}">${sum.toFixed(1)}%</b>${Math.abs(sum - 100) < 0.05 ? '' : ' — 100%가 되게 맞춰 주세요.'}</p>
      <div class="scroll"><table><thead><tr><th>종류</th><th>비중</th><th>목표 금액</th><th>차이</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  }

  if (tool === 'house') {
    const th = (N(f.th) || 0) / 100;
    const list = byName(all.pos).filter((g) => g.pl != null && g.q && g.qty > 0 && g.plPct >= th && g.plPct > 0).map((g) => {
      const price = g.value / g.qty, avg = g.cost / g.qty;
      const net = f.tax ? price - TAX * (price - avg) : price;
      const k = Math.min(g.qty, Math.ceil(g.cost / net));
      return { ...g, k, back: k * net, left: g.qty - k, leftValue: (g.qty - k) * price };
    }).filter((g) => g.left > 0).sort((a, b) => b.plPct - a.plPct);
    if (!list.length) return `수익률 ${Math.round(th * 100)}% 이상인 종목이 없어요. 슬라이더를 낮추면 더 많은 종목이 보입니다.`;
    return `<ul class="list">${list.map((g) => `<li><span>${esc(g.name)}<small>수익률 ${(g.plPct * 100).toFixed(1)}% · 매입 ${won(g.cost)} · ${num(g.qty, 4)}주</small></span><b>${num(g.k)}주 매도 → ${won(g.back)}<small>남는 ${num(g.left, 4)}주 · ${won(g.leftValue)}</small></b></li>`).join('')}</ul>`;
  }

  if (tool === 'split') {
    const name = (f.name || '').trim(), q = quote(name), n = Math.max(1, Math.min(24, Math.round(N(f.n) || 0)));
    if (!q) return name ? '상장 종목에서 찾을 수 없는 이름이에요. 목록에서 골라 주세요.' : '종목을 고르면 계획표가 나와요.';
    const mode = f.mode || 'buy', cur = (v) => money(v, q.cur);
    if (mode === 'buy') {
      const total = (N(f.total) || 0) * 1e4;
      if (!(total > 0)) return '총 투자금을 넣어 주세요.';
      const each = total / n;
      if ((f.strat || 'dca') === 'grid') {
        const step = (N(f.step) || 5) / 100;
        let qtySum = 0, spent = 0;
        const rows = Array.from({ length: n }, (_, i) => { const p = q.krw * (1 - step * (i + 1)); const k = Math.floor(each / p); qtySum += k; spent += k * p; return `<tr><td>${i + 1}단 (−${((i + 1) * step * 100).toFixed(0)}%)</td><td>${cur(q.raw * (1 - step * (i + 1)))}</td><td>${num(k)}주</td><td>${won(k * p)}</td></tr>`; }).join('');
        return `<p>지금 ${px(q)}에서 ${(step * 100).toFixed(1)}%씩 내려갈 때마다 <b>${won(each)}</b>어치를 삽니다.</p>
          <div class="scroll"><table><thead><tr><th>단</th><th>매수 가격</th><th>수량</th><th>금액</th></tr></thead><tbody>${rows}</tbody></table></div>
          <p class="small">전부 체결되면 ${num(qtySum)}주 · ${won(spent)} · 평단 ${qtySum ? `${won(spent / qtySum)} (지금보다 ${(((spent / qtySum) / q.krw - 1) * 100).toFixed(1)}%)` : '—'}</p>`;
      }
      const period = N(f.period) || 21;
      const when = { 5: '매주', 10: '2주마다', 21: '매월' }[period];
      if (f.strat === 'va') {
        const planVa = `<p>${when} 잔고 목표를 <b>${won(each)}</b>씩 올리고, 그때 평가액이 목표보다 모자란 만큼만 삽니다. 값이 내렸으면 더 많이, 올랐으면 덜 사게 돼요. (목표를 넘었을 때는 사지 않고 쉽니다.)</p>`;
        if (!q.full) return `${planVa}<p class="small muted">이 종목은 일봉 자료가 없어서 과거 검증은 못 해요.</p>`;
        return loadHistory(q.key).then((h) => {
          if (!h || h.c.length < period * n + 1) return `${planVa}<p class="small muted">과거 검증을 하기엔 받아 둔 일봉(${h ? h.c.length : 0}일)이 모자라요. 횟수나 주기를 줄여 보세요.</p>`;
          const start = h.c.length - 1 - period * n, step = total / q.fx / n;
          let shares = 0, spent = 0;
          const rows = [];
          for (let i = 0; i < n; i++) { const p = h.c[start + period * i]; const buyAmt = Math.max(0, step * (i + 1) - shares * p); shares += buyAmt / p; spent += buyAmt; rows.push(`<tr><td>${i + 1}회</td><td>${cur(p)}</td><td>${cur(step * (i + 1))}</td><td>${cur(buyAmt)}</td></tr>`); }
          const last = h.c[h.c.length - 1], value = shares * last;
          return `${planVa}<h4>과거 가격으로 검증 <span class="muted small">${new Date(h.t[start] * 86400000).toISOString().slice(0, 10)}부터</span></h4>
            <div class="scroll"><table><thead><tr><th>회차</th><th>그날 가격</th><th>목표 잔고</th><th>산 금액</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
            <div class="tiles flat"><div><span>실제로 넣은 돈</span><b>${cur(spent)}</b></div><div><span>지금 평가액</span><b>${cur(value)}</b></div><div><span>수익률</span><b>${spent ? `${((value / spent - 1) * 100).toFixed(1)}%` : '—'}</b><em>평단 ${shares ? cur(spent / shares) : '—'}</em></div></div>
            <p class="small muted">지난 일이 앞으로도 되풀이된다는 뜻은 아니에요.</p>`;
        });
      }
      const plan = `<p><b>${won(each)}</b>씩 ${n}번(${when}) 삽니다. 지금 가격이면 한 번에 약 ${num(each / q.krw, 2)}주.</p>`;
      if (!q.full) return `${plan}<p class="small muted">이 종목은 일봉 자료가 없어서 과거 검증은 못 해요.</p>`;
      return loadHistory(q.key).then((h) => {
        if (!h || h.c.length < period * n + 1) return `${plan}<p class="small muted">과거 검증을 하기엔 받아 둔 일봉(${h ? h.c.length : 0}일)이 모자라요. 횟수나 주기를 줄여 보세요.</p>`;
        // 일봉은 그 종목의 통화(원 또는 달러)라서 예산도 같은 통화로 맞춘다(환율 변화는 빼고 본다)
        const start = h.c.length - 1 - period * n, budget = total / q.fx;
        let shares = 0;
        for (let i = 0; i < n; i++) shares += (budget / n) / h.c[start + period * i];
        const last = h.c[h.c.length - 1], dca = shares * last, lump = (budget / h.c[start]) * last;
        const d0 = new Date(h.t[start] * 86400000).toISOString().slice(0, 10);
        return `${plan}<h4>과거 가격으로 검증 <span class="muted small">${d0}부터 같은 방식으로 샀다면</span></h4>
          <div class="tiles flat"><div><span>나눠 샀을 때</span><b>${((dca / budget - 1) * 100).toFixed(1)}%</b><em>평단 ${cur(budget / shares)}</em></div><div><span>첫날 한 번에 샀을 때</span><b>${((lump / budget - 1) * 100).toFixed(1)}%</b><em>그날 가격 ${cur(h.c[start])}</em></div></div>
          <p class="small muted">지난 일이 앞으로도 되풀이된다는 뜻은 아니에요.</p>`;
      });
    }
    const g = byName(all.pos).find((x) => x.name === name);
    if (!g || !g.qty) return '보유하고 있는 종목만 분할 매도 계획을 세울 수 있어요.';
    const step = (N(f.step) || 5) / 100, per = Math.floor(g.qty / n) || 0;
    if (!per) return `보유 수량(${num(g.qty, 4)}주)이 ${n}번으로 나누기에 적어요. 횟수를 줄여 보세요.`;
    let got = 0;
    const rows = Array.from({ length: n }, (_, i) => { const k = i === n - 1 ? g.qty - per * (n - 1) : per; const p = q.krw * (1 + step * (i + 1)); got += k * p; return `<tr><td>${i + 1}단 (+${((i + 1) * step * 100).toFixed(0)}%)</td><td>${cur(q.raw * (1 + step * (i + 1)))}</td><td>${num(k, 4)}주</td><td>${won(k * p)}</td></tr>`; }).join('');
    return `<p>지금 ${px(q)}에서 ${(step * 100).toFixed(1)}%씩 오를 때마다 나눠 팝니다. 보유 ${num(g.qty, 4)}주.</p>
      <div class="scroll"><table><thead><tr><th>단</th><th>매도 가격</th><th>수량</th><th>금액</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="small">전부 체결되면 ${won(got)}${g.cost ? ` · 매입 ${won(g.cost)} 대비 ${(((got / g.cost) - 1) * 100).toFixed(1)}%` : ''}</p>`;
  }

  if (tool === 'compare') {
    const h = S.history;
    if (h.length < 2) return empty('자산 추이 기록이 이틀 치 이상 쌓이면 시장과 비교할 수 있어요.');
    const idx = PX.data?.indices || {};
    const dayNo = (d) => Math.floor(Date.parse(d) / 86400000);
    const idxAt = (k, d) => { const x = idx[k]; if (!x?.t) return null; let v = null; for (let i = 0; i < x.t.length; i++) if (x.t[i] <= dayNo(d)) v = x.spark[i]; return v; };
    const last = h[h.length - 1];
    const periods = [['첫 기록부터', h[0]], ['최근 30일', h.find((x) => dayNo(x.date) >= dayNo(last.date) - 30)], ['최근 7일', h.find((x) => dayNo(x.date) >= dayNo(last.date) - 7)]].filter(([, s]) => s && s.id !== last.id);
    const cell = (a, b) => (a && b ? chg((b / a - 1) * 100) : '—');
    return `<div class="scroll"><table><thead><tr><th>기간</th><th>가족 총자산</th><th>주식만</th><th>코스피</th><th>S&P 500</th><th>나스닥</th></tr></thead><tbody>
      ${periods.map(([l, s]) => `<tr><td>${l}<small>${s.date} → ${last.date}</small></td><td>${cell(s.total, last.total)}</td><td>${cell(s.stock, last.stock)}</td>${['KOSPI', 'SP500', 'NASDAQ'].map((k) => `<td>${cell(idxAt(k, s.date), idx[k]?.last)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="small muted">가족 자산의 변화에는 새로 넣은 돈과 뺀 돈이 섞여 있어서 순수한 수익률과는 달라요. 시장 지수는 최근 60거래일까지만 비교됩니다.</p>`;
  }

  if (tool === 'hist') {
    const h = [...S.history].reverse();
    if (!h.length) return empty('아직 기록이 없어요. 앱을 여는 날마다 자동으로 남습니다.');
    return `<div class="scroll"><table><thead><tr><th>날짜</th><th>총자산</th><th>전 기록 대비</th>${S.members.length > 1 ? S.members.map((m) => `<th>${m.emoji} ${esc(m.name)}</th>`).join('') : ''}<th></th></tr></thead><tbody>
      ${h.map((x, i) => { const prev = h[i + 1]; return `<tr><td>${x.date}</td><td>${won(x.total)}</td><td>${prev ? delta(x.total - prev.total, prev.total ? (x.total - prev.total) / prev.total : null) : '—'}</td>${S.members.length > 1 ? S.members.map((m) => `<td>${x.byMember?.[m.id] != null ? won(x.byMember[m.id]) : '—'}</td>`).join('') : ''}<td><button class="mini" data-act="del-history" data-v="${x.id}" aria-label="${x.date} 기록 지우기">✕</button></td></tr>`; }).join('')}</tbody></table></div>`;
  }

  if (tool === 'divs') {
    const dv = dividends(all.pos);
    const groups = new Map(byName(all.pos).map((g) => [g.name, g]));
    const pay = [...S.payouts].sort((a, b) => b.date.localeCompare(a.date));
    const paid = pay.filter((x) => x.status !== 'due').reduce((a, x) => a + x.amount, 0), due = pay.filter((x) => x.status === 'due').reduce((a, x) => a + x.amount, 0);
    const mem = (id) => S.members.find((m) => m.id === id);
    return `<div class="tiles flat"><div class="warm"><span>예상 연배당</span><b>${won(dv.total)}</b><em>월 평균 ${won(dv.total / 12)}</em></div><div><span>총 실수령</span><b>${won(paid)}</b><em>등록한 배당 합계</em></div><div><span>지급 예정</span><b>${won(due)}</b></div></div>
      <h4>배당금 내역 <span class="muted small">${pay.length}건</span></h4>
      ${pay.length ? `<ul class="list">${pay.map((x) => `<li><button class="lrow" data-act="edit-payout" data-v="${x.id}"><span class="tag ${x.status === 'due' ? 'out' : 'in'}">${x.status === 'due' ? '예정' : '완료'}</span><span>${esc(x.name)}<small>${x.date} · ${esc(mem(x.memberId)?.name || '')}${x.memo ? ` · ${esc(x.memo)}` : ''}</small></span><b>${won(x.amount)}</b></button></li>`).join('')}</ul>` : empty('등록된 배당 기록이 없어요.')}
      <h4>종목별 예상</h4>
      ${dv.total ? `<div class="scroll"><table><thead><tr><th>종목</th><th>수량</th><th>주당 배당</th><th>배당률</th><th>연 예상</th></tr></thead><tbody>
      ${dv.rows.map((r) => { const g = groups.get(r.name); return `<tr><td>${esc(r.name)}</td><td>${num(g.qty, 4)}</td><td>${money(g.q.div, g.q.cur)}</td><td>${p1(r.yield)}</td><td>${won(r.amount)}</td></tr>`; }).join('')}</tbody></table></div>` : empty('배당 자료가 있는 보유 종목이 없어요.')}`;
  }

  if (tool === 'tech') {
    const tech = byName(all.pos).sort((a, b) => b.value - a.value).filter((g) => g.q?.ma200).map((g) => ({ ...g, d200: g.q.raw / g.q.ma200 - 1, r52: pos52(g.q) }));
    if (!tech.length) return empty('보유 종목의 일봉 자료가 없어요.');
    return `<div class="scroll"><table><thead><tr><th>종목</th><th>200일선 대비</th><th>200일선 기울기</th><th>52주 범위</th><th>배당률</th></tr></thead><tbody>
      ${tech.map((g) => `<tr><td><button class="link" data-act="open-stock" data-v="${esc(g.name)}">${esc(g.name)}</button></td><td>${chg(g.d200 * 100)}</td><td>${g.q.ma200slope != null ? chg(g.q.ma200slope * 100) : '—'}</td><td>${g.r52 != null ? `${Math.round(g.r52 * 100)}%` : '—'}</td><td>${g.q.div ? p1(g.q.div / g.q.raw) : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="small muted">52주 범위: 0%는 1년 최저가, 100%는 최고가. 기울기는 200일선의 최근 20거래일 변화.</p>`;
  }

  if (tool === 'avg') {
    const q0 = N(f.q0), p0 = N(f.p0), q1 = N(f.q1), p1v = N(f.p1), qn = q0 + q1;
    if (!(qn > 0) || [p0, p1v].some(Number.isNaN)) return '네 칸을 채우면 새 평단이 나와요.';
    const avg = (q0 * p0 + q1 * p1v) / qn;
    return `새 평단 <b>${num(avg, 2)}</b> · 수량 ${num(qn, 4)} · 평단 변화 ${(((avg / p0) - 1) * 100).toFixed(1)}% · 추가 금액 ${num(q1 * p1v)}`;
  }

  if (tool === 'tax') {
    const gain = N(f.gain);
    if (Number.isNaN(gain)) return '양도차익을 넣거나, 위 버튼으로 지금 평가손익을 채워 보세요.';
    const base = Math.max(0, gain - 2500000);
    const tax = f.market === 'kr' ? Math.min(base, 3e8) * 0.22 + Math.max(0, base - 3e8) * 0.275 : base * TAX;
    return `과세 대상 <b>${won(base)}</b> <span class="muted">(양도차익 ${won(gain)} − 기본공제 ${won(2500000)})</span><br>어림한 세금 <b>${won(tax)}</b> · 세금 뒤 남는 차익 ${won(gain - tax)}`;
  }
  return '';
}
