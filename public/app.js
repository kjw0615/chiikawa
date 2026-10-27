const PLAYLIST = 'PLRU7nJfHLAe8';
const SEED = 'kzAfNg6pAvI';
const KEY = `chiikawa-watch-room-ko-${PLAYLIST}-v1`;
const $ = id => document.getElementById(id);
const validId = id => typeof id === 'string' && /^[\w-]{11}$/.test(id);
const validTime = time => Number.isFinite(time) && time >= 0;
const catalog = window.EPISODES || [{id:SEED,title:'1화 · 단단한 푸딩, 핫케이크'}];
const names = new Map(catalog.map(item => [item.id, item.title]));
let state = { videos: {}, last: null };
let storageAvailable = true;
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && typeof saved.videos === 'object' && saved.videos) {
    state.videos = saved.videos;
    if (saved.last && validId(saved.last.id) && validTime(saved.last.time)) state.last = saved.last;
  }
} catch { storageAvailable = false; }
let ids = catalog.map(item => item.id), current = SEED, player, ready = false, visible = false;
let apiPromise, pending = null, rendered = '';
const title = id => names.get(id) || state.videos[id]?.title || `재생목록 ${ids.indexOf(id) + 1}번째 영상`;
const timeText = time => `${Math.floor(time / 60)}분 ${Math.floor(time % 60)}초`;
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); }
  catch { storageAvailable = false; $('status').textContent = '이 브라우저에서는 시청 기록을 저장할 수 없습니다.'; }
}
function showResume() {
  const last = state.last; $('resume').hidden = !last;
  if (last) { $('resume-title').textContent = title(last.id); $('resume-description').textContent = `${timeText(last.time)}부터 이야기를 이어 가요.`; }
}
function render() {
  const signature = JSON.stringify([ids, ids.map(id => [title(id), !!state.videos[id]?.completed])]);
  if (signature !== rendered) {
    const selected = $('episode-select').value;
    $('episode-select').replaceChildren(...ids.map(id => {
      const option = document.createElement('option'); option.value = id;
      option.textContent = `${title(id)}${state.videos[id]?.completed ? ' · 시청 완료' : ''}`; return option;
    }));
    if (ids.includes(selected)) $('episode-select').value = selected;
    rendered = signature;
  }
  const completed = ids.filter(id => state.videos[id]?.completed).length;
  $('completed-count').textContent = completed ? `시청 완료 ${completed}편` : '시청하면 자동으로 기록돼요';
}
function saveProgress(force = false) {
  if (!ready || !visible || (!force && player.getPlayerState() !== 1)) return;
  const id = player.getVideoData()?.video_id, time = player.getCurrentTime();
  if (!validId(id) || !validTime(time)) return;
  const name = player.getVideoData()?.title || title(id);
  state.videos[id] = { ...state.videos[id], time, title: name };
  state.last = { id, time, title: name }; persist(); showResume();
}
function sync() {
  if (!ready) return;
  const playlist = player.getPlaylist()?.filter(validId);
  // The embedded player may return only part of a large playlist. Keep the full catalog.
  if (playlist?.length) ids = [...new Set([...catalog.map(item => item.id), ...playlist])];
  const data = player.getVideoData();
  const changed = validId(data?.video_id) && current !== data.video_id;
  if (validId(data?.video_id)) {
    current = data.video_id;
    if (!ids.includes(current)) ids.push(current);
    if (data.title) state.videos[current] = { ...state.videos[current], title: data.title };
    if (visible) { $('video-title').textContent = title(current); $('position').textContent = '지금 상영 중 · 한국어 더빙'; }
    $('youtube-link').href = `https://www.youtube.com/watch?v=${current}&list=${PLAYLIST}`;
  }
  $('previous').disabled = ids.indexOf(current) <= 0;
  $('next').disabled = ids.indexOf(current) >= ids.length - 1;
  render();
  if (changed) $('episode-select').value = current;
}
function loadApi() {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('YouTube 연결이 지연되고 있어요. 잠시 후 다시 시도해 주세요.')), 15000);
    window.onYouTubeIframeAPIReady = () => { clearTimeout(timeout); resolve(); };
    const script = document.createElement('script'); script.src = 'https://www.youtube.com/iframe_api';
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('YouTube에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.')); };
    document.head.append(script);
  }).catch(error => { apiPromise = null; throw error; });
  return apiPromise;
}
function playPending() {
  if (!pending || !ready) return;
  const request = pending, list = player.getPlaylist() || [];
  if (list.includes(request.id)) player.playVideoAt(list.indexOf(request.id));
  else player.loadVideoById({ videoId: request.id, startSeconds: request.time });
}
async function start(id, seconds) {
  if (!validId(id)) return;
  saveProgress(true);
  if (!ids.includes(id)) ids.push(id);
  render(); $('episode-select').value = id;
  const previous = state.videos[id];
  pending = { id, time: validTime(seconds) ? seconds : previous?.completed ? 0 : validTime(previous?.time) ? previous.time : 0 };
  $('start-button').disabled = true; $('status').textContent = '이야기를 준비하고 있어요…';
  try {
    await loadApi(); visible = true; $('waiting').hidden = true; $('player-shell').hidden = false; $('playback').hidden = false;
    if (ready) { playPending(); $('start-button').disabled = false; $('status').textContent = ''; return; }
    if (player) return;
    current = id;
    player = new YT.Player('player', {
      width: '100%', height: '100%', videoId: id,
      playerVars: { listType: 'playlist', list: PLAYLIST, playsinline: 1, origin: location.origin, autoplay: 0 },
      events: {
        onReady: () => { ready = true; sync(); playPending(); $('start-button').disabled = false; $('status').textContent = storageAvailable ? '' : '이 브라우저에서는 시청 기록을 저장할 수 없습니다.'; },
        onStateChange: event => {
          // Capture the ended video's ID before synchronizing playlist transitions.
          const endedId = event.data === 0 ? player.getVideoData()?.video_id : null;
          if (visible && validId(endedId)) {
            saveProgress(true);
            state.videos[endedId] = { ...state.videos[endedId], completed: true };
            persist();
          }
          sync();
          if (event.data === 1 && pending && player.getVideoData()?.video_id === pending.id) { const time = pending.time; pending = null; player.seekTo(time, true); }
          if (event.data === 2) saveProgress(true);
        },
        onError: event => { pending = null; $('start-button').disabled = false; $('status').textContent = `영상을 재생할 수 없어요 (${event.data}). YouTube에서 보기 또는 다른 영상을 선택해 주세요.`; },
        onAutoplayBlocked: () => { $('status').textContent = '플레이어의 재생 버튼을 눌러 이야기를 시작해 주세요.'; }
      }
    });
  } catch (error) { $('start-button').disabled = false; $('status').textContent = error.message; }
}
function waiting() {
  visible = false; pending = null; if (ready) player.pauseVideo();
  $('waiting').hidden = false; $('player-shell').hidden = true; $('playback').hidden = true;
  $('video-title').textContent = '치이카와와 함께 쉬어 가요.'; $('position').textContent = 'OUR LITTLE WATCH ROOM';
}
$('start-button').onclick = () => start($('episode-select').value);
$('resume-button').onclick = () => { if (state.last) start(state.last.id, state.last.time); };
$('episode-select').onchange = render;
$('previous').onclick = () => start(ids[ids.indexOf(current) - 1]);
$('next').onclick = () => start(ids[ids.indexOf(current) + 1]);
$('back-to-waiting').onclick = () => { saveProgress(true); waiting(); $('status').textContent = '다음 이야기를 고르거나, 보던 곳부터 이어 보세요.'; };
// Catch browser back/forward cache restoration with the same waiting-screen behavior.
window.addEventListener('pageshow', event => { if (event.persisted) { saveProgress(true); waiting(); showResume(); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) saveProgress(); });
window.addEventListener('pagehide', () => saveProgress());
setInterval(() => { saveProgress(); if (ready && visible) sync(); }, 3000);
showResume(); render();
$('list-note').textContent = `${ids.length}개 영상 · 재생목록에 공개된 회차를 선택할 수 있어요.`;
