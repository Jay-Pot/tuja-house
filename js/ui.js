// 화면 공통 도구: 글자 다듬기, 숫자 표기, 말풍선, 알림, 대화상자
import { D, fxUSD } from './store.js';

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DOTS = '•••••';
// ₩47,652,239 — 금액 가리기를 켜면 점으로 바꾼다
// 달러로 보기를 켜면 지금 환율로 나눠 $ 로 보여 준다
export const won = (v) => {
  const usd = D.usd && fxUSD();
  if (D.hide) return `${usd ? '$' : '₩'}${DOTS}`;
  const n = Math.round(usd ? (v || 0) / fxUSD() : (v || 0));
  return `${n < 0 ? '−' : ''}${usd ? '$' : '₩'}${Math.abs(n).toLocaleString(usd ? 'en-US' : 'ko-KR')}`;
};
// 1억 3,090만 (그래프 눈금처럼 좁은 자리용)
export function man(v) {
  if (D.hide) return DOTS;
  const m = Math.round((v || 0) / 1e4);
  const a = Math.abs(m), e = Math.trunc(a / 10000), r = a % 10000;
  const body = e ? `${e}억${r ? ` ${r.toLocaleString('ko-KR')}만` : ''}` : `${a.toLocaleString('ko-KR')}만`;
  return (m < 0 ? '−' : '') + body;
}
export const num = (v, d = 0) => Number(v || 0).toLocaleString('ko-KR', { maximumFractionDigits: d });
export const qty = (v) => (D.hide ? DOTS : num(v, 4));
export const p1 = (v) => `${((v || 0) * 100).toFixed(1)}%`;
export const md = (d) => (d ? `${+d.slice(5, 7)}/${+d.slice(8, 10)}` : '');
// 종목 가격은 그 종목의 통화로 보여 준다
export const CUR_SYM = { KRW: '₩', USD: '$', JPY: '¥', HKD: 'HK$', CNY: 'CN¥', VND: '₫' };
export const money = (v, cur) => `${CUR_SYM[cur] || ''}${num(v, cur === 'KRW' || cur === 'JPY' || cur === 'VND' ? 0 : 2)}`;
export const px = (q) => (q ? money(q.raw, q.cur) : '—');

// 등락: 우리나라 관례대로 오르면 빨강, 내리면 파랑. 색만으로 구분하지 않게 ▲▼ 를 붙인다.
export function chg(pct) {
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.005) return '<span class="flat">— 0.00%</span>';
  return pct > 0 ? `<span class="up">▲ ${pct.toFixed(2)}%</span>` : `<span class="down">▼ ${Math.abs(pct).toFixed(2)}%</span>`;
}
// 금액 변동(+비율)
export function delta(v, ratio) {
  if (v == null || !Number.isFinite(v)) return '<span class="flat">—</span>';
  const r = ratio != null && Number.isFinite(ratio) ? ` (${ratio >= 0 ? '+' : '−'}${Math.abs(ratio * 100).toFixed(2)}%)` : '';
  if (Math.abs(v) < 0.5) return `<span class="flat">— ${won(0)}${r}</span>`;
  return v > 0 ? `<span class="up">▲ ${won(v)}${r}</span>` : `<span class="down">▼ ${won(-v)}${r}</span>`;
}

// ── 말풍선 ──
const tip = () => $('#tip');
export function showTip(html, x, y) {
  const t = tip();
  t.innerHTML = html;
  t.hidden = false;
  const w = t.offsetWidth, h = t.offsetHeight;
  let left = x + 12, top = y - h - 12;
  if (left + w > innerWidth - 8) left = Math.max(8, x - w - 12);
  if (top < 8) top = y + 16;
  t.style.left = `${left}px`;
  t.style.top = `${top}px`;
}
export function hideTip() { tip().hidden = true; }

export function initTips() {
  const on = (e) => { const el = e.target.closest?.('[data-tip]'); if (el) showTip(el.dataset.tip, e.clientX, e.clientY); };
  document.addEventListener('pointerover', on);
  document.addEventListener('pointermove', on);
  document.addEventListener('pointerout', (e) => { if (e.target.closest?.('[data-tip]')) hideTip(); });
  addEventListener('scroll', hideTip, { passive: true });
}

// ── 알림 ──
let toastTimer;
export function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

// ── 대화상자 ──
export function openDialog(html, cls = '') {
  const d = $('#dlg');
  d.className = cls;
  d.innerHTML = html;
  if (!d.open) d.showModal();
  d.scrollTop = 0;
}
export function closeDialog() {
  const d = $('#dlg');
  if (d.open) d.close();
  d.innerHTML = '';
}

export function download(name, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
