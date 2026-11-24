// 그래프: 구성 막대, 자산 추이 선, 종목 차트, 작은 추이선, 월별 막대. 라이브러리 없이 직접 그린다.
import { esc, man, won, p1, md, showTip, hideTip } from './ui.js';

// 구성 막대 — segs: [{label, value, cls}]  색은 cls(CSS 변수)로 준다. 이름은 아래 범례가 맡는다.
export function stackBar(segs) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  const parts = segs.filter((s) => s.value > 0).map((s) => {
    const share = s.value / total;
    return `<i class="${s.cls}" style="flex:${share.toFixed(4)}" data-tip="${esc(`<b>${esc(s.label)}</b><br>${won(s.value)} · ${p1(share)}`)}"></i>`;
  });
  return `<div class="stack" role="img" aria-label="${esc(segs.filter((s) => s.value > 0).map((s) => `${s.label} ${p1(s.value / total)}`).join(', '))}">${parts.join('')}</div>`;
}

export function legend(segs) {
  const total = segs.reduce((a, s) => a + s.value, 0) || 1;
  return `<ul class="legend">${segs.filter((s) => s.value > 0).map((s) => `<li><i class="chip ${s.cls}"></i><span>${s.emoji ? `${s.emoji} ` : ''}${esc(s.label)}</span><b>${won(s.value)}</b><em>${p1(s.value / total)}</em></li>`).join('')}</ul>`;
}

// 작은 추이선(축 없음)
export function sparkline(vals, w = 96, h = 28) {
  if (!vals || vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const pts = vals.map((v, i) => `${((i / (vals.length - 1)) * (w - 4) + 2).toFixed(1)},${(h - 3 - ((v - lo) / span) * (h - 6)).toFixed(1)}`).join(' ');
  return `<svg class="spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}"/></svg>`;
}

// 월별 막대 — rows: [{label, value, tip}]  0 을 기준으로 위(넣은 달)·아래(뺀 달)
export function monthBars(rows) {
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const neg = rows.some((r) => r.value < 0);
  return `<div class="mbars${neg ? ' both' : ''}" role="img" aria-label="${esc(rows.map((r) => `${r.label} ${man(r.value)}`).join(', '))}">${rows.map((r) => {
    const h = Math.max(2, (Math.abs(r.value) / max) * 100);
    return `<div class="mcol" data-tip="${esc(r.tip)}"><div class="mplot"><i class="${r.value < 0 ? 'neg' : 'pos'}" style="height:${h.toFixed(1)}%"></i></div><span>${esc(r.label)}</span></div>`;
  }).join('')}</div>`;
}

const dstr = (d) => new Date(d * 86400000).toISOString().slice(0, 10);

// 종목 차트 — hist: {cur, t:[일수], c:[종가], m:[200일선|null]}  days: 보여 줄 거래일 수
export function drawPrice(el, hist, days = 200) {
  if (!el) return;
  if (!hist || !hist.c || hist.c.length < 2) { el.innerHTML = '<p class="muted small">차트 자료를 받지 못했어요.</p>'; return; }
  const W = Math.max(260, el.clientWidth), H = 210;
  const pad = { l: 56, r: 10, t: 12, b: 22 };
  const c = hist.c.slice(-days), m = hist.m.slice(-days), t = hist.t.slice(-days);
  const n = c.length;
  const all = c.concat(m.filter((v) => v != null));
  let lo = Math.min(...all), hi = Math.max(...all);
  const span = hi - lo || hi * 0.02 || 1;
  lo -= span * 0.06; hi += span * 0.06;
  const x = (i) => pad.l + (W - pad.l - pad.r) * (i / (n - 1));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const fmt = (v) => (hist.cur === 'KRW' ? Math.round(v).toLocaleString('ko-KR') : v.toFixed(v >= 1000 ? 0 : 2));

  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const grid = ticks.map((v) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tick" x="${pad.l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${fmt(v)}</text>`).join('');
  const line = (arr) => {
    let d = '', pen = false;
    arr.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)} `; pen = true; });
    return d;
  };
  const xl = [[0, 'start'], [n - 1, 'end']].map(([i, a]) => `<text class="tick" x="${x(i).toFixed(1)}" y="${H - 6}" text-anchor="${a}">${dstr(t[i]).slice(2).replace(/-/g, '.')}</text>`).join('');

  el.innerHTML = `<svg class="line" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="최근 ${n}거래일 종가와 200일선">
    ${grid}<path class="ref" d="${line(m)}"/><path class="series c1" d="${line(c)}"/>${xl}
    <line class="cross" y1="${pad.t}" y2="${H - pad.b}" hidden/><circle class="focus c1" r="5" hidden/>
    <rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>
  </svg>
  <ul class="keys"><li><i class="key c1"></i>종가</li><li><i class="key ref"></i>200일선</li></ul>`;

  const svg = el.firstElementChild, cross = svg.querySelector('.cross'), focus = svg.querySelector('.focus');
  const move = (e) => {
    const box = svg.getBoundingClientRect();
    const i = Math.max(0, Math.min(n - 1, Math.round(((e.clientX - box.left - pad.l) / (W - pad.l - pad.r)) * (n - 1))));
    cross.removeAttribute('hidden'); focus.removeAttribute('hidden');
    cross.setAttribute('x1', x(i)); cross.setAttribute('x2', x(i));
    focus.setAttribute('cx', x(i)); focus.setAttribute('cy', y(c[i]));
    showTip(`<b>${dstr(t[i])}</b><br>종가 ${fmt(c[i])}${m[i] != null ? `<br><span class="muted">200일선 ${fmt(m[i])} (${((c[i] / m[i] - 1) * 100).toFixed(1)}%)</span>` : ''}`, e.clientX, e.clientY);
  };
  const leave = () => { cross.setAttribute('hidden', ''); focus.setAttribute('hidden', ''); hideTip(); };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', leave);
}

