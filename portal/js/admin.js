/* SureCloudVoice Admin Portal v1.2 */
const API = '';
let token = localStorage.getItem('scv_admin_token');
let admin = JSON.parse(localStorage.getItem('scv_admin') || 'null');
let route = location.hash.slice(1) || '/';

async function api(path, opts = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (token) h['Authorization'] = `Bearer ${token}`;
  const r = await fetch(API + path, { ...opts, headers: h });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'Request failed');
  return d;
}

function toast(msg, type = 'success') {
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function h(tag, a = {}, ...ch) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(a)) {
    if (k === 'className') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'htmlFor') el.setAttribute('for', v);
    else if (k === 'innerHTML') el.innerHTML = v;
    else el.setAttribute(k, v);
  }
  for (const c of ch.flat()) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); }
  return el;
}

function navigate(path) { location.hash = path; }

window.addEventListener('hashchange', () => { route = location.hash.slice(1) || '/'; render(); });

function logout() {
  token = null; admin = null;
  localStorage.removeItem('scv_admin_token');
  localStorage.removeItem('scv_admin');
  render();
}

/* ============ LOGIN ============ */
function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  const errDiv = h('div', { style: 'display:none;margin-bottom:16px;padding:10px 14px;border-radius:8px;font-size:13px;background:#FEE2E2;color:#991B1B;border:1px solid #FECACA' });
  const emailIn = h('input', { type: 'email', placeholder: 'admin@company.com', style: 'width:100%;padding:12px 16px;border:1px solid #E4E4E7;border-radius:10px;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s' });
  const passIn = h('input', { type: 'password', placeholder: 'Enter your password', style: 'width:100%;padding:12px 16px;border:1px solid #E4E4E7;border-radius:10px;font-size:14px;outline:none;font-family:inherit;transition:border-color .2s' });
  emailIn.onfocus = () => emailIn.style.borderColor = '#3B82F6';
  emailIn.onblur = () => emailIn.style.borderColor = '#E4E4E7';
  passIn.onfocus = () => passIn.style.borderColor = '#3B82F6';
  passIn.onblur = () => passIn.style.borderColor = '#E4E4E7';

  const form = h('form', { onSubmit: async (e) => {
    e.preventDefault(); errDiv.style.display = 'none';
    try {
      const d = await api('/api/admin/auth/login', { method: 'POST', body: JSON.stringify({ email: emailIn.value, password: passIn.value }) });
      token = d.token; admin = d.admin;
      localStorage.setItem('scv_admin_token', token);
      localStorage.setItem('scv_admin', JSON.stringify(admin));
      navigate('/'); render();
    } catch (err) { errDiv.textContent = err.message; errDiv.style.display = 'block'; }
  }},
    errDiv,
    h('div', { style: 'margin-bottom:20px' },
      h('label', { style: 'display:block;font-size:13px;font-weight:500;color:#52525B;margin-bottom:6px' }, 'Email address'),
      emailIn),
    h('div', { style: 'margin-bottom:24px' },
      h('label', { style: 'display:block;font-size:13px;font-weight:500;color:#52525B;margin-bottom:6px' }, 'Password'),
      passIn),
    h('button', { type: 'submit', style: 'width:100%;padding:12px;background:#CE0037;color:#fff;border:none;border-radius:10px;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;transition:background .2s' }, 'Sign In'));

  // Left side - branding panel
  const leftPanel = h('div', { style: 'flex:1;background:linear-gradient(160deg,#202A44 0%,#151d30 60%,#0a0f1a 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;min-height:100vh' },
    // Animated background orbs
    h('div', { style: 'position:absolute;width:400px;height:400px;border-radius:50%;background:rgba(206,0,55,0.08);filter:blur(100px);top:-10%;left:-10%;animation:float 20s linear infinite' }),
    h('div', { style: 'position:absolute;width:350px;height:350px;border-radius:50%;background:rgba(76,0,255,0.08);filter:blur(100px);bottom:-10%;right:-10%;animation:float 25s linear infinite reverse' }),
    h('div', { style: 'position:absolute;width:250px;height:250px;border-radius:50%;background:rgba(76,0,255,0.06);filter:blur(80px);top:40%;left:50%;animation:float 18s linear infinite' }),
    // Grid overlay
    h('div', { style: 'position:absolute;inset:0;opacity:0.03;background-image:linear-gradient(rgba(255,255,255,.1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.1) 1px,transparent 1px);background-size:50px 50px' }),
    // Content
    h('div', { style: 'position:relative;z-index:1;text-align:center;padding:40px' },
      h('img', { src: '/img/logo-horizontal.png', style: 'height:56px;margin-bottom:32px;filter:brightness(0) invert(1)' }),
      h('h2', { style: 'font-size:28px;font-weight:300;color:rgba(255,255,255,0.9);letter-spacing:-0.5px;margin-bottom:12px' }, 'Admin Portal'),
      h('p', { style: 'color:rgba(255,255,255,0.4);font-size:14px;max-width:320px;line-height:1.6' }, 'Manage your organizations, users, connections, and features from one central dashboard.'),
      h('div', { style: 'display:flex;gap:24px;margin-top:40px;justify-content:center' },
        h('div', { style: 'text-align:center' },
          h('div', { style: 'font-size:28px;font-weight:700;color:rgba(255,255,255,0.9)' }, '\u260E'),
          h('div', { style: 'font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px' }, 'Voice')),
        h('div', { style: 'text-align:center' },
          h('div', { style: 'font-size:28px;font-weight:700;color:rgba(255,255,255,0.9)' }, '\u2709'),
          h('div', { style: 'font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px' }, 'Messaging')),
        h('div', { style: 'text-align:center' },
          h('div', { style: 'font-size:28px;font-weight:700;color:rgba(255,255,255,0.9)' }, '\u2699'),
          h('div', { style: 'font-size:11px;color:rgba(255,255,255,0.4);margin-top:4px' }, 'Management')))));

  // Right side - login form
  const rightPanel = h('div', { style: 'width:480px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px;background:#fff;min-height:100vh' },
    h('div', { style: 'width:100%;max-width:360px' },
      h('img', { src: '/img/logo-horizontal.png', style: 'height:40px;margin-bottom:32px' }),
      h('h1', { style: 'font-size:26px;font-weight:700;color:#18181B;margin-bottom:4px' }, 'Welcome back'),
      h('p', { style: 'color:#71717A;font-size:14px;margin-bottom:32px' }, 'Sign in to your admin account'),
      form,
      h('div', { style: 'text-align:center;margin-top:32px' },
        h('p', { style: 'color:#A1A1AA;font-size:12px' }, 'SureCloudVoice by Sure \u00A9 2026'))));

  app.appendChild(h('div', { style: 'display:flex;min-height:100vh' }, leftPanel, rightPanel));

  // Add float animation
  const style = document.createElement('style');
  style.textContent = '@keyframes float{0%,100%{transform:translate(0,0) scale(1)}25%{transform:translate(30px,-40px) scale(1.1)}50%{transform:translate(-20px,20px) scale(.95)}75%{transform:translate(40px,30px) scale(1.05)}}';
  document.head.appendChild(style);
}

