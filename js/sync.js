// 기기 간 자동 동기화 — 내 깃허브의 "비공개" 저장소 안 data.json 한 파일을 여러 기기가 같이 쓴다.
// 서버를 따로 두지 않고 깃허브 API 를 직접 부른다. 필요한 것은 저장소 이름과, 그 저장소만 읽고 쓸 수 있는 토큰.
// 겹쳐 쓰기 방지: 올릴 때 "내가 마지막으로 본 판(sha)"을 같이 보내고, 그 사이 다른 기기가 올렸으면
// 받아서 항목별로 합친 다음 다시 올린다(통째로 덮어쓰지 않는다).
import { S, D, DEMO, merge, canon, replaceState, onChange } from './store.js';

export const SY = { state: 'off', msg: '', at: null, sha: null };
let onUpdate = () => {};
export function onSync(fn) { onUpdate = fn; }
export const syncOn = () => !!(D.repo && D.token);

const url = () => `https://api.github.com/repos/${D.repo}/contents/data.json`;
const enc = (s) => { const b = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(bin); };
const dec = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (c) => c.charCodeAt(0)));

async function gh(method, body) {
  return fetch(url(), {
    method, cache: 'no-store',
    headers: { Authorization: `Bearer ${D.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function fail(status) {
  if (status === 401) return '토큰이 맞지 않거나 만료됐어요.';
  if (status === 403) return '이 토큰으로는 그 저장소에 쓸 수 없어요(권한 확인).';
  if (status === 404) return '저장소를 찾을 수 없어요(이름과 토큰 권한 확인).';
  return `깃허브 응답 ${status}`;
}

function set(state, msg = '') { SY.state = state; SY.msg = msg; if (state === 'ok') SY.at = new Date(); onUpdate(); }

// 받아 오기: 원격 내용과 합친다. 합친 결과가 원격과 다르면 true(올릴 것이 있다).
async function pull() {
  const r = await gh('GET');
  if (r.status === 404) {
    // 파일이 아직 없는 것인지, 저장소 자체가 안 보이는 것인지 구분
    const repo = await fetch(`https://api.github.com/repos/${D.repo}`, { cache: 'no-store', headers: { Authorization: `Bearer ${D.token}`, Accept: 'application/vnd.github+json' } });
    if (!repo.ok) throw new Error(fail(repo.status));
    SY.sha = null;
    return { changedLocal: false, needPush: true };
  }
  if (!r.ok) throw new Error(fail(r.status));
  const j = await r.json();
  const remote = JSON.parse(dec(j.content || ''));
  SY.sha = j.sha;
  const before = canon(S);
  const merged = merge(S, remote);
  const after = canon(merged);
  if (after !== before) replaceState(merged);
  return { changedLocal: after !== before, needPush: after !== canon(remote) };
}

async function push() {
  const r = await gh('PUT', { message: `sync ${new Date().toISOString()}`, content: enc(JSON.stringify(S)), ...(SY.sha ? { sha: SY.sha } : {}) });
  if (r.status === 409 || r.status === 422) return false; // 그 사이 다른 기기가 올렸다
  if (!r.ok) throw new Error(fail(r.status));
  SY.sha = (await r.json()).content.sha;
  return true;
}

// ── 문서(선별노트 같은 HTML 파일): 보관함의 docs/<id>.html 로 따로 둔다(자료 파일을 무겁게 하지 않으려고) ──
const docUrl = (id) => `https://api.github.com/repos/${D.repo}/contents/docs/${encodeURIComponent(id)}.html`;
const ghHeaders = (accept = 'application/vnd.github+json') => ({ Authorization: `Bearer ${D.token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' });
export async function putDoc(id, text) {
  const cur = await fetch(docUrl(id), { cache: 'no-store', headers: ghHeaders() });
  const sha = cur.ok ? (await cur.json()).sha : undefined;
  const r = await fetch(docUrl(id), { method: 'PUT', headers: ghHeaders(), body: JSON.stringify({ message: `doc ${id}`, content: enc(text), ...(sha ? { sha } : {}) }) });
  if (!r.ok) throw new Error(fail(r.status));
}
export async function getDoc(id) {
  const r = await fetch(docUrl(id), { cache: 'no-store', headers: ghHeaders('application/vnd.github.raw+json') });
  if (!r.ok) throw new Error(r.status === 404 ? '보관함에 이 문서가 없어요. 올린 기기에서 동기화가 켜져 있었는지 확인해 주세요.' : fail(r.status));
  return r.text();
}

let busy = false, again = false;
// 한 번 맞추기. 돌려주는 값: 이 기기의 내용이 바뀌었으면 true(화면을 다시 그려야 한다).
export async function syncNow() {
  if (!syncOn()) { set('off'); return false; }
  if (DEMO.on) return false; // 데모 자료는 절대 올리지 않는다
  if (busy) { again = true; return false; }
  busy = true;
  let changed = false;
  set('busy');
  try {
    for (let i = 0; i < 4; i++) {
      const p = await pull();
      changed = changed || p.changedLocal;
      if (!p.needPush || await push()) { set('ok'); break; }
      if (i === 3) throw new Error('다른 기기와 계속 겹쳐서 잠시 뒤 다시 시도해요.');
    }
  } catch (e) {
    set(navigator.onLine === false ? 'offline' : 'error', e.message);
  }
  busy = false;
  if (again) { again = false; changed = (await syncNow()) || changed; }
  return changed;
}

let timer;
export function startSync(onRemoteChange) {
  onChange(() => { if (!syncOn()) return; clearTimeout(timer); timer = setTimeout(() => syncNow().then((c) => c && onRemoteChange()), 1500); });
  const tick = () => { if (syncOn() && document.visibilityState === 'visible') syncNow().then((c) => c && onRemoteChange()); };
  document.addEventListener('visibilitychange', tick);
  addEventListener('online', tick);
  setInterval(tick, 60000);
  tick();
}
