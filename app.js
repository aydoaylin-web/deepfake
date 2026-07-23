const STORAGE_KEY = 'dd-admin-state-v1';
const VERSION_KEY = 'dd-admin-versions-v1';
const BASELINE_KEY = 'dd-admin-baseline-v1';
const PASSWORD_KEY = 'dd-admin-password-v1';
let authenticated = false;

function bytesToBase64(bytes) {
  let binary = '';
  bytes.forEach(byte => binary += String.fromCharCode(byte));
  return btoa(binary);
}
function base64ToBytes(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}
async function derivePasswordHash(password, saltBytes) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name:'PBKDF2', salt:saltBytes, iterations:120000, hash:'SHA-256' }, keyMaterial, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function getPasswordRecord() {
  try { return JSON.parse(localStorage.getItem(PASSWORD_KEY)); } catch { return null; }
}
async function storePassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePasswordHash(password, salt);
  localStorage.setItem(PASSWORD_KEY, JSON.stringify({ salt:bytesToBase64(salt), hash }));
}
async function verifyPassword(password) {
  const record = getPasswordRecord();
  if (!record) return false;
  const hash = await derivePasswordHash(password, base64ToBytes(record.salt));
  return hash === record.hash;
}
function setAuthMode(mode) {
  const setup = mode === 'setup';
  document.getElementById('authTitle').textContent = setup ? 'Admin-Zugang einrichten' : 'Admin-Anmeldung';
  document.getElementById('authText').textContent = setup ? 'Lege beim ersten Start ein lokales Admin-Passwort fest.' : 'Gib dein Admin-Passwort ein.';
  document.getElementById('confirmPasswordLabel').classList.toggle('hidden', !setup);
  document.getElementById('authSubmitBtn').textContent = setup ? 'Passwort speichern' : 'Anmelden';
  document.getElementById('authPassword').autocomplete = setup ? 'new-password' : 'current-password';
  document.getElementById('authPassword').value = '';
  document.getElementById('authPasswordConfirm').value = '';
  document.getElementById('authError').textContent = '';
}
function unlockAdmin() {
  authenticated = true;
  document.body.classList.remove('locked');
  document.getElementById('authOverlay').classList.add('hidden');
}
function lockAdmin() {
  authenticated = false;
  document.body.classList.add('locked');
  document.getElementById('authOverlay').classList.remove('hidden');
  setAuthMode('login');
  setTimeout(() => document.getElementById('authPassword').focus(), 0);
}
async function handleAuthSubmit() {
  const record = getPasswordRecord();
  const password = document.getElementById('authPassword').value;
  const confirm = document.getElementById('authPasswordConfirm').value;
  const error = document.getElementById('authError');
  error.textContent = '';
  if (!record) {
    if (password.length < 6) { error.textContent = 'Das Passwort muss mindestens 6 Zeichen lang sein.'; return; }
    if (password !== confirm) { error.textContent = 'Die Passwörter stimmen nicht überein.'; return; }
    await storePassword(password);
    unlockAdmin();
    return;
  }
  if (!(await verifyPassword(password))) { error.textContent = 'Das Passwort ist falsch.'; return; }
  unlockAdmin();
}
async function changePassword() {
  const current = document.getElementById('changeCurrentPassword').value;
  const next = document.getElementById('changeNewPassword').value;
  const confirm = document.getElementById('changeNewPasswordConfirm').value;
  const message = document.getElementById('changePasswordMessage');
  message.className = 'status-message';
  if (!(await verifyPassword(current))) { message.textContent = 'Das aktuelle Passwort ist falsch.'; message.classList.add('error'); return; }
  if (next.length < 6) { message.textContent = 'Das neue Passwort muss mindestens 6 Zeichen lang sein.'; message.classList.add('error'); return; }
  if (next !== confirm) { message.textContent = 'Die neuen Passwörter stimmen nicht überein.'; message.classList.add('error'); return; }
  await storePassword(next);
  document.getElementById('changeCurrentPassword').value = '';
  document.getElementById('changeNewPassword').value = '';
  document.getElementById('changeNewPasswordConfirm').value = '';
  message.textContent = 'Das Passwort wurde geändert.';
  message.classList.add('success');
}