/* ============ TOPBAR ============ */
function renderTopbar() {
  return h('div', { className: 'topbar' },
    h('div', { className: 'topbar-brand' },
      h('img', { src: '/img/logo-horizontal.png', style: 'height:30px' }),
      h('div', { style: 'width:1px;height:24px;background:var(--g200);margin:0 8px' }),
      h('span', { style: 'font-size:13px;font-weight:600;color:var(--navy);letter-spacing:-0.3px' }, 'Admin Portal')),
    h('div', { className: 'topbar-actions' },
      h('div', { style: 'display:flex;align-items:center;gap:8px;padding:4px 12px;background:var(--g50);border-radius:20px;border:1px solid var(--g200)' },
        h('div', { style: 'width:8px;height:8px;border-radius:50%;background:#10B981' }),
        h('span', { style: 'font-size:12px;color:var(--g600);font-weight:500' }, admin?.name || 'Admin')),
      h('button', { onClick: logout, style: 'padding:6px 12px;border-radius:6px;font-size:12px;color:var(--g500);border:1px solid var(--g200);background:white;cursor:pointer' }, 'Sign Out')));
}

/* ============ ORGANIZATIONS LIST ============ */
async function renderOrgs() {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderTopbar());

  const page = h('div', { className: 'page' });
  app.appendChild(page);

  try {
    const orgs = await api('/api/admin/orgs');
    page.appendChild(h('div', { className: 'page-header' },
      h('h1', {}, 'Organizations ', h('span', { className: 'count' }, `(${orgs.length})`)),
      h('div', { style: 'display:flex;gap:8px' },
        h('button', { className: 'btn btn-primary', onClick: () => showImportFromPBX() }, 'Import from PBX'),
        h('button', { className: 'btn btn-ghost', onClick: () => showAddOrgModal() }, '+ Add organization'))));

    page.appendChild(h('div', { className: 'filter-bar' },
      h('div', { className: 'view-toggles' },
        h('button', { className: 'active', innerHTML: '&#9638;&#9638;' }),
        h('button', { innerHTML: '&#9776;' }),
        h('button', { innerHTML: '&#9638;' })),
      h('span', { style: 'font-size:12px;color:var(--g500)' }, 'Sort by: created'),
      h('span', { style: 'font-size:12px;color:var(--g500)' }, 'Asc'),
      h('div', { style: 'flex:1' }),
      h('div', { style: 'display:flex;align-items:center;gap:8px' },
        h('label', { style: 'font-size:12px;color:var(--g500)' }, 'Filter by'),
        h('select', {}, h('option', {}, 'All'), h('option', {}, 'Active'), h('option', {}, 'Inactive'))),
      h('input', { type: 'text', placeholder: 'Search', style: 'width:160px' })));

    const table = h('div', { className: 'table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Name'), h('th', {}, 'Domain'), h('th', {}, 'Region'), h('th', {}, 'Package'), h('th', {}, 'Created'), h('th', {}, 'Enabled'), h('th', {}, 'Actions'))),
        h('tbody', {}, ...orgs.map(o => {
          const created = o.created_at ? new Date(o.created_at).toLocaleDateString('en-US', { month:'numeric', day:'numeric', year:'2-digit', hour:'numeric', minute:'2-digit' }) : '';
          return h('tr', {},
            h('td', {}, h('a', { onClick: () => navigate(`/org/${o.id}`) }, o.name)),
            h('td', {}, o.domain || '-'),
            h('td', {}, o.region || 'Europe (London)'),
            h('td', {}, h('span', { className: `badge ${o.package === 'pro' ? 'badge-blue' : 'badge-gray'}` }, o.package || 'Essentials')),
            h('td', {}, created),
            h('td', {}, h('label', { className: 'toggle' }, h('input', { type: 'checkbox', checked: o.active ? 'checked' : undefined, onChange: async (e) => { await api(`/api/admin/orgs/${o.id}`, { method:'PUT', body:JSON.stringify({ active:e.target.checked }) }); } }), h('span', { className: 'slider' }))),
            h('td', {},
              h('button', { className: 'btn btn-sm btn-secondary', onClick: () => navigate(`/org/${o.id}`) }, 'Edit'),
              h('button', { className: 'btn btn-sm btn-danger', style:'margin-left:4px', onClick: async () => { if(confirm('Delete?')){await api(`/api/admin/orgs/${o.id}`,{method:'DELETE'});render();} } }, 'Delete')));
        }))));
    page.appendChild(table);
  } catch (err) { page.appendChild(h('p', {}, 'Error: ' + err.message)); }
}

function showAddOrgModal() {
  const ov = h('div', { className: 'modal-overlay', onClick: e => { if(e.target===ov)ov.remove(); } });
  const nameIn = h('input', { type:'text', placeholder:'Company Name' });
  const domainIn = h('input', { type:'text', placeholder:'company.com' });
  const regionIn = h('select', {}, h('option', {}, 'Europe (London)'), h('option', {}, 'Europe (Dublin)'), h('option', {}, 'US East'), h('option', {}, 'US West'));
  const pkgIn = h('select', {}, h('option', { value:'essentials' }, 'Essentials'), h('option', { value:'pro' }, 'Pro'));
  ov.appendChild(h('div', { className:'modal' },
    h('div', { className:'modal-header' }, h('h2', {}, 'Add Organization'), h('button', { className:'btn btn-ghost', onClick:()=>ov.remove() }, 'X')),
    h('div', { className:'modal-body' },
      h('div', { className:'form-row' },
        h('div', { className:'form-group' }, h('label', {}, 'Name *'), nameIn),
        h('div', { className:'form-group' }, h('label', {}, 'Domain'), domainIn)),
      h('div', { className:'form-row' },
        h('div', { className:'form-group' }, h('label', {}, 'Region'), regionIn),
        h('div', { className:'form-group' }, h('label', {}, 'Package'), pkgIn))),
    h('div', { className:'modal-footer' },
      h('button', { className:'btn btn-secondary', onClick:()=>ov.remove() }, 'Cancel'),
      h('button', { className:'btn btn-primary', onClick: async()=>{
        try { await api('/api/admin/orgs', { method:'POST', body:JSON.stringify({ name:nameIn.value, domain:domainIn.value, region:regionIn.value, package:pkgIn.value }) });
          ov.remove(); toast('Organization created'); render(); } catch(e){toast(e.message,'error');} } }, 'Create'))));
  document.body.appendChild(ov);
}

