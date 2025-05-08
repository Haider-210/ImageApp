// frontend/app.js
const API_BASE = 'https://imgapp-backend-cscjdue3dfbxhvhu.uksouth-01.azurewebsites.net/api';


// 1) Load & display gallery
async function loadImages() {
  const gallery = document.getElementById('gallery');
  gallery.textContent = 'Loading…';
  const imgs = await fetch(`${API_BASE}/images`).then(r=>r.json());
  if (!imgs.length) return gallery.textContent = 'No images yet.';
  gallery.innerHTML = imgs.map(img=>`
    <div class="card">
      <img src="${img.blobUrl}" alt="${img.metadata.title}" />
      <h3>${img.metadata.title}</h3>
      <p>${img.metadata.description}</p>
      <div id="comments-${img.id}">Loading comments…</div>
      <form data-id="${img.id}" class="commentForm">
        <input name="text" placeholder="Comment" required />
        <input name="rating" type="number" min="1" max="5" placeholder="Rating" required />
        <button type="submit">Post</button>
      </form>
    </div>
  `).join('');
  // Attach comment handlers & load comments
  imgs.forEach(img=>{
    document.querySelector(`.commentForm[data-id="${img.id}"]`)
      .addEventListener('submit', handleComment);
    loadComments(img.id);
  });
}

// 2) Load comments
async function loadComments(id) {
  const el = document.getElementById(`comments-${id}`);
  const comms = await fetch(`${API_BASE}/images/${id}/comments`).then(r=>r.json());
  el.innerHTML = comms.length
    ? comms.map(c=>`<p>${c.text} — ${c.rating}/5</p>`).join('')
    : 'No comments yet.';
}

// 3) Handle comment submit
async function handleComment(e) {
  e.preventDefault();
  const id = e.target.dataset.id;
  const data = { text:e.target.text.value, rating:+e.target.rating.value };
  await fetch(`${API_BASE}/images/${id}/comments`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify(data)
  });
  e.target.reset();
  loadComments(id);
}

// 4) Upload image
async function uploadImage(formData) {
  const res = await fetch(`${API_BASE}/images`, { method:'POST', body:formData });
  return res.ok ? res.json() : {};
}