const defaultState = {
  version: '1.0.0',
  post: {
    title: 'Viral post under review',
    text: 'Students should be allowed to use AI in exams. Teachers cannot tell the difference anymore anyway.',
    correctVerdict: 'manipuliert'
  },
  tools: [
    { id: crypto.randomUUID(), name: 'Bildanalyse', description: 'Prüfe sichtbare Unstimmigkeiten im Bild.', enabled: true },
    { id: crypto.randomUUID(), name: 'Quellenprüfung', description: 'Prüfe Herkunft und Vertrauenswürdigkeit der Quelle.', enabled: true },
    { id: crypto.randomUUID(), name: 'Profilprüfung', description: 'Prüfe Kontodaten und bisherige Aktivitäten.', enabled: true },
    { id: crypto.randomUUID(), name: 'Beitragsanalyse', description: 'Prüfe Sprache, Kontext und Behauptungen.', enabled: true }
  ],
  evaluation: {
    pointsVerdict: 2,
    pointsReason: 2,
    minKeywords: 1,
    keywords: ['Quelle', 'Kontext', 'Bildersuche', 'Manipulation'],
    feedbackFull: 'Richtig. Du hast die Einstufung und einen relevanten Hinweis erkannt.',
    feedbackPartial: 'Teilweise richtig. Prüfe deine Einstufung und begründe sie mit einem konkreten Hinweis.'
  },
  statistics: { accuracy: true, confidence: true, history: true }
};

let state = loadState();
let undoStack = [];
let redoStack = [];
let baselineState = loadBaseline();

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function loadState() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || clone(defaultState); }
  catch { return clone(defaultState); }
}
function persist() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function loadBaseline() {
  try { return JSON.parse(localStorage.getItem(BASELINE_KEY)) || clone(state); }
  catch { return clone(state); }
}
function saveBaseline() {
  baselineState = clone(state);
  localStorage.setItem(BASELINE_KEY, JSON.stringify(baselineState));
  renderChangedFiles();
}
function commit(mutator) {
  undoStack.push(clone(state));
  if (undoStack.length > 100) undoStack.shift();
  redoStack = [];
  mutator(state);
  persist();
  renderAll();
}

function bindInput(id, getter, setter, event='input') {
  const el = document.getElementById(id);
  el.value = getter();
  el.onchange = null;
  el.oninput = null;
  el.addEventListener(event, () => commit(s => setter(s, el.type === 'number' ? Number(el.value) : el.value)), { once: true });
}

function renderAll() {
  document.getElementById('postTitle').value = state.post.title;
  document.getElementById('postText').value = state.post.text;
  document.getElementById('correctVerdict').value = state.post.correctVerdict;
  document.getElementById('pointsVerdict').value = state.evaluation.pointsVerdict;
  document.getElementById('pointsReason').value = state.evaluation.pointsReason;
  document.getElementById('minKeywords').value = state.evaluation.minKeywords;
  document.getElementById('keywords').value = state.evaluation.keywords.join(', ');
  document.getElementById('feedbackFull').value = state.evaluation.feedbackFull;
  document.getElementById('feedbackPartial').value = state.evaluation.feedbackPartial;
  document.getElementById('statAccuracy').checked = state.statistics.accuracy;
  document.getElementById('statConfidence').checked = state.statistics.confidence;
  document.getElementById('statHistory').checked = state.statistics.history;
  document.getElementById('codeOutput').textContent = JSON.stringify(state, null, 2);
  renderTools();
  renderPreview();
  renderVersions();
  renderChangedFiles();
  document.getElementById('undoBtn').disabled = undoStack.length === 0;
  document.getElementById('redoBtn').disabled = redoStack.length === 0;
}

function wireSimpleInputs() {
  const map = [
    ['postTitle', v => commit(s => s.post.title = v.target.value), 'input'],
    ['postText', v => commit(s => s.post.text = v.target.value), 'input'],
    ['correctVerdict', v => commit(s => s.post.correctVerdict = v.target.value), 'change'],
    ['pointsVerdict', v => commit(s => s.evaluation.pointsVerdict = Number(v.target.value)), 'change'],
    ['pointsReason', v => commit(s => s.evaluation.pointsReason = Number(v.target.value)), 'change'],
    ['minKeywords', v => commit(s => s.evaluation.minKeywords = Number(v.target.value)), 'change'],
    ['keywords', v => commit(s => s.evaluation.keywords = v.target.value.split(',').map(x => x.trim()).filter(Boolean)), 'change'],
    ['feedbackFull', v => commit(s => s.evaluation.feedbackFull = v.target.value), 'change'],
    ['feedbackPartial', v => commit(s => s.evaluation.feedbackPartial = v.target.value), 'change'],
    ['statAccuracy', v => commit(s => s.statistics.accuracy = v.target.checked), 'change'],
    ['statConfidence', v => commit(s => s.statistics.confidence = v.target.checked), 'change'],
    ['statHistory', v => commit(s => s.statistics.history = v.target.checked), 'change']
  ];
  map.forEach(([id, fn, event]) => document.getElementById(id).addEventListener(event, fn));
}