/* ============ IMPORT FROM PBX ============ */
async function showImportFromPBX() {
  const ov = h('div', { className: 'modal-overlay', onClick: e => { if(e.target===ov)ov.remove(); } });
  const modal = h('div', { className: 'modal', style: 'max-width:800px' });
  const header = h('div', { className: 'modal-header' },
    h('h2', {}, 'Import from FusionPBX'),
    h('button', { className: 'btn btn-ghost', onClick: () => ov.remove() }, 'X'));
  modal.appendChild(header);

  const body = h('div', { className: 'modal-body' });
  body.innerHTML = '<p style="color:#71717A;font-size:13px">Loading PBX domains...</p>';
  modal.appendChild(body);
  ov.appendChild(modal);
  document.body.appendChild(ov);

  try {
    const [stats, domains] = await Promise.all([
      api('/api/admin/fpbx/stats'),
      api('/api/admin/fpbx/domains'),
    ]);

    body.innerHTML = '';

    // Stats bar
    body.appendChild(h('div', { style: 'display:flex;gap:16px;margin-bottom:16px' },
      h('div', { style: 'flex:1;background:#F4F4F5;padding:12px;border-radius:8px;text-align:center' },
        h('div', { style: 'font-size:24px;font-weight:700;color:#202A44' }, String(stats.fpbx_domains)),
        h('div', { style: 'font-size:11px;color:#71717A' }, 'PBX Domains')),
      h('div', { style: 'flex:1;background:#F4F4F5;padding:12px;border-radius:8px;text-align:center' },
        h('div', { style: 'font-size:24px;font-weight:700;color:#202A44' }, String(stats.fpbx_extensions)),
        h('div', { style: 'font-size:11px;color:#71717A' }, 'Extensions')),
      h('div', { style: 'flex:1;background:#EFF6FF;padding:12px;border-radius:8px;text-align:center' },
        h('div', { style: 'font-size:24px;font-weight:700;color:#3B82F6' }, String(stats.imported_orgs)),
        h('div', { style: 'font-size:11px;color:#71717A' }, 'Imported'))));

    // Search
    const searchIn = h('input', { type: 'text', placeholder: 'Search domains...', style: 'width:100%;padding:8px 12px;border:1px solid #E4E4E7;border-radius:8px;font-size:13px;margin-bottom:12px;outline:none' });
    body.appendChild(searchIn);

    // Table container
    const tableWrap = h('div', { style: 'max-height:400px;overflow-y:auto;border:1px solid #E4E4E7;border-radius:8px' });
    body.appendChild(tableWrap);

    function renderTable(filter) {
      const filtered = filter ? domains.filter(d => d.display_name.toLowerCase().includes(filter.toLowerCase()) || d.domain_name.toLowerCase().includes(filter.toLowerCase())) : domains;
      tableWrap.innerHTML = '';
      const table = h('table', { style: 'width:100%;border-collapse:collapse' },
        h('thead', {}, h('tr', {},
          h('th', { style: 'position:sticky;top:0;background:#FAFAFA;padding:8px 12px;font-size:11px;text-align:left;border-bottom:1px solid #E4E4E7' }, 'Domain'),
          h('th', { style: 'position:sticky;top:0;background:#FAFAFA;padding:8px 12px;font-size:11px;text-align:center;border-bottom:1px solid #E4E4E7' }, 'Extensions'),
          h('th', { style: 'position:sticky;top:0;background:#FAFAFA;padding:8px 12px;font-size:11px;text-align:center;border-bottom:1px solid #E4E4E7' }, 'Status'),
          h('th', { style: 'position:sticky;top:0;background:#FAFAFA;padding:8px 12px;font-size:11px;text-align:right;border-bottom:1px solid #E4E4E7' }, 'Action'))),
        h('tbody', {}, ...filtered.map(d =>
          h('tr', { style: 'border-bottom:1px solid #F4F4F5' },
            h('td', { style: 'padding:8px 12px' },
              h('div', { style: 'font-size:13px;font-weight:500;color:#18181B' }, d.display_name),
              h('div', { style: 'font-size:11px;color:#A1A1AA' }, d.domain_name)),
            h('td', { style: 'padding:8px 12px;text-align:center;font-size:13px;color:#52525B' }, String(d.extension_count)),
            h('td', { style: 'padding:8px 12px;text-align:center' },
              d.imported
                ? h('span', { className: 'badge badge-green' }, 'Imported')
                : h('span', { className: 'badge badge-gray' }, 'Not imported')),
            h('td', { style: 'padding:8px 12px;text-align:right' },
              d.imported
                ? h('span', { style: 'font-size:12px;color:#A1A1AA' }, 'Done')
                : h('button', { className: 'btn btn-primary btn-sm', onClick: async () => {
                    if (!confirm(`Import "${d.display_name}" with ${d.extension_count} extensions?`)) return;
                    try {
                      const result = await api('/api/admin/fpbx/import-org', { method: 'POST', body: JSON.stringify({ domain_uuid: d.domain_uuid }) });
                      toast(`Imported ${d.display_name}: ${result.extensions_imported} extensions`);
                      d.imported = true;
                      renderTable(searchIn.value);
                      stats.imported_orgs++;
                    } catch (e) { toast(e.message, 'error'); }
                  }}, 'Import'))))));
      tableWrap.appendChild(table);
    }

    renderTable('');
    searchIn.addEventListener('input', () => renderTable(searchIn.value));
  } catch (err) {
    body.innerHTML = `<p style="color:#991B1B">Error: ${err.message}</p>`;
  }
}

/* ============ ORG DETAIL ============ */
async function renderOrgDetail(orgId) {
  const app = document.getElementById('app');
  app.innerHTML = '';
  app.appendChild(renderTopbar());

  let org;
  try { org = await api(`/api/admin/orgs/${orgId}`); } catch { app.appendChild(h('div', { className:'page' }, h('p', {}, 'Organization not found'))); return; }

  app.appendChild(h('div', { className:'breadcrumb' },
    h('a', { onClick:()=>navigate('/') }, 'Home'), h('span', {}, '>'), h('span', {}, org.name)));

  const tabState = { current: 'overview' };
  const page = h('div', { className:'page' });
  app.appendChild(page);

  function renderTab() {
    const tabContent = page.querySelector('.tab-content');
    if (tabContent) tabContent.remove();
    const content = h('div', { className:'tab-content' });
    page.appendChild(content);

    if (tabState.current === 'overview') renderOverviewTab(content, org, orgId);
    else if (tabState.current === 'connection') renderConnectionTab(content, org, orgId);
    else if (tabState.current === 'features') renderFeaturesTab(content, org, orgId);
    else if (tabState.current === 'devices') renderDevicesTab(content, org, orgId);
    else if (tabState.current === 'diagnostics') renderDiagnosticsTab(content, org, orgId);
    else content.appendChild(h('div', { className:'empty' }, h('p', {}, 'Coming soon')));
  }

  const tabs = h('div', { className:'tabs' });
  ['Overview','Connection','Features','Devices','Diagnostics'].forEach((label, i) => {
    const key = ['overview','connection','features','devices','diagnostics'][i];
    const btn = h('button', { className: tabState.current === key ? 'active' : '', onClick: () => {
      tabState.current = key;
      tabs.querySelectorAll('button').forEach((b,j) => b.className = ['overview','connection','features','devices','diagnostics'][j] === key ? 'active' : '');
      renderTab();
    }}, label);
    tabs.appendChild(btn);
  });
  page.appendChild(tabs);
  renderTab();
}

