const FEED_URL = '/api/headlines';
const REFRESH_MS = 15000;

const feedEl = document.getElementById('feed');
const liveDotEl = document.getElementById('live-dot');
const statusTextEl = document.getElementById('status-text');

let seenIds = new Set();

function relativeTime(dateString) {
  const seconds = Math.round((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function tagClass(source) {
  return ['dining', 'weather', 'transit', 'newman-library-rooms'].includes(source)
    ? source
    : 'default';
}

async function shareHeadline(headline, button) {
  const shareText = `${headline.headline}\n\n${headline.blurb}`;
  const shareUrl = window.location.href;

  try {
    if (navigator.share) {
      await navigator.share({ title: 'Campus Confidential', text: shareText, url: shareUrl });
      return;
    }
    await navigator.clipboard.writeText(`${shareText}\n\n${shareUrl}`);
    const original = button.textContent;
    button.textContent = 'Copied!';
    button.disabled = true;
    setTimeout(() => {
      button.textContent = original;
      button.disabled = false;
    }, 1500);
  } catch (err) {
    // AbortError fires when the user just closes the native share sheet — not a real failure.
    if (err.name !== 'AbortError') {
      console.error('Share failed:', err.message);
    }
  }
}

function renderHeadline(headline, isNew) {
  const el = document.createElement('article');
  el.className = 'story' + (isNew ? ' is-new' : '');

  const tag = document.createElement('span');
  tag.className = `tag ${tagClass(headline.source)}`;
  tag.textContent = headline.source;

  const body = document.createElement('div');

  const h2 = document.createElement('h2');
  h2.textContent = headline.headline;

  const p = document.createElement('p');
  p.textContent = headline.blurb;

  const footerRow = document.createElement('div');
  footerRow.className = 'story-footer';

  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = relativeTime(headline.createdAt);

  const shareBtn = document.createElement('button');
  shareBtn.className = 'share-btn';
  shareBtn.type = 'button';
  shareBtn.textContent = 'Share';
  shareBtn.addEventListener('click', () => shareHeadline(headline, shareBtn));

  footerRow.append(meta, shareBtn);
  body.append(h2, p, footerRow);
  el.append(tag, body);

  return el;
}

function setStatus(state, text) {
  liveDotEl.className = `live-dot ${state}`;
  statusTextEl.textContent = text;
}

async function loadHeadlines() {
  try {
    const res = await fetch(FEED_URL);
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    const headlines = await res.json();

    if (!Array.isArray(headlines) || headlines.length === 0) {
      feedEl.innerHTML = '<div class="empty-state"><p>The presses are warming up. First headlines land within a few minutes.</p></div>';
      setStatus('live', 'live - no headlines yet');
      return;
    }

    const nextSeenIds = new Set();
    const fragment = document.createDocumentFragment();

    headlines.forEach((headline) => {
      const isNew = !seenIds.has(headline._id);
      nextSeenIds.add(headline._id);
      fragment.appendChild(renderHeadline(headline, isNew));
    });

    feedEl.replaceChildren(fragment);
    seenIds = nextSeenIds;
    setStatus('live', `live - updated ${relativeTime(new Date().toISOString())}`);
  } catch (err) {
    console.error('Failed to load headlines:', err.message);
    setStatus('error', 'connection issue, retrying...');
  }
}

loadHeadlines();
setInterval(loadHeadlines, REFRESH_MS);