function renderTools() {
  const root = document.getElementById('toolsEditor');
  root.innerHTML = '';
  state.tools.forEach((tool, index) => {
    const row = document.createElement('div');
    row.className = 'tool-row';
    row.innerHTML = `
      <input aria-label="Name" value="${escapeHtml(tool.name)}" data-field="name" />
      <input aria-label="Beschreibung" value="${escapeHtml(tool.description)}" data-field="description" />
      <label><input type="checkbox" data-field="enabled" ${tool.enabled ? 'checked' : ''}> Aktiv</label>
      <button data-remove>Entfernen</button>`;
    row.querySelectorAll('input').forEach(input => {
      input.addEventListener('change', () => commit(s => {
        const target = s.tools[index];
        target[input.dataset.field] = input.type === 'checkbox' ? input.checked : input.value;
      }));
    });
    row.querySelector('[data-remove]').onclick = () => commit(s => s.tools.splice(index, 1));
    root.appendChild(row);
  });
}

function renderPreview() {
  const enabledTools = state.tools.filter(t => t.enabled);
  document.getElementById('studentPreview').innerHTML = `
    <span class="badge">Lokale Schüleransicht</span>
    <h3>${escapeHtml(state.post.title)}</h3>
    <p>${escapeHtml(state.post.text)}</p>
    <div class="tool-buttons">${enabledTools.map(t => `<button title="${escapeHtml(t.description)}">${escapeHtml(t.name)}</button>`).join('')}</div>
    <div class="decision-grid">
      <button data-v="echt">Echt</button><button data-v="verdächtig">Verdächtig</button><button data-v="manipuliert">Manipuliert</button>
    </div>
    <label>Begründung<textarea id="previewReason" placeholder="Begründung eingeben"></textarea></label>
    <label>Sicherheit 1 bis 5<input id="previewConfidence" type="range" min="1" max="5" value="3"></label>
    <button id="previewEvaluate" class="primary">Auswerten</button>
    <p id="previewResult"></p>`;
  let verdict = null;
  document.querySelectorAll('#studentPreview [data-v]').forEach(btn => btn.onclick = () => {
    verdict = btn.dataset.v;
    document.querySelectorAll('#studentPreview [data-v]').forEach(b => b.classList.remove('primary'));
    btn.classList.add('primary');
  });
  document.getElementById('previewEvaluate').onclick = () => {
    const reason = document.getElementById('previewReason').value.toLowerCase();
    const hits = state.evaluation.keywords.filter(k => reason.includes(k.toLowerCase())).length;
    const full = verdict === state.post.correctVerdict && hits >= state.evaluation.minKeywords;
    const points = (verdict === state.post.correctVerdict ? state.evaluation.pointsVerdict : 0) + (hits >= state.evaluation.minKeywords ? state.evaluation.pointsReason : 0);
    document.getElementById('previewResult').textContent = `${full ? state.evaluation.feedbackFull : state.evaluation.feedbackPartial} Punkte: ${points}`;
  };
}

function getVersions() {
  try { return JSON.parse(localStorage.getItem(VERSION_KEY)) || []; }
  catch { return []; }
}
function saveVersion(label) {
  const versions = getVersions();
  versions.unshift({ id: crypto.randomUUID(), label: label || `Version ${state.version}`, createdAt: new Date().toISOString(), state: clone(state) });
  localStorage.setItem(VERSION_KEY, JSON.stringify(versions.slice(0, 30)));
  renderVersions();
}
function renderVersions() {
  const root = document.getElementById('versionList');
  const versions = getVersions();
  root.innerHTML = versions.length ? '' : '<p>Noch keine Version gespeichert.</p>';
  versions.forEach(v => {
    const el = document.createElement('div');
    el.className = 'version-item';
    el.innerHTML = `<div><strong>${escapeHtml(v.label)}</strong><br><small>${new Date(v.createdAt).toLocaleString('de-DE')}</small></div><div><button data-load>Laden</button> <button data-download>JSON</button></div>`;
    el.querySelector('[data-load]').onclick = () => {
      undoStack.push(clone(state)); state = clone(v.state); persist(); renderAll();
    };
    el.querySelector('[data-download]').onclick = () => downloadBlob(`${safeName(v.label)}.json`, JSON.stringify(v.state, null, 2), 'application/json');
    root.appendChild(el);
  });
}