function renderOverviewTab(container, org, orgId) {
  const users = org.users || [];

  // Sync badge if linked to FusionPBX
  if (org.fpbx_domain_uuid) {
    const syncTime = org.fpbx_synced_at ? new Date(org.fpbx_synced_at).toLocaleString() : 'Never';
    container.appendChild(h('div', { style:'display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:10px 14px;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:8px' },
      h('span', { className:'badge badge-blue' }, 'Synced from PBX'),
      h('span', { style:'font-size:12px;color:#3B82F6' }, `Last sync: ${syncTime}`),
      h('div', { style:'flex:1' }),
      h('button', { className:'btn btn-sm btn-secondary', onClick: async () => {
        try {
          const r = await api(`/api/admin/fpbx/sync-org/${orgId}`, { method:'POST' });
          toast(`Synced: ${r.added} new, ${r.skipped} existing`);
          render();
        } catch(e) { toast(e.message, 'error'); }
      }}, 'Re-sync from PBX')));
  }

  container.appendChild(h('div', { style:'display:flex;align-items:center;justify-content:space-between;margin-bottom:16px' },
    h('h2', { style:'font-size:16px' }, `Users (${users.length})`),
    h('div', { style:'display:flex;gap:8px' },
      h('button', { className:'btn btn-ghost btn-sm', onClick:()=>showEditUserModal(null, orgId, org) }, '+ Add User'),
      h('div', { className:'view-toggles' },
        h('button', { className:'active', innerHTML:'&#9638;&#9638;' }),
        h('button', { innerHTML:'&#9776;' })))));

  const grid = h('div', { className:'cards-grid' });
  users.forEach(u => {
    const name = u.display_name || u.email;
    const ext = u.sip_username || '';
    const pres = u.presence || 'offline';
    const presColor = pres === 'online' ? '#10B981' : pres === 'busy' ? '#EF4444' : pres === 'away' ? '#F59E0B' : '#D4D4D8';
    const presText = pres === 'online' ? 'Available on PBX' : pres === 'busy' ? 'Busy' : pres === 'away' ? 'Available' : 'Offline';

    const appOnline = pres === 'online' || pres === 'away';
    grid.appendChild(h('div', { className:'user-card' },
      h('button', { className:'kebab', onClick:(e)=>showUserMenu(e, u, orgId, org) }, '\u22EE'),
      h('div', { className:'name' }, name),
      h('div', { className:'ext' }, ext),
      appOnline ? h('div', { style:'margin-top:8px;margin-bottom:4px' },
        h('span', { style:`display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:4px;font-size:11px;background:${pres==='online'?'#D1FAE5':'#FEF3C7'};color:${pres==='online'?'#065F46':'#92400E'}` },
          h('svg', { innerHTML:'<rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><line x1="8" y1="21" x2="16" y2="21" stroke="currentColor" stroke-width="1.5"/><line x1="12" y1="17" x2="12" y2="21" stroke="currentColor" stroke-width="1.5"/>', style:'width:14px;height:14px' }),
          pres === 'online' ? 'Online' : 'Available')) : null,
      h('div', { className:'presence' },
        h('div', { className:'dot', style:`background:${presColor}` }),
        h('span', {}, presText))));
  });
  container.appendChild(grid);
  if (users.length === 0) container.appendChild(h('div', { className:'empty' }, h('p', {}, 'No users yet. Add your first user.')));
}

function showEditUserModal(user, orgId, org) {
  const ov = h('div', { className:'modal-overlay', onClick: e=>{if(e.target===ov)ov.remove();} });
  const nameIn = h('input', { type:'text', value:user?.display_name||'', placeholder:'Display name' });
  const emailIn = h('input', { type:'email', value:user?.email||'', placeholder:'user@company.com' });
  const passIn = h('input', { type:'password', placeholder:user?'Leave blank to keep':'Password' });
  const extIn = h('input', { type:'text', value:user?.sip_username||'', placeholder:'1001' });
  const sipUserIn = h('input', { type:'text', value:user?.sip_username||'', placeholder:'1001' });
  const sipPassIn = h('input', { type:'password', value:user?.sip_password||'' });
  const authIn = h('input', { type:'text', value:user?.auth_id||'', placeholder:'1001' });
  const ccEnabled = h('input', { type: 'checkbox' });
  const ccMode = h('select', {},
    h('option', { value: 'auto' }, 'Auto detect from extension'),
    h('option', { value: 'manual' }, 'Manual agent select')
  );
  const ccAgent = h('select', {}, h('option', { value: '' }, 'Loading agents...'));
  const ccHelp = h('div', { className:'hint' }, 'Maps this app user to a FusionPBX call-center agent.');

  const hasFpbxDomain = !!org?.fpbx_domain_uuid;
  if (!hasFpbxDomain) {
    ccEnabled.disabled = true;
    ccMode.disabled = true;
    ccAgent.disabled = true;
    ccHelp.textContent = 'Call center mode requires this organization to be linked to FusionPBX first.';
  } else {
    api(`/api/admin/fpbx/call-center/agents?domain_uuid=${encodeURIComponent(org.fpbx_domain_uuid)}`)
      .then((agents) => {
        ccAgent.innerHTML = '';
        ccAgent.appendChild(h('option', { value: '' }, 'Select call-center agent'));
        agents.forEach((a) => {
          const label = `${a.agent_id || '?'} - ${a.agent_name || 'Unnamed'} (${a.agent_status || 'Unknown'})`;
          ccAgent.appendChild(h('option', { value: a.call_center_agent_uuid }, label));
        });
      })
      .catch(() => {
        ccAgent.innerHTML = '';
        ccAgent.appendChild(h('option', { value: '' }, 'Failed to load agents'));
      });
  }

  if (user?.id) {
    api(`/api/admin/fpbx/call-center/user-link/${user.id}`)
      .then((link) => {
        ccEnabled.checked = !!link.enabled;
        ccMode.value = link.mode === 'manual' ? 'manual' : 'auto';
        const selected = link.linkedAgent?.call_center_agent_uuid || '';
        if (selected) ccAgent.value = selected;
      })
      .catch(() => {});
  }

  ov.appendChild(h('div', { className:'modal' },
    h('div', { className:'modal-header' },
      h('h2', {}, user ? 'Edit user' : 'Add user'),
      h('span', { style:'color:var(--g400);font-size:13px' }, user ? '' : '')),
    h('div', { className:'modal-body' },
      h('div', { className:'form-row' },
        h('div', { className:'form-group' }, h('label', {}, 'Display name *'), nameIn, h('div', { className:'hint' }, 'Visible to all team members.')),
        h('div', { className:'form-group' }, h('label', {}, 'User email'), emailIn)),
      h('div', { className:'form-row' },
        h('div', { className:'form-group' }, h('label', {}, 'PBX extension *'), extIn, h('div', { className:'hint' }, "Configured on your PBX for this user.")),
        h('div', { className:'form-group' }, h('label', {}, 'SIP password'), sipPassIn, h('div', { className:'hint' }, "SIP password configured on your PBX."))),
      h('div', { className:'form-row' },
        h('div', { className:'form-group' }, h('label', {}, 'SIP username'), sipUserIn, h('div', { className:'hint' }, "If different from the PBX extension.")),
        h('div', { className:'form-group' }, h('label', {}, 'Authorization name'), authIn, h('div', { className:'hint' }, "If different from SIP username."))),
      h('div', { className:'form-row' },
        h('div', { className:'form-group' },
          h('label', { style:'display:flex;align-items:center;gap:8px' },
            ccEnabled,
            h('span', {}, 'Enable call center mode')
          ),
          ccHelp),
        h('div', { className:'form-group' },
          h('label', {}, 'Call center mapping mode'),
          ccMode,
          h('div', { className:'hint' }, 'Auto maps by extension; manual lets you pick a specific agent.'))),
      h('div', { className:'form-group' },
        h('label', {}, 'Call center agent'),
        ccAgent,
        h('div', { className:'hint' }, 'Required in manual mode.')),
      !user ? h('div', { className:'form-group' }, h('label', {}, 'Password'), passIn) : null,
      h('a', { style:'color:var(--blue);font-size:13px;cursor:pointer' }, 'Show more fields')),
    h('div', { className:'modal-footer' },
      h('button', { className:'btn btn-secondary', onClick:()=>ov.remove() }, 'Close'),
      h('button', { className:'btn btn-primary', onClick: async()=>{
        try {
          const sipFields = {
            sip_extension: extIn.value,
            sip_username: sipUserIn.value || extIn.value,
            sip_password: sipPassIn.value,
            auth_id: authIn.value
          };
          if (user) {
            const body = { display_name:nameIn.value, email:emailIn.value, ...sipFields };
            if(passIn.value) body.password = passIn.value;
            await api(`/api/admin/users/${user.id}`, { method:'PUT', body:JSON.stringify(body) });
            if (hasFpbxDomain) {
              await api(`/api/admin/fpbx/call-center/user-link/${user.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                  enabled: !!ccEnabled.checked,
                  mode: ccMode.value,
                  call_center_agent_uuid: ccAgent.value || null,
                })
              });
            }
          } else {
            if(!passIn.value||!emailIn.value) { toast('Email and password required','error'); return; }
            const created = await api('/api/admin/users', { method:'POST', body:JSON.stringify({
              email:emailIn.value, password:passIn.value, display_name:nameIn.value, tenant_id:orgId, ...sipFields }) });
            if (hasFpbxDomain && created?.id) {
              await api(`/api/admin/fpbx/call-center/user-link/${created.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                  enabled: !!ccEnabled.checked,
                  mode: ccMode.value,
                  call_center_agent_uuid: ccAgent.value || null,
                })
              });
            }
          }
          ov.remove(); toast(user?'User updated':'User created'); render();
        } catch(e){toast(e.message,'error');} } }, 'Save'))));
  document.body.appendChild(ov);
}

