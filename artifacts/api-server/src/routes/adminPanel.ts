import { Router } from "express";

const router = Router();

const ADMIN_KEY = process.env["ADMIN_API_KEY"] ?? "tiva-admin-2024";

router.get("/admin", (req, res) => {
  const key = req.query["key"] as string;
  if (key !== ADMIN_KEY) {
    res.status(401).send("<h2>Unauthorized. Add ?key=YOUR_ADMIN_KEY to the URL</h2>");
    return;
  }
  res.send(getAdminHTML(key));
});

function getAdminHTML(key: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TiVa Admin Panel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0a1e; color: #f8f7ff; min-height: 100vh; }
  .header { background: #1a1433; padding: 16px 24px; border-bottom: 1px solid #2d2556; display: flex; align-items: center; gap: 12px; }
  .header h1 { font-size: 22px; color: #748fff; }
  .logo { font-size: 28px; font-weight: 800; color: #748fff; }
  .container { max-width: 1200px; margin: 0 auto; padding: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
  .stat-card { background: #1a1433; border: 1px solid #2d2556; border-radius: 12px; padding: 20px; }
  .stat-value { font-size: 36px; font-weight: 800; color: #748fff; }
  .stat-label { font-size: 13px; color: #9ca3af; margin-top: 4px; }
  .section { background: #1a1433; border: 1px solid #2d2556; border-radius: 12px; padding: 20px; margin-bottom: 24px; }
  .section h2 { font-size: 17px; font-weight: 600; margin-bottom: 16px; color: #c8cff7; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; padding: 8px 12px; color: #9ca3af; border-bottom: 1px solid #2d2556; font-weight: 500; }
  td { padding: 10px 12px; border-bottom: 1px solid #2d255630; }
  tr:last-child td { border-bottom: none; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 20px; font-size: 11px; font-weight: 600; }
  .badge-free { background: #374151; color: #9ca3af; }
  .badge-premium { background: #4361ee30; color: #748fff; }
  .btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-size: 13px; font-weight: 600; }
  .btn-primary { background: #4361ee; color: white; }
  .btn-danger { background: #ef4444; color: white; }
  .toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #2d255630; }
  .toggle-row:last-child { border-bottom: none; }
  .toggle { position: relative; width: 44px; height: 24px; }
  .toggle input { opacity: 0; width: 0; height: 0; }
  .slider { position: absolute; inset: 0; background: #374151; border-radius: 24px; cursor: pointer; transition: 0.3s; }
  .slider:before { content: ""; position: absolute; height: 18px; width: 18px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
  input:checked + .slider { background: #4361ee; }
  input:checked + .slider:before { transform: translateX(20px); }
  .loading { color: #9ca3af; text-align: center; padding: 20px; }
  .refresh-btn { float: right; padding: 6px 12px; background: #2d2556; border: none; color: #c8cff7; border-radius: 8px; cursor: pointer; font-size: 12px; }
</style>
</head>
<body>
<div class="header">
  <div class="logo">TiVa</div>
  <h1>Admin Panel</h1>
</div>
<div class="container">

  <!-- Analytics -->
  <div class="grid" id="stats-grid">
    <div class="stat-card"><div class="stat-value" id="stat-students">…</div><div class="stat-label">Students</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-teachers">…</div><div class="stat-label">Teachers</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-schools">…</div><div class="stat-label">Schools</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-tests">…</div><div class="stat-label">Tests Completed</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-calls">…</div><div class="stat-label">Calls Made</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-coins">…</div><div class="stat-label">Coins Circulating</div></div>
  </div>

  <!-- Feature Flags -->
  <div class="section">
    <h2>Feature Flags <button class="refresh-btn" onclick="loadFeatures()">Refresh</button></h2>
    <div id="features-list"><div class="loading">Loading…</div></div>
    <div style="margin-top:16px; display:flex; gap:8px; flex-wrap:wrap;">
      <input id="new-flag-key" placeholder="feature key" style="padding:8px 12px;background:#0f0a1e;border:1px solid #2d2556;border-radius:8px;color:white;flex:1;min-width:150px;">
      <input id="new-flag-desc" placeholder="description" style="padding:8px 12px;background:#0f0a1e;border:1px solid #2d2556;border-radius:8px;color:white;flex:2;min-width:200px;">
      <button class="btn btn-primary" onclick="addFeatureFlag()">Add Flag</button>
    </div>
  </div>

  <!-- Students -->
  <div class="section">
    <h2>Recent Students <button class="refresh-btn" onclick="loadUsers()">Refresh</button></h2>
    <div style="overflow-x:auto;"><table>
      <thead><tr><th>Name</th><th>Grade</th><th>Board</th><th>Language</th><th>Joined</th></tr></thead>
      <tbody id="users-table"><tr><td colspan="5" class="loading">Loading…</td></tr></tbody>
    </table></div>
  </div>

  <!-- Teachers -->
  <div class="section">
    <h2>Teachers <button class="refresh-btn" onclick="loadTeachers()">Refresh</button></h2>
    <div style="overflow-x:auto;"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Subject</th><th>Grade</th><th>Joined</th></tr></thead>
      <tbody id="teachers-table"><tr><td colspan="5" class="loading">Loading…</td></tr></tbody>
    </table></div>
  </div>

  <!-- Schools -->
  <div class="section">
    <h2>Schools <button class="refresh-btn" onclick="loadSchools()">Refresh</button></h2>
    <div style="overflow-x:auto;"><table>
      <thead><tr><th>Name</th><th>Email</th><th>Board</th><th>Tier</th></tr></thead>
      <tbody id="schools-table"><tr><td colspan="4" class="loading">Loading…</td></tr></tbody>
    </table></div>
  </div>

</div>
<script>
const KEY = '${key}';
const API = '';

async function api(path) {
  const r = await fetch(API + path, { headers: { 'x-admin-key': KEY } });
  return r.json();
}

async function loadStats() {
  const d = await api('/api/admin/analytics');
  document.getElementById('stat-students').textContent = d.students;
  document.getElementById('stat-teachers').textContent = d.teachers;
  document.getElementById('stat-schools').textContent = d.schools;
  document.getElementById('stat-tests').textContent = d.testsCompleted;
  document.getElementById('stat-calls').textContent = d.callsMade;
  document.getElementById('stat-coins').textContent = d.totalCoinsCirculating;
}

async function loadFeatures() {
  const flags = await api('/api/admin/features');
  const el = document.getElementById('features-list');
  if (!flags.length) { el.innerHTML = '<div class="loading">No feature flags yet. Add one below.</div>'; return; }
  el.innerHTML = flags.map(f => \`
    <div class="toggle-row">
      <div>
        <div style="font-weight:600;font-size:14px;">\${f.key}</div>
        <div style="color:#9ca3af;font-size:12px;">\${f.description || ''}</div>
      </div>
      <div style="display:flex;gap:16px;align-items:center;">
        <div style="text-align:center;">
          <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">Free</div>
          <label class="toggle">
            <input type="checkbox" \${f.enabledForFree ? 'checked' : ''} onchange="toggleFlag('\${f.key}', 'free', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
        <div style="text-align:center;">
          <div style="font-size:10px;color:#9ca3af;margin-bottom:4px;">Premium</div>
          <label class="toggle">
            <input type="checkbox" \${f.enabledForPremium ? 'checked' : ''} onchange="toggleFlag('\${f.key}', 'premium', this.checked)">
            <span class="slider"></span>
          </label>
        </div>
      </div>
    </div>
  \`).join('');
}

async function toggleFlag(key, tier, value) {
  const flags = await api('/api/admin/features');
  const flag = flags.find(f => f.key === key);
  if (!flag) return;
  await fetch(API + '/api/admin/features', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': KEY },
    body: JSON.stringify({
      key,
      enabledForFree: tier === 'free' ? value : flag.enabledForFree,
      enabledForPremium: tier === 'premium' ? value : flag.enabledForPremium,
      description: flag.description,
    })
  });
}

async function addFeatureFlag() {
  const key = document.getElementById('new-flag-key').value.trim();
  const desc = document.getElementById('new-flag-desc').value.trim();
  if (!key) return;
  await fetch(API + '/api/admin/features', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-key': KEY },
    body: JSON.stringify({ key, enabledForFree: true, enabledForPremium: true, description: desc })
  });
  document.getElementById('new-flag-key').value = '';
  document.getElementById('new-flag-desc').value = '';
  loadFeatures();
}

async function loadUsers() {
  const users = await api('/api/admin/users');
  const tbody = document.getElementById('users-table');
  tbody.innerHTML = users.map(u => \`<tr>
    <td>\${u.name}</td>
    <td>\${u.grade}</td>
    <td>\${u.board}</td>
    <td>\${u.preferredLanguage || 'English'}</td>
    <td>\${new Date(u.createdAt).toLocaleDateString()}</td>
  </tr>\`).join('') || '<tr><td colspan="5">No students yet</td></tr>';
}

async function loadTeachers() {
  const teachers = await api('/api/admin/teachers');
  const tbody = document.getElementById('teachers-table');
  tbody.innerHTML = teachers.map(t => \`<tr>
    <td>\${t.name}</td>
    <td>\${t.email}</td>
    <td>\${t.subject || '–'}</td>
    <td>\${t.grade || '–'}</td>
    <td>\${new Date(t.createdAt).toLocaleDateString()}</td>
  </tr>\`).join('') || '<tr><td colspan="5">No teachers yet</td></tr>';
}

async function loadSchools() {
  const schools = await api('/api/admin/schools');
  const tbody = document.getElementById('schools-table');
  tbody.innerHTML = schools.map(s => \`<tr>
    <td>\${s.name}</td>
    <td>\${s.email}</td>
    <td>\${s.board || '–'}</td>
    <td><span class="badge \${s.subscriptionTier === 'free' ? 'badge-free' : 'badge-premium'}">\${s.subscriptionTier}</span></td>
  </tr>\`).join('') || '<tr><td colspan="4">No schools yet</td></tr>';
}

// Load all on start
loadStats();
loadFeatures();
loadUsers();
loadTeachers();
loadSchools();
</script>
</body>
</html>`;
}

export default router;