function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

function describeObjectChanges(before, after, labels) {
  const items = [];
  for (const [key, label] of Object.entries(labels)) {
    if (!same(before?.[key], after?.[key])) items.push(label);
  }
  return items;
}

function getChangedFiles() {
  const files = [];
  const postChanges = describeObjectChanges(baselineState.post, state.post, {
    title: 'Beitragstitel', text: 'Beitragstext', correctVerdict: 'richtige Einstufung'
  });
  if (postChanges.length) files.push({
    name: 'content/posts.json',
    reason: 'Beitragsinhalt wurde verändert.',
    details: postChanges
  });

  if (!same(baselineState.tools, state.tools)) {
    const details = [];
    const beforeById = Object.fromEntries((baselineState.tools || []).map(t => [t.id, t]));
    const afterById = Object.fromEntries((state.tools || []).map(t => [t.id, t]));
    for (const tool of state.tools || []) {
      if (!beforeById[tool.id]) details.push(`Tool hinzugefügt: ${tool.name}`);
      else if (!same(beforeById[tool.id], tool)) details.push(`Tool verändert: ${tool.name}`);
    }
    for (const tool of baselineState.tools || []) if (!afterById[tool.id]) details.push(`Tool entfernt: ${tool.name}`);
    files.push({ name: 'config/tools.json', reason: 'Analysetools wurden verändert.', details: details.length ? details : ['Tool-Konfiguration geändert'] });
  }

  const evaluationChanges = describeObjectChanges(baselineState.evaluation, state.evaluation, {
    pointsVerdict: 'Punkte für Einstufung', pointsReason: 'Punkte für Begründung', minKeywords: 'Mindestanzahl Schlüsselbegriffe',
    keywords: 'akzeptierte Schlüsselbegriffe', feedbackFull: 'Feedback bei vollständiger Lösung', feedbackPartial: 'Feedback bei unvollständiger Lösung'
  });
  if (evaluationChanges.length) files.push({ name: 'rules/evaluation.json', reason: 'Auswertungslogik wurde verändert.', details: evaluationChanges });

  const statisticsChanges = describeObjectChanges(baselineState.statistics, state.statistics, {
    accuracy: 'Trefferquote', confidence: 'durchschnittliche Sicherheit', history: 'Antwortverlauf'
  });
  if (statisticsChanges.length) files.push({ name: 'config/statistics.json', reason: 'Statistikanzeige wurde verändert.', details: statisticsChanges });

  if (!same(baselineState.version, state.version)) files.push({ name: 'version.json', reason: 'Versionsnummer wurde verändert.', details: [`${baselineState.version} → ${state.version}`] });

  if (files.length) files.unshift({
    name: 'index.html',
    reason: 'Die lokale Schüler-App wird aus den geänderten Einstellungen neu erzeugt.',
    details: ['Generierte Oberfläche und eingebettete Konfiguration werden aktualisiert.']
  });
  return files;
}

function renderChangedFiles() {
  const files = getChangedFiles();
  const badge = document.getElementById('changeCountBadge');
  if (badge) badge.textContent = String(files.length);
  const summary = document.getElementById('changedFilesSummary');
  const root = document.getElementById('changedFilesList');
  if (!summary || !root) return;
  summary.innerHTML = files.length
    ? `<strong>${files.length} Datei${files.length === 1 ? '' : 'en'} betroffen.</strong> Diese Dateien würden beim nächsten Export neu erzeugt oder geändert.`
    : '<strong>Keine ungespeicherten Dateiänderungen.</strong> Der aktuelle Stand entspricht dem Ausgangsstand.';
  root.innerHTML = '';
  if (!files.length) {
    root.innerHTML = '<div class="no-changes">Sobald du Inhalte, Tools, Auswertungsregeln oder Statistiken änderst, erscheinen die betroffenen Dateien hier.</div>';
    return;
  }
  for (const file of files) {
    const el = document.createElement('details');
    el.className = 'changed-file';
    el.open = true;
    el.innerHTML = `<summary><span>${escapeHtml(file.name)}</span><span class="file-status">geändert</span></summary><div class="details"><p>${escapeHtml(file.reason)}</p><ul>${file.details.map(d => `<li>${escapeHtml(d)}</li>`).join('')}</ul></div>`;
    root.appendChild(el);
  }
}