/* ============ USER CONTEXT MENU ============ */
function showUserMenu(event, user, orgId, org) {
  event.stopPropagation();
  document.querySelectorAll('.user-popup-menu').forEach(el => el.remove());

  const menu = h('div', { className: 'user-popup-menu', style: 'position:fixed;z-index:200;background:white;border:1px solid var(--g200);border-radius:8px;box-shadow:0 8px 30px rgba(0,0,0,0.12);min-width:180px;padding:4px;animation:fadeIn 0.15s' },
    h('button', { style: 'display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;cursor:pointer;font-size:13px;color:var(--g700);border-radius:6px;text-align:left;font-family:inherit', onMouseover: (e) => e.target.style.background='var(--g50)', onMouseout: (e) => e.target.style.background='none',
      onClick: () => { menu.remove(); showEditUserModal(user, orgId, org); } }, 'Edit user'),
    h('button', { style: 'display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;cursor:pointer;font-size:13px;color:var(--g700);border-radius:6px;text-align:left;font-family:inherit', onMouseover: (e) => e.target.style.background='var(--g50)', onMouseout: (e) => e.target.style.background='none',
      onClick: () => { menu.remove(); showResetPasswordModal(user); } }, 'Reset password'),
    h('button', { style: 'display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;cursor:pointer;font-size:13px;color:var(--g700);border-radius:6px;text-align:left;font-family:inherit', onMouseover: (e) => e.target.style.background='var(--g50)', onMouseout: (e) => e.target.style.background='none',
      onClick: () => { menu.remove(); showInviteModal(user); } }, 'Send invite email'),
    h('div', { style: 'height:1px;background:var(--g100);margin:4px 0' }),
    h('button', { style: 'display:flex;align-items:center;gap:8px;width:100%;padding:8px 12px;border:none;background:none;cursor:pointer;font-size:13px;color:#EF4444;border-radius:6px;text-align:left;font-family:inherit', onMouseover: (e) => e.target.style.background='#FEF2F2', onMouseout: (e) => e.target.style.background='none',
      onClick: async () => { menu.remove(); if(confirm('Delete user?')){try{await api(`/api/admin/users/${user.id}`,{method:'DELETE'});toast('User deleted');render();}catch(e){toast(e.message,'error');}} } }, 'Delete user'));

  const rect = event.target.getBoundingClientRect();
  menu.style.top = rect.bottom + 4 + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 200) + 'px';
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
}

function showResetPasswordModal(user) {
  const ov = h('div', { className: 'modal-overlay', onClick: e => { if(e.target===ov)ov.remove(); } });
  const name = user.display_name || user.email;
  const emailIn = h('input', { type: 'email', value: user.email || '', placeholder: 'Send reset to this email' });

  ov.appendChild(h('div', { className: 'modal', style: 'max-width:480px' },
    h('div', { className: 'modal-header' },
      h('h2', {}, 'Reset password'),
      h('button', { className: 'btn btn-ghost', onClick: () => ov.remove() }, 'X')),
    h('div', { className: 'modal-body' },
      h('p', { style: 'color:var(--g500);font-size:14px;margin-bottom:20px' }, 'Are you sure you want to reset the password for this user?'),
      h('div', { className: 'form-row' },
        h('div', { className: 'form-group' },
          h('label', {}, 'Display name *'),
          h('input', { type: 'text', value: name, disabled: 'true', style: 'background:var(--g50)' })),
        h('div', { className: 'form-group' },
          h('label', {}, 'Send to email'),
          emailIn))),
    h('div', { className: 'modal-footer' },
      h('button', { className: 'btn btn-secondary', onClick: () => ov.remove() }, 'Close'),
      h('button', { className: 'btn btn-primary', onClick: async () => {
        try {
          const r = await api('/api/admin/email/reset-password', { method: 'POST', body: JSON.stringify({ user_id: user.id, custom_email: emailIn.value }) });
          ov.remove();
          toast(r.message || 'Password reset email sent');
        } catch(e) { toast(e.message, 'error'); }
      }}, 'Confirm'))));
  document.body.appendChild(ov);
}

