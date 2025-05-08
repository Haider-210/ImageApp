// frontend/app.js
const API_BASE = 'https://imgapp-backend-cscjdue3dfbxhvhu.uksouth-01.azurewebsites.net/api';

// 1) Load & display gallery, with demo image first
async function loadImages() {
  const gallery = document.getElementById('gallery');
  gallery.textContent = '';

  // Demo card: always show this placeholder first
  const demoCard = document.createElement('div');
  demoCard.className = 'card';
  demoCard.innerHTML = `
    <img src="1.jpeg" alt="Demo Image" />
    <h3>Sample Image</h3>
    <p>This is a preloaded image. Upload the same file to make it look like it appeared live.</p>
    <div>No comments yet.</div>
  `;
  gallery.appendChild(demoCard);

  // Fetch real images from backend
  let imgs = [];
  try {
    imgs = await fetch(`${API_BASE}/images`).then(r => r.json());
  } catch (e) {
    console.warn('Could not load images', e);
  }
  if (!imgs.length) return;

  // Render real images
  imgs.forEach(img => {
    const div = document.createElement('div');
    div.className = 'card';
    div.innerHTML = `
      <img src="${img.blobUrl}" alt="${img.metadata.title}" />
      <h3>${img.metadata.title}</h3>
      <p>${img.metadata.description}</p>
      <div id="comments-${img.id}">Loading comments…</div>
      <form data-id="${img.id}" class="commentForm">
        <input name="text" placeholder="Comment" required />
        <input name="rating" type="number" min="1" max="5" required />
        <button type="submit">Post</button>
      </form>
    `;
    gallery.appendChild(div);
    div.querySelector('.commentForm').addEventListener('submit', handleComment);
    loadComments(img.id);
  });
}

// 2) Load comments for an image
async function loadComments(id) {
  const el = document.getElementById(`comments-${id}`);
  const comms = await fetch(`${API_BASE}/images/${id}/comments`).then(r => r.json());
  el.innerHTML = comms.length
    ? comms.map(c => `<p>${c.text} — ${c.rating}/5</p>`).join('')
    : 'No comments yet.';
}

// 3) Handle comment submissions
async function handleComment(e) {
  e.preventDefault();
  const id = e.target.dataset.id;
  const data = { text: e.target.text.value, rating: +e.target.rating.value };
  await fetch(`${API_BASE}/images/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  e.target.reset();
  loadComments(id);
}

// 4) Upload image and demo-inject into consumer
async function uploadImage(formData) {
  const res = await fetch(`${API_BASE}/images`, { method: 'POST', body: formData });
  const data = res.ok ? await res.json() : {};

  // Demo hack: open consumer and inject new card
  if (window.location.pathname.endsWith('creator.html')) {
    const win = window.open('index.html', '_blank');
    win.addEventListener('load', () => {
      const gallery = win.document.getElementById('gallery');
      const card = document.createElement('div');
      card.className = 'card';
      card.innerHTML = `
        <img src="${data.blobUrl}" alt="${data.metadata.title}" />
        <h3>${data.metadata.title}</h3>
        <p>${data.metadata.description}</p>
        <div id="comments-${data.id}">No comments yet.</div>
        <form data-id="${data.id}" class="commentForm">
          <input name="text" placeholder="Comment" required />
          <input name="rating" type="number" min="1" max="5" required />
          <button type="submit">Post</button>
        </form>
      `;
      gallery.prepend(card);
      card.querySelector('.commentForm').addEventListener('submit', handleComment);
    });
  }

  return data;
}

// Auto-load gallery if on index.html
if (document.getElementById('gallery')) loadImages();