function changesReport() {
  const files = getChangedFiles();
  const lines = [
    'DEEPFAKE DEFENDER – GEÄNDERTE DATEIEN',
    `Erstellt: ${new Date().toLocaleString('de-DE')}`,
    `Vergleich: Ausgangsstand ${baselineState.version || 'unbekannt'} → aktueller Stand ${state.version || 'unbekannt'}`,
    ''
  ];
  if (!files.length) lines.push('Keine Änderungen.');
  files.forEach(file => {
    lines.push(file.name, file.reason, ...file.details.map(d => `- ${d}`), '');
  });
  return lines.join('\n');
}

function escapeHtml(value='') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function safeName(value='version') { return value.toLowerCase().replace(/[^a-z0-9äöüß_-]+/gi, '-').replace(/^-|-$/g, '') || 'version'; }
function downloadBlob(filename, content, type='text/plain') {
  const blob = content instanceof Blob ? content : new Blob([content], { type });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// Minimal ZIP writer using STORE compression. Works offline and needs no library.
const crcTable = (() => { const t=[]; for(let n=0;n<256;n++){let c=n; for(let k=0;k<8;k++) c=(c&1)?0xedb88320^(c>>>1):c>>>1; t[n]=c>>>0;} return t; })();
function crc32(bytes){ let c=0xffffffff; for(const b of bytes) c=crcTable[(c^b)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
function u16(n){ return [n&255,(n>>>8)&255]; }
function u32(n){ return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]; }
function makeZip(files){
  const enc=new TextEncoder(); const locals=[]; const centrals=[]; let offset=0;
  for(const file of files){
    const name=enc.encode(file.name); const data=typeof file.content==='string'?enc.encode(file.content):file.content; const crc=crc32(data);
    const local=new Uint8Array([0x50,0x4b,0x03,0x04,...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name,...data]);
    locals.push(local);
    const central=new Uint8Array([0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0),...u16(0),...u16(0),...u16(0),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);
    centrals.push(central); offset += local.length;
  }
  const centralSize=centrals.reduce((a,b)=>a+b.length,0);
  const end=new Uint8Array([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),...u16(0)]);
  return new Blob([...locals,...centrals,end],{type:'application/zip'});
}

function generatedStudentHtml() {
  const config = JSON.stringify(state).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Deepfake Defender</title><style>body{font-family:system-ui;margin:0;background:#f4f7fb;color:#1f2937}.wrap{max-width:760px;margin:30px auto;padding:20px}.card{background:white;border:1px solid #dbe3ee;border-radius:18px;padding:24px}button,textarea,input{font:inherit}button{padding:10px 14px;border:1px solid #cbd5e1;border-radius:10px;background:white;margin:4px;cursor:pointer}.active{background:#2557d6;color:white}textarea{width:100%;min-height:110px;padding:10px;border-radius:10px;border:1px solid #cbd5e1}.tools{display:flex;flex-wrap:wrap;margin:12px 0}.result{font-weight:700;margin-top:16px}</style></head><body><div class="wrap"><div class="card"><h1 id="title"></h1><p id="text"></p><div id="tools" class="tools"></div><h3>Deine Entscheidung</h3><div id="verdicts"></div><h3>Begründung</h3><textarea id="reason"></textarea><h3>Sicherheit</h3><input id="confidence" type="range" min="1" max="5" value="3"><br><button id="evaluate">Auswerten</button><p id="result" class="result"></p></div></div><script>const config=${config};let verdict=null;document.getElementById('title').textContent=config.post.title;document.getElementById('text').textContent=config.post.text;config.tools.filter(t=>t.enabled).forEach(t=>{const b=document.createElement('button');b.textContent=t.name;b.title=t.description;document.getElementById('tools').appendChild(b)});['echt','verdächtig','manipuliert'].forEach(v=>{const b=document.createElement('button');b.textContent=v[0].toUpperCase()+v.slice(1);b.onclick=()=>{verdict=v;document.querySelectorAll('#verdicts button').forEach(x=>x.classList.remove('active'));b.classList.add('active')};document.getElementById('verdicts').appendChild(b)});document.getElementById('evaluate').onclick=()=>{const reason=document.getElementById('reason').value.toLowerCase();const hits=config.evaluation.keywords.filter(k=>reason.includes(k.toLowerCase())).length;const correct=verdict===config.post.correctVerdict;const full=correct&&hits>=config.evaluation.minKeywords;const points=(correct?config.evaluation.pointsVerdict:0)+(hits>=config.evaluation.minKeywords?config.evaluation.pointsReason:0);document.getElementById('result').textContent=(full?config.evaluation.feedbackFull:config.evaluation.feedbackPartial)+' Punkte: '+points;const history=JSON.parse(localStorage.getItem('dd-results')||'[]');history.push({date:new Date().toISOString(),verdict,correct,confidence:Number(document.getElementById('confidence').value),points});localStorage.setItem('dd-results',JSON.stringify(history));};<\/script></body></html>`;
}

function exportStudentZip() {
  const readme = `DEEPFAKE DEFENDER – LOKALE SCHÜLER-APP\n\n1. ZIP entpacken.\n2. index.html öffnen.\n3. Die App läuft lokal im Browser.\n4. Ergebnisse werden nur lokal im Browser gespeichert.\n\nExportiert aus dem Admin Studio am ${new Date().toLocaleString('de-DE')}.`;
  const zip = makeZip([
    { name:'index.html', content:generatedStudentHtml() },
    { name:'config.json', content:JSON.stringify(state,null,2) },
    { name:'README.txt', content:readme }
  ]);
  downloadBlob(`deepfake-defender-${safeName(state.version)}.zip`, zip, 'application/zip');
  saveBaseline();
}

// Navigation
for (const btn of document.querySelectorAll('.nav')) btn.onclick = () => {
  document.querySelectorAll('.nav').forEach(x => x.classList.remove('active'));
  document.querySelectorAll('.view').forEach(x => x.classList.remove('active'));
  btn.classList.add('active'); document.getElementById(`view-${btn.dataset.view}`).classList.add('active');
  if (btn.dataset.view === 'preview') renderPreview();
};

document.getElementById('undoBtn').onclick = () => { if (!undoStack.length) return; redoStack.push(clone(state)); state = undoStack.pop(); persist(); renderAll(); };
document.getElementById('redoBtn').onclick = () => { if (!redoStack.length) return; undoStack.push(clone(state)); state = redoStack.pop(); persist(); renderAll(); };
document.getElementById('saveVersionBtn').onclick = () => saveVersion();
document.getElementById('namedVersionBtn').onclick = () => { saveVersion(document.getElementById('versionLabel').value.trim()); document.getElementById('versionLabel').value=''; };
document.getElementById('addToolBtn').onclick = () => commit(s => s.tools.push({ id: crypto.randomUUID(), name:'Neues Tool', description:'Beschreibung', enabled:true }));
document.getElementById('copyCodeBtn').onclick = async () => { await navigator.clipboard.writeText(JSON.stringify(state,null,2)); document.getElementById('copyCodeBtn').textContent='Kopiert'; setTimeout(()=>document.getElementById('copyCodeBtn').textContent='Code kopieren',1200); };
document.getElementById('downloadJsonBtn').onclick = () => downloadBlob('config.json', JSON.stringify(state,null,2), 'application/json');
document.getElementById('exportZipBtn').onclick = exportStudentZip;
document.getElementById('setBaselineBtn').onclick = saveBaseline;
document.getElementById('downloadChangesBtn').onclick = () => downloadBlob('geaenderte-dateien.txt', changesReport(), 'text/plain');

document.getElementById('authSubmitBtn').onclick = handleAuthSubmit;
document.getElementById('authPassword').addEventListener('keydown', event => { if (event.key === 'Enter') handleAuthSubmit(); });
document.getElementById('authPasswordConfirm').addEventListener('keydown', event => { if (event.key === 'Enter') handleAuthSubmit(); });
document.getElementById('lockBtn').onclick = lockAdmin;
document.getElementById('changePasswordBtn').onclick = changePassword;

wireSimpleInputs();
renderAll();
setAuthMode(getPasswordRecord() ? 'login' : 'setup');
document.getElementById('authOverlay').classList.remove('hidden');
setTimeout(() => document.getElementById('authPassword').focus(), 0);