function showInviteModal(user) {
  const ov = h('div', { className: 'modal-overlay', onClick: e => { if(e.target===ov)ov.remove(); } });
  const name = user.display_name || user.email;
  const emailIn = h('input', { type: 'email', value: user.email || '', placeholder: 'Send invite to this email' });

  ov.appendChild(h('div', { className: 'modal', style: 'max-width:480px' },
    h('div', { className: 'modal-header' },
      h('h2', {}, 'Send invite email'),
      h('button', { className: 'btn btn-ghost', onClick: () => ov.remove() }, 'X')),
    h('div', { className: 'modal-body' },
      h('p', { style: 'color:var(--g500);font-size:14px;margin-bottom:20px' }, `Send a welcome email to ${name} with their login credentials and a download link.`),
      h('div', { className: 'form-row' },
        h('div', { className: 'form-group' },
          h('label', {}, 'Display name'),
          h('input', { type: 'text', value: name, disabled: 'true', style: 'background:var(--g50)' })),
        h('div', { className: 'form-group' },
          h('label', {}, 'Send to email'),
          emailIn))),
    h('div', { className: 'modal-footer' },
      h('button', { className: 'btn btn-secondary', onClick: () => ov.remove() }, 'Close'),
      h('button', { className: 'btn btn-primary', onClick: async () => {
        try {
          const r = await api('/api/admin/email/invite', { method: 'POST', body: JSON.stringify({ user_id: user.id, custom_email: emailIn.value }) });
          ov.remove();
          toast(r.message || 'Invite email sent');
        } catch(e) { toast(e.message, 'error'); }
      }}, 'Send invite'))));
  document.body.appendChild(ov);
}

/* ============ CONNECTION TAB ============ */
function renderConnectionTab(container, org, orgId) {
  const fields = {};

  function field(key, label, hint, value, type='text', opts) {
    const inp = type === 'select'
      ? h('select', {}, ...(opts||[]).map(o => { const op = h('option', { value:o.value||o }, o.label||o); if((value||'')===String(o.value||o)) op.selected=true; return op; }))
      : h('input', { type, value:value||'', placeholder:hint||'' });
    fields[key] = inp;
    return h('div', { className:'form-group' }, h('label', {}, label), inp, hint && type!=='select' ? h('div', { className:'hint' }, hint) : null);
  }

  container.appendChild(h('div', { style:'display:flex;align-items:center;justify-content:space-between;margin-bottom:24px' },
    h('h2', { style:'font-size:20px;font-weight:600' }, 'Connection'),
    h('div', { style:'display:flex;gap:8px' },
      h('button', { className:'btn btn-secondary', innerHTML:'&#8635;' }),
      h('button', { className:'btn btn-primary', onClick: async()=>{
        const body = {};
        for(const[k,inp] of Object.entries(fields)) body[k] = inp.value || inp.checked;
        try { await api(`/api/admin/orgs/${orgId}`, { method:'PUT', body:JSON.stringify(body) }); toast('Connection saved'); } catch(e){toast(e.message,'error');} }
      }, 'Save changes'))));

  const grid = h('div', { className:'connection-grid' });

  grid.appendChild(h('div', {},
    h('div', { className:'connection-label' }, 'Connection settings'),
    h('div', { className:'connection-desc' }, 'These settings are applied for connections between a softphone and a VoIP server.')));

  grid.appendChild(h('div', {},
    h('div', { className:'form-row' },
      field('connection_name', 'Connection name', 'Enter a name for this connection', org.connection_name||org.name),
      field('sip_protocol', 'Protocol', '', org.sip_protocol||'udp', 'select', [{value:'udp',label:'SIP (UDP)'},{value:'tcp',label:'SIP (TCP)'},{value:'tls',label:'SIP (TLS)'}])),
    h('div', { className:'form-row' },
      field('sip_domain', 'Domain or IP address', 'Please configure your firewall if it restricts access to this server.', org.sip_domain||''),
      field('sip_port', 'SIP port', '5060', org.sip_port||'5060')),
    h('div', { className:'form-row' },
      field('country_code', 'Country', 'Default country code for this connection', org.country_code||'+44'),
      h('div', { className:'form-group' }, h('label', {}, 'Reformat inbound numbers'), h('select', {}, h('option', {}, '+E.164'), h('option', {}, 'National'))))));

  container.appendChild(grid);

  // Collapsible sections
  ['Outbound (SIP) Proxy','Audio codecs','Security','Miscellaneous','SIP Headers'].forEach(title => {
    const sec = h('div', { className:'collapsible' });
    const header = h('div', { className:'collapsible-header', onClick:()=>sec.classList.toggle('open') }, h('span', {}, title), h('span', {}, '\u25BC'));
    sec.appendChild(header);
    sec.appendChild(h('div', { className:'collapsible-body' }, h('p', { style:'color:var(--g400);font-size:13px' }, 'Configure ' + title.toLowerCase() + ' settings here.')));
    container.appendChild(sec);
  });

  // App settings
  container.appendChild(h('div', { style:'margin-top:24px' }));
  const appGrid = h('div', { className:'connection-grid' });
  appGrid.appendChild(h('div', {},
    h('div', { className:'connection-label' }, 'App settings'),
    h('div', { className:'connection-desc' }, 'These settings will be applied to all users of this connection profile.')));
  appGrid.appendChild(h('div', {},
    field('max_registrations', 'Max. registrations per user', 'Max. number of parallel registrations per softphone user', org.max_registrations||'6'),
    field('https_proxy', 'HTTPS Proxy', 'HTTPS proxy server address', org.https_proxy||''),
    field('ringback_tone', 'Ringback tone', '', org.ringback_tone||'United Kingdom', 'select', ['United Kingdom','United States','Germany','France','Australia']),
    h('div', { style:'margin-top:12px' },
      h('label', { style:'display:flex;align-items:center;gap:8px;font-size:13px;cursor:pointer' },
        h('input', { type:'checkbox', checked:org.opus_codec?'checked':undefined }), 'Use OPUS audio codec'),
      h('div', { className:'hint', style:'margin-left:24px' }, 'Enabling OPUS improves call quality on low bandwidth networks, but may cause small audio delays.'))));
  container.appendChild(appGrid);
}