// 자산 추이 선 — series: [{label, cls, pts:[{date, v}]}]  (같은 날짜 축을 쓴다)
export function drawTrend(el, series) {
  if (!el) return;
  const dates = [...new Set(series.flatMap((s) => s.pts.map((p) => p.date)))].sort();
  if (dates.length < 2) {
    el.innerHTML = '<p class="muted small">기록이 이틀 치 이상 쌓이면 그래프가 그려져요. 앱을 여는 날마다 자동으로 남깁니다.</p>';
    return;
  }
  const W = Math.max(280, el.clientWidth), H = 200;
  const pad = { l: 58, r: 14, t: 14, b: 24 };
  const t = dates.map((d) => Date.parse(d));
  const t0 = t[0], t1 = t[t.length - 1];
  const vals = series.flatMap((s) => s.pts.map((p) => p.v));
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || hi * 0.02 || 1;
  lo -= span * 0.15; hi += span * 0.15;
  const x = (d) => pad.l + (W - pad.l - pad.r) * ((Date.parse(d) - t0) / (t1 - t0 || 1));
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - (v - lo) / (hi - lo));
  const short = (v) => (Math.abs(v) >= 1e8 ? `${(v / 1e8).toFixed(2)}억` : man(v));

  const ticks = [0, 1, 2, 3].map((i) => lo + ((hi - lo) * i) / 3);
  const grid = ticks.map((v) => `<line class="grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="tick" x="${pad.l - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${short(v)}</text>`).join('');
  const paths = series.map((s) => `<path class="series ${s.cls}" d="${s.pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}"/>${
    s.pts.length <= 40 ? s.pts.map((p) => `<circle class="dot ${s.cls}" cx="${x(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5"/>`).join('') : ''}`).join('');
  const xl = [[dates[0], 'start'], [dates[dates.length - 1], 'end']].map(([d, a]) => `<text class="tick" x="${x(d).toFixed(1)}" y="${H - 6}" text-anchor="${a}">${md(d)}</text>`).join('');

  el.innerHTML = `<svg class="line" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="자산 추이 ${dates[0]} ~ ${dates[dates.length - 1]}">
    ${grid}${paths}${xl}<line class="cross" y1="${pad.t}" y2="${H - pad.b}" hidden/>
    <rect class="hit" x="${pad.l}" y="0" width="${W - pad.l - pad.r}" height="${H}" fill="transparent"/>
  </svg>${series.length > 1 ? `<ul class="keys">${series.map((s) => `<li><i class="key ${s.cls}"></i>${esc(s.label)}</li>`).join('')}</ul>` : ''}`;

  const svg = el.firstElementChild, cross = svg.querySelector('.cross');
  const move = (e) => {
    const box = svg.getBoundingClientRect();
    const pxl = e.clientX - box.left;
    let best = dates[0];
    for (const d of dates) if (Math.abs(x(d) - pxl) < Math.abs(x(best) - pxl)) best = d;
    cross.removeAttribute('hidden');
    cross.setAttribute('x1', x(best)); cross.setAttribute('x2', x(best));
    const rows = series.map((s) => { const p = s.pts.find((q) => q.date === best); return p ? `${series.length > 1 ? `${esc(s.label)} ` : ''}${won(p.v)}` : ''; }).filter(Boolean);
    showTip(`<b>${best}</b><br>${rows.join('<br>')}`, e.clientX, e.clientY);
  };
  const leave = () => { cross.setAttribute('hidden', ''); hideTip(); };
  svg.addEventListener('pointermove', move);
  svg.addEventListener('pointerdown', move);
  svg.addEventListener('pointerleave', leave);
}
