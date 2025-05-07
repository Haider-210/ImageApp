async function getToken() {
  const resp = await fetch('/.auth/me');
  const arr = await resp.json();
  return arr[0].access_token;
}

// Load gallery
async function loadImages() {
  const imgs = await fetch('/api/images').then(r=>r.json());
  const container = document.getElementById('images');
  container.innerHTML = '';
  for(const img of imgs) {
    const div = document.createElement('div');
    div.innerHTML = `
      <img src="${img.blobUrl}" width=200 /><br/>
      <b>${img.metadata.title}</b><p>${img.metadata.caption}</p>
      <div id="comments-${img._id}"></div>
      <textarea id="txt-${img._id}"></textarea>
      <input id="rate-${img._id}" type="number" min="1" max="5"/>
      <button onclick="postComment('${img._id}')">Comment</button>
    `;
    container.appendChild(div);
    loadComments(img._id);
  }
}

async function loadComments(id) {
  const comms = await fetch(`/api/images/${id}/comments`).then(r=>r.json());
  const div = document.getElementById(`comments-${id}`);
  div.innerHTML = comms.map(c=>`<p>${c.text} (${c.rating}★)</p>`).join('');
}

async function postComment(id) {
  const token = await getToken();
  const text = document.getElementById(`txt-${id}`).value;
  const rating = document.getElementById(`rate-${id}`).value;
  await fetch(`/api/images/${id}/comments`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+token },
    body: JSON.stringify({ text, rating })
  });
  loadComments(id);
}

// Upload (creators)
document.getElementById('uploadForm')?.addEventListener('submit', async e=>{
  e.preventDefault();
  const token = await getToken();
  const form = e.target;
  const data = new FormData(form);
  await fetch('/api/images', {
    method:'POST',
    headers: { 'Authorization': 'Bearer '+token },
    body: data
  });
  alert('Uploaded');
});
window.onload = loadImages;