/* ============ FEATURES TAB ============ */
function renderFeaturesTab(container, org, orgId) {
  const settings = org.settings || {};
  const toggles = {};

  function toggle(key, label, desc, defaultVal) {
    const checked = (settings[key] || defaultVal || 'false') === 'true';
    const inp = h('input', { type:'checkbox', checked:checked?'checked':undefined, onChange: async(e)=>{
      try { await api(`/api/admin/orgs/${orgId}/settings`, { method:'PUT', body:JSON.stringify({[key]:String(e.target.checked)}) }); }catch{} } });
    toggles[key] = inp;
    return h('div', { className:'feature-row' },
      h('div', {},
        h('div', { className:'label' }, label),
        desc ? h('div', { className:'desc' }, desc) : null),
      h('div', { className:'right' },
        h('label', { className:'toggle' }, inp, h('span', { className:'slider' }))));
  }

  // AI Assistant
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'AI Assistant'),
    h('p', {}, 'Live call transcription powered by AssemblyAI. Transcribes calls in real-time and allows users to save, email, and review transcripts.'),
    toggle('ai_enabled', 'Enable AI Assistant', 'When enabled, users can start live transcription during calls.'),
    toggle('save_transcriptions', 'Save call transcriptions', 'Automatically save transcriptions to the server for later review.')));

  // SMS Settings
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'SMS Settings'),
    h('p', {}, 'Enable SMS functionality to allow users to send and receive SMS and MMS messages.'),
    toggle('enable_sms', 'Enable SMS', 'After the change, logged in users will need to log in again.'),
    toggle('sms_missed_notifications', 'Send missed SMS, voicemail and call notifications to email', 'When users are offline, send notifications to email about missed SMS, voicemail, or calls.'),
    toggle('sms_forward_sip', 'Send SMS to connected SIP endpoints', 'Forward incoming SMS to connected SIP endpoints if no softphone is registered.')));

  // Apps Features
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'Apps Features'),
    h('p', {}, 'These settings will be applied to all users of this connection profile.'),
    toggle('allow_call_settings', 'Show call settings', 'Allow users to configure call settings like forwarding, voicemail, call waiting.'),
    toggle('allow_recording', 'Allow call recording', 'Allow users to record calls. You are responsible for compliance with recording laws.'),
    toggle('allow_state_change', 'Allow state change', 'Allow users to change their state (Online/DND/At the desk).'),
    toggle('allow_video', 'Allow video calls', 'Allow users to make 1-on-1 video calls.'),
    toggle('allow_chat', 'Allow internal chat', 'Allow users to use internal chat feature and create new chats.'),
    toggle('allow_block_numbers', 'Allow to block numbers', 'Allow users to block numbers.'),
    toggle('allow_password_change', 'Allow to change password', 'Allow users to change their password.'),
    toggle('screenshot_prevention', 'Screenshot prevention', 'Users will not be able to take screenshots (Windows only).')));

  // Call Settings
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'Call Settings'),
    h('p', {}, 'These settings will be applied to all users of this connection profile.'),
    h('div', { className:'feature-row' },
      h('div', {},
        h('div', { className:'label' }, '"At the desk" status call delay'),
        h('div', { className:'desc' }, 'Delay incoming calls to the desktop app')),
      h('div', { className:'right' },
        h('input', { type:'number', value:settings.desk_call_delay||'12', style:'width:60px;padding:4px 8px;border:1px solid var(--g300);border-radius:4px;font-size:13px', onChange:async(e)=>{
          await api(`/api/admin/orgs/${orgId}/settings`,{method:'PUT',body:JSON.stringify({desk_call_delay:e.target.value})}).catch(()=>{});
        }}), h('span', { style:'font-size:12px;color:var(--g500)' }, 'seconds'))),
    toggle('auto_answer', 'Auto-answer calls', 'Enable auto-answer for all incoming calls (desktop app only).')));

  // Visual Call Park
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'Visual Call Park'),
    h('p', {}, 'Streamline Call Park for users by providing a simple way of parking calls without dialing feature codes.'),
    h('div', { className:'form-row', style:'margin-top:8px' },
      h('div', { className:'form-group' }, h('label', {}, 'Call Park prefix'), h('input', { type:'text', value:settings.call_park_prefix||'', placeholder:'e.g. *68' })),
      h('div', { className:'form-group' }, h('label', {}, 'Call Park Retrieve prefix'), h('input', { type:'text', value:settings.call_park_retrieve_prefix||'' }))),
    h('div', { className:'form-group' }, h('label', {}, 'BLF subscription prefix'), h('input', { type:'text', value:settings.call_park_blf_prefix||'', style:'width:50%' }))));

  // PBX Features
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'PBX Features'),
    h('p', {}, 'Provide feature codes configured on your PBX.'),
    toggle('utilize_pbx_features', 'Utilize PBX features', 'Handle features on the PBX. Ensure you provide shortcodes.'),
    toggle('visual_paging', 'Visual Paging', 'Record paging messages and deliver as voice recordings.')));

  // Speed Dial & BLF
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'Speed Dial Numbers & Features BLF Indicators'),
    h('p', {}, 'Add BLF indicators and speed dial numbers for users on this connection.'),
    h('div', { style:'margin-top:8px' },
      h('strong', { style:'font-size:13px' }, 'BLF buttons'),
      h('div', { className:'hint' }, 'We recommend adding BLF indicators only for PBX features.'),
      h('button', { className:'btn btn-ghost btn-sm', style:'margin-top:8px', onClick:()=>{ toast('Add BLF button UI - save from connection'); } }, '+ Add BLF button')),
    h('div', { style:'margin-top:16px' },
      h('strong', { style:'font-size:13px' }, 'Speed Dial buttons'),
      h('button', { className:'btn btn-ghost btn-sm', style:'margin-top:8px' }, '+ Add Speed Dial')),
    h('div', { style:'margin-top:16px' },
      h('strong', { style:'font-size:13px' }, 'Emergency Numbers'),
      h('div', { className:'hint' }, 'Calls to emergency numbers are made through the native cellular dialer.'),
      h('div', { className:'form-group', style:'margin-top:8px' }, h('label', {}, 'Emergency Numbers'), h('input', { type:'text', placeholder:'999, 112, 911' })))));

  // Miscellaneous
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'Miscellaneous'),
    h('div', { className:'feature-row' },
      h('div', {}, h('div', { className:'label' }, 'Users visibility'), h('div', { className:'desc' }, 'Set visibility level for users of this connection.')),
      h('div', { className:'right' }, h('select', { style:'padding:4px 8px;border:1px solid var(--g300);border-radius:4px;font-size:12px' }, h('option', {}, 'Default'), h('option', {}, 'All'), h('option', {}, 'Organization only')))),
    toggle('disable_iphone_recents', 'Disable call history syncing in iPhone Recents', ''),
    toggle('dont_log_answered_elsewhere', "Don't log \"Answered elsewhere\"", 'Users will not receive notifications about calls answered by other extensions.'),
    toggle('dont_log_missed', "Don't log Missed calls", 'Users will not receive missed call notifications.'),
    toggle('dont_notify_updates', 'Do not notify about updates (Desktop app only)', ''),
    toggle('beta_updates', 'Subscribe for beta updates (Desktop app only)', '')));
}

