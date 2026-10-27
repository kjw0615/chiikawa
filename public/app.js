const PLAYLIST = 'PLMBLbvGZhkvJz0u2YjX8i9iEWcHJ-rwf5';
const SEED = 'i6d3K6ln-d4';
const KEY = 'chiikawa-watch-room-v1';
const $ = (id) => document.getElementById(id);
let state = { videos: {}, last: null };
let storageAvailable = true;
try { const saved = JSON.parse(localStorage.getItem(KEY)); if (saved && typeof saved.videos === 'object' && saved.videos !== null) { state.videos = saved.videos; if (saved.last && /^[\w-]{11}$/.test(saved.last.id) && Number.isFinite(saved.last.time) && saved.last.time >= 0) state.last = saved.last; } } catch { storageAvailable = false; }
let ids = [SEED], player, current = SEED, filter = 'all', ready = false, pendingResume = null, rendered = '';
const title = id => id === SEED ? '제2화 · 스핑크스 / 진짜다' : `재생목록 ${ids.indexOf(id) + 1}번째 영상`;
const timeText = t => `${Math.floor(t / 60)}분 ${Math.floor(t % 60)}초`;
function persist() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { storageAvailable = false; $('status').textContent = '브라우저 저장소를 사용할 수 없어 시청 기록이 유지되지 않습니다.'; } }
function showResume() { const last = state.last; $('resume').hidden = !last; if (!last) return; $('resume-title').textContent = last.title || title(last.id); $('resume-description').textContent = `${timeText(last.time)}부터 이어 볼 수 있어요. 재생 버튼을 눌러 시작하세요.`; }
function render() {
  const query = $('search').value.trim().toLowerCase();
  const signature = JSON.stringify([ids, current, filter, query, ids.map(id => !!state.videos[id]?.completed)]);
  if (signature === rendered) return;
  rendered = signature;
  const visible = ids.filter((id, i) => (!query || `${title(id)} ${i + 1}`.toLowerCase().includes(query)) && (filter === 'all' || (filter === 'watched' ? state.videos[id]?.completed : !state.videos[id]?.completed)));
  $('episodes').replaceChildren();
  visible.forEach(id => {
    const button = document.createElement('button'); button.className = `episode${current === id ? ' selected' : ''}`; button.setAttribute('aria-current', current === id ? 'true' : 'false');
    const thumb = document.createElement('div'); thumb.className = 'thumb';
    const img = document.createElement('img'); img.src = `https://i.ytimg.com/vi/${id}/mqdefault.jpg`; img.alt = ''; img.loading = 'lazy'; thumb.append(img);
    if (current === id) { const tag = document.createElement('span'); tag.className = 'play-tag'; tag.textContent = '▶ 선택한 영상'; thumb.append(tag); }
    const info = document.createElement('div'); info.className = 'episode-info';
    const small = document.createElement('small'); small.textContent = ids.length > 1 ? `LIST ${String(ids.indexOf(id) + 1).padStart(2, '0')}` : 'SAMPLE VIDEO';
    const strong = document.createElement('strong'); strong.textContent = title(id); info.append(small, strong);
    if (state.videos[id]?.completed) { const badge = document.createElement('span'); badge.className = 'watched'; badge.textContent = '✓ 시청 완료'; info.append(badge); }
    button.append(thumb, info); button.addEventListener('click', () => select(id)); $('episodes').append(button);
  });
  $('empty').hidden = visible.length !== 0; $('count').textContent = String(ids.length).padStart(2, '0');
  $('complete').textContent = state.videos[current]?.completed ? '✓ 시청 완료 취소' : '✓ 시청 완료 표시';
}
function sync() {
  if (!ready) return;
  const playlist = player.getPlaylist();
  if (playlist?.length) { ids = [...new Set(playlist.filter(id => /^[\w-]{11}$/.test(id)))]; $('list-note').textContent = '목록 번호는 재생목록 순서입니다. 실제 회차와 다를 수 있어요. 제공된 예시 외 영상은 제목 대신 목록 번호로 표시합니다.'; }
  const id = player.getVideoData()?.video_id; if (id && /^[\w-]{11}$/.test(id)) { current = id; if (!ids.includes(id)) ids.push(id); }
  $('video-title').textContent = player.getVideoData()?.title || title(current);
  $('position').textContent = ids.length > 1 ? `지금 상영 중 · 목록 ${ids.indexOf(current) + 1} / ${ids.length}` : '지금 상영 중 · 예시 영상';
  $('youtube-link').href = `https://www.youtube.com/watch?v=${current}`;
  $('previous').disabled = ids.indexOf(current) <= 0; $('next').disabled = ids.indexOf(current) >= ids.length - 1;
  render();
}
function saveProgress() {
  if (!ready || player.getPlayerState() !== 1) return;
  const id = player.getVideoData()?.video_id;
  const time = player.getCurrentTime(); if (!id || !Number.isFinite(time)) return;
  state.videos[id] = { ...state.videos[id], time };
  state.last = { id, time, title: player.getVideoData()?.title || title(id) }; persist(); showResume();
}
function select(id, seconds) {
  if (!ready) { $('status').textContent = '플레이어 연결 후 다시 눌러 주세요.'; return; }
  saveProgress();
  const start = seconds ?? (state.videos[id]?.completed ? 0 : state.videos[id]?.time || 0);
  const index = ids.indexOf(id);
  if (index >= 0 && player.getPlaylist()?.includes(id)) {
    pendingResume = { id, time: start }; player.playVideoAt(index);
  } else { pendingResume = null; player.loadVideoById({ videoId: id, startSeconds: start }); }
  current = id; render();
}
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player('player', { width: '100%', height: '100%', videoId: SEED,
    playerVars: { listType: 'playlist', list: PLAYLIST, playsinline: 1, origin: location.origin, autoplay: 0 },
    events: {
      onReady: () => { ready = true; $('status').textContent = storageAvailable ? '재생 버튼을 누르면 시작합니다. 시청 위치는 자동으로 저장돼요.' : '이 브라우저에서는 시청 기록을 저장할 수 없습니다.'; sync(); },
      onStateChange: event => {
        sync();
        if (event.data === 1 && pendingResume && player.getVideoData()?.video_id === pendingResume.id) { player.seekTo(pendingResume.time, true); pendingResume = null; }
        if (event.data === 2) { const id = player.getVideoData()?.video_id; const time = player.getCurrentTime(); if (id && Number.isFinite(time)) { state.videos[id] = { ...state.videos[id], time }; state.last = { id, time, title: player.getVideoData()?.title || title(id) }; persist(); showResume(); } }
        if (event.data === 0) { state.videos[current] = { ...state.videos[current], completed: true }; persist(); render(); }
      },
      onError: e => { $('status').textContent = `영상을 재생할 수 없습니다 (${e.data}). YouTube에서 열기를 사용하거나 다른 영상을 선택해 주세요.`; },
      onAutoplayBlocked: () => { $('status').textContent = '브라우저가 자동 재생을 막았습니다. 플레이어의 재생 버튼을 눌러 주세요.'; }
    }
  });
};
$('resume-button').onclick = () => { if (state.last) select(state.last.id, state.last.time); };
$('previous').onclick = () => select(ids[ids.indexOf(current) - 1]);
$('next').onclick = () => select(ids[ids.indexOf(current) + 1]);
$('complete').onclick = () => { state.videos[current] = { ...state.videos[current], completed: !state.videos[current]?.completed }; persist(); render(); };
$('search').addEventListener('input', render);
document.querySelectorAll('[data-filter]').forEach(button => button.onclick = () => { filter = button.dataset.filter; document.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b === button)); render(); });
$('reset').onclick = () => { if (!confirm('이 브라우저의 모든 시청 기록을 지울까요?')) return; if (ready) player.pauseVideo(); state = { videos: {}, last: null }; persist(); showResume(); render(); };
document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
window.addEventListener('pagehide', saveProgress);
setInterval(() => { saveProgress(); if (ready) sync(); }, 3000);
showResume(); render();
const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api'; script.onerror = () => { $('status').textContent = 'YouTube에 연결하지 못했습니다. 인터넷 연결 또는 콘텐츠 차단 설정을 확인해 주세요.'; }; document.head.append(script);
setTimeout(() => { if (!ready) $('status').textContent = 'YouTube 연결이 지연되고 있습니다. 인터넷 연결을 확인하거나 YouTube에서 열기를 이용해 주세요.'; }, 15000);