/* ============ DEVICES TAB ============ */
async function renderDevicesTab(container, org, orgId) {
  container.appendChild(h('div', { style:'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px' },
    h('h2', { style:'font-size:16px' }, 'Connected Devices'),
    h('div', { style:'display:flex;gap:8px' },
      h('button', { className:'btn btn-sm btn-danger', onClick: async()=>{ if(confirm('Force logout ALL users in this org?')){try{const r=await api(`/api/admin/devices/force-logout-all/${orgId}`,{method:'POST'});toast(`Logged out ${r.devices_notified} devices`);}catch(e){toast(e.message,'error');}} } }, 'Force Logout All'),
      h('button', { className:'btn btn-sm btn-secondary', onClick: async()=>{ try{const r=await api(`/api/admin/devices/push-config/${orgId}`,{method:'POST'});toast(`Config pushed to ${r.devices_notified} devices`);}catch(e){toast(e.message,'error');} } }, 'Push Config All'))));

  try {
    const devices = await api(`/api/admin/devices/org/${orgId}`);
    if (devices.length === 0) { container.appendChild(h('div', { className:'empty' }, h('p', {}, 'No devices registered yet.'))); return; }

    container.appendChild(h('div', { className:'table-wrap' },
      h('table', {},
        h('thead', {}, h('tr', {},
          h('th', {}, 'Status'), h('th', {}, 'User'), h('th', {}, 'Device'), h('th', {}, 'App Version'), h('th', {}, 'OS'), h('th', {}, 'Last Seen'), h('th', {}, 'Actions'))),
        h('tbody', {}, ...devices.map(d => {
          const lastSeen = d.last_seen ? new Date(d.last_seen).toLocaleString() : '-';
          return h('tr', {},
            h('td', {}, h('span', { style:`display:inline-block;width:10px;height:10px;border-radius:50%;background:${d.online?'#10B981':'#D4D4D8'}` })),
            h('td', {}, h('div', {}, d.display_name || d.email), h('div', { style:'font-size:11px;color:var(--g400)' }, d.email)),
            h('td', {}, d.device_name || 'SureCloudVoice'),
            h('td', {}, h('span', { className:'badge badge-blue' }, d.app_version || 'unknown')),
            h('td', { style:'font-size:12px;color:var(--g500)' }, d.os_version || '-'),
            h('td', { style:'font-size:12px;color:var(--g500)' }, lastSeen),
            h('td', {},
              h('button', { className:'btn btn-sm btn-secondary', style:'margin-right:4px', onClick: async()=>{ try{await api(`/api/admin/devices/force-logout/${d.user_id}`,{method:'POST'});toast('Force logout sent');}catch(e){toast(e.message,'error');} } }, 'Logout'),
              h('button', { className:'btn btn-sm btn-danger', onClick: async()=>{ if(confirm('Wipe device config?')){try{await api(`/api/admin/devices/wipe/${d.user_id}`,{method:'POST'});toast('Wipe command sent');}catch(e){toast(e.message,'error');}} } }, 'Wipe'),
              h('button', { className:'btn btn-sm btn-secondary', onClick: async()=>{ try{await api(`/api/admin/devices/restart/${d.user_id}`,{method:'POST'});toast('Restart sent');}catch(e){toast(e.message,'error');} } }, 'Restart')));
        })))));
  } catch (err) { container.appendChild(h('p', { style:'color:red' }, 'Error: ' + err.message)); }
}

/* ============ DIAGNOSTICS TAB ============ */
async function renderDiagnosticsTab(container, org, orgId) {
  // SIP Trace section
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'SIP Trace Capture'),
    h('p', {}, 'Capture SIP traffic on a FusionPBX node for a specific extension. The capture runs for the specified duration and the pcap file can be downloaded.'),
    h('div', { className:'form-row', style:'margin-top:12px' },
      h('div', { className:'form-group' },
        h('label', {}, 'PBX Node'),
        h('select', { id:'diag-node' }, h('option', { value:'edge1' }, 'Edge1 (13.41.211.239)'), h('option', { value:'edge2' }, 'Edge2 (13.41.98.214)'), h('option', { value:'edge3' }, 'Edge3 (18.169.36.148)'), h('option', { value:'edge4' }, 'Edge4 (3.9.212.87)'), h('option', { value:'edge5' }, 'Edge5 (3.11.44.219)'))),
      h('div', { className:'form-group' },
        h('label', {}, 'Extension'),
        h('input', { type:'text', id:'diag-ext', placeholder:'1000' }))),
    h('div', { className:'form-row' },
      h('div', { className:'form-group' },
        h('label', {}, 'Duration (seconds)'),
        h('input', { type:'number', id:'diag-dur', value:'10', style:'width:80px' })),
      h('div', { style:'display:flex;align-items:flex-end;padding-bottom:16px' },
        h('button', { className:'btn btn-primary', onClick: async()=>{
          const node = document.getElementById('diag-node').value;
          const ext = document.getElementById('diag-ext').value;
          const dur = document.getElementById('diag-dur').value;
          if(!ext){toast('Enter an extension','error');return;}
          try{const r=await api('/api/admin/diagnostics/sip-capture',{method:'POST',body:JSON.stringify({node_id:node,extension:ext,duration:parseInt(dur)})});toast(r.message);setTimeout(()=>render(),parseInt(dur)*1000+3000);}catch(e){toast(e.message,'error');}
        }}, 'Start Capture')))));

  // App Log Request
  const users = org.users || [];
  container.appendChild(h('div', { className:'feature-section' },
    h('h3', {}, 'Request App SIP Log'),
    h('p', {}, 'Request a SIP log from a connected user device. The log will be uploaded to the server.'),
    h('div', { className:'form-row', style:'margin-top:12px' },
      h('div', { className:'form-group' },
        h('label', {}, 'User'),
        h('select', { id:'diag-user' }, ...users.map(u => h('option', { value:u.id }, `${u.display_name||u.email} (${u.sip_username||'?'})`)))),
      h('div', { style:'display:flex;align-items:flex-end;padding-bottom:16px' },
        h('button', { className:'btn btn-secondary', onClick: async()=>{
          const uid = document.getElementById('diag-user').value;
          if(!uid){toast('Select a user','error');return;}
          try{const r=await api(`/api/admin/diagnostics/request-log/${uid}`,{method:'POST'});toast(r.message);}catch(e){toast(e.message,'error');}
        }}, 'Request Log')))));

  // Recent logs
  try {
    const logs = await api('/api/admin/diagnostics/logs');
    container.appendChild(h('div', { className:'feature-section' },
      h('h3', {}, `Recent Captures & Logs (${logs.length})`),
      logs.length > 0 ? h('div', { className:'table-wrap' },
        h('table', {},
          h('thead', {}, h('tr', {}, h('th', {}, 'Type'), h('th', {}, 'User'), h('th', {}, 'Node/Ext'), h('th', {}, 'Status'), h('th', {}, 'Size'), h('th', {}, 'Date'), h('th', {}, 'Action'))),
          h('tbody', {}, ...logs.map(l => {
            const size = l.file_size ? `${(l.file_size/1024).toFixed(1)} KB` : '-';
            return h('tr', {},
              h('td', {}, h('span', { className:`badge ${l.log_type==='sip_capture'?'badge-blue':'badge-green'}` }, l.log_type === 'sip_capture' ? 'Capture' : 'App Log')),
              h('td', {}, l.display_name || l.email || '-'),
              h('td', { style:'font-size:12px' }, `${l.node||'-'} / ${l.extension||'-'}`),
              h('td', {}, h('span', { className:`badge ${l.status==='complete'?'badge-green':l.status==='capturing'?'badge-orange':'badge-gray'}` }, l.status)),
              h('td', { style:'font-size:12px' }, size),
              h('td', { style:'font-size:12px;color:var(--g500)' }, new Date(l.created_at).toLocaleString()),
              h('td', {}, l.status === 'complete' ? h('a', { href:`/api/admin/diagnostics/logs/${l.id}/download`, className:'btn btn-sm btn-ghost', target:'_blank' }, 'Download') : h('span', { style:'font-size:11px;color:var(--g400)' }, '...')));
          }))))
        : h('p', { style:'color:var(--g400);font-size:13px' }, 'No captures yet.')));
  } catch {}
}

/* ============ ROUTER ============ */
async function render() {
  if (!token || !admin) { renderLogin(); return; }
  const parts = route.split('/').filter(Boolean);

  if (parts[0] === 'org' && parts[1]) {
    await renderOrgDetail(parts[1]);
  } else {
    await renderOrgs();
  }
}

render();
