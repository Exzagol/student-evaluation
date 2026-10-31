/* ════════════════════════════════════════════
   DATA LAYER — localStorage
   ════════════════════════════════════════════ */
const STORE_KEY = 'eval_system_v1';

async function load() {
  try {
      const snap = await window.getDoc(
      window.doc(window.db, "system", "main")
    );

    if (snap.exists()) {
  const data = snap.data();

      data.groups = data.groups || [];
      data.criteria = data.criteria || [];
      data.evaluators = data.evaluators || [];
      data.scores = data.scores || {};

    return data;
  }

    return defaultData();
  }
  catch (e) {
    console.error(e);
    return defaultData();
  }
}
async function save(data) {

  console.log("SAVE WORKING");

  try {
    await window.setDoc(
      window.doc(window.db, "system", "main"),
      data
    );

    console.log("Firestore save success");

  } catch (e) {
    console.error("Firestore save error:", e);
  }
}
  function defaultData() {
    return {
      adminPassword: '',          // ตั้งตอน setup
      adminName: '',
      evaluators: [],             // [{ id, name, password }]
      groups: [],                 // [{ id, name, members:[] }]
      criteria: [],               // [{ id, name, max }]
      scores: {}                  // "evId__groupId__critId" -> value
    };
  }

/* ════════════════════════════════════════════
   SESSION — เก็บไว้ใน sessionStorage เพื่อให้รีเฟรชแล้วไม่หลุด
   หมายเหตุ: ปิดแท็บ/เบราว์เซอร์แล้วจะต้องเข้าสู่ระบบใหม่
   ════════════════════════════════════════════ */
const SESSION_KEY = 'eval_login_session_v1';
let session = { role: null, evId: null, name: '' };

function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}
function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
  session = { role: null, evId: null, name: '' };
}
function restoreSession(d) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!saved) return false;

    if (saved.role === 'admin' && d.adminPassword) {
      session = { role: 'admin', evId: null, name: d.adminName || saved.name || '' };
      return true;
    }

    if (saved.role === 'evaluator') {
      const ev = d.evaluators.find(e => e.id === saved.evId);
      if (ev) {
        session = { role: 'evaluator', evId: ev.id, name: ev.name };
        return true;
      }
    }
  } catch (e) {
    console.warn('ไม่สามารถกู้คืน session ได้:', e);
  }
  clearSession();
  return false;
}
// role: 'setup' | 'admin' | 'evaluator'

/* ════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════ */
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const uid  = () => Math.random().toString(36).slice(2, 10);
const app  = () => document.getElementById('app');
const set  = html => { app().innerHTML = html; };

/* ════════════════════════════════════════════
   BOOT
   ════════════════════════════════════════════ */
async function boot() {
  const d = await load();

  if (!d.adminPassword) {
    clearSession();
    drawSetup();
    return;
  }

  if (restoreSession(d)) {
    if (session.role === 'admin') {
      await drawAdmin();
    } else if (session.role === 'evaluator') {
      await drawEvaluator();
    }
    return;
  }

  drawLogin(d);
}

/* ════════════════════════════════════════════
   SETUP (ครั้งแรก)
   ════════════════════════════════════════════ */
function drawSetup() {
  set(`
    <div id="app">
    <div class="card" style="max-width:440px;margin:60px auto;">
      <h2>ตั้งค่าระบบครั้งแรก</h2>
      <p class="sub" style="margin-bottom:18px">กำหนดบัญชีแอดมินและรหัสผ่านผู้ประเมิน</p>
      <div id="errSetup"></div>
      <div class="field"><label>ชื่อแอดมิน</label><input id="sAdminName" type="text" placeholder="เช่น ครูสมชาย"></div>
      <div class="field"><label>รหัสผ่านแอดมิน</label><input id="sAdminPw" type="password" placeholder="ตั้งรหัสผ่านแอดมิน"></div>
      <hr class="sep">
      <p style="font-size:13px;font-weight:600;margin-bottom:10px;">ผู้ประเมิน (สูงสุด 4 คน)</p>
      <div class="ev-list" id="evInputs">
        ${[1,2,3,4].map(i=>`
        <div class="ev-item">
          <input type="text"     id="evName${i}" placeholder="ชื่อผู้ประเมิน ${i}">
          <input type="password" id="evPw${i}"   placeholder="รหัสผ่าน">
          <span></span>
        </div>`).join('')}
      </div>
      <button class="btn btn-primary" style="margin-top:18px;width:100%" onclick="doSetup()">เริ่มใช้งาน →</button>
    </div></div>
  `);
}

window.doSetup = async () => {
  const adminName = document.getElementById('sAdminName').value.trim();
  const adminPw   = document.getElementById('sAdminPw').value.trim();

  if (!adminName || !adminPw) {
    showErr('errSetup','กรุณากรอกชื่อและรหัสผ่านแอดมิน');
    return;
  }

  const evaluators = [];

  for (let i = 1; i <= 4; i++) {
    const name = document.getElementById(`evName${i}`).value.trim();
    const pw   = document.getElementById(`evPw${i}`).value.trim();

    if (name && pw) {
      evaluators.push({
        id: uid(),
        name,
        password: pw
      });
    } else if (name || pw) {
      showErr('errSetup', `ผู้ประเมิน ${i}: กรอกทั้งชื่อและรหัสผ่าน`);
      return;
    }
  }

  const d = defaultData();

d.adminName = adminName;
d.adminPassword = adminPw;
d.evaluators = evaluators;

console.log("กำลังบันทึก", d);

await save(d);

session = { role: 'admin', evId: null, name: adminName };
saveSession();

  await drawAdmin();
};

/* ===== WARP TRANSITION: LOGIN TO DASHBOARD ===== */
async function enterWithWarp(renderPage){

    const overlay=document.createElement("div");

    overlay.className="login-transition";

    overlay.innerHTML=`
        <div class="login-line"></div>
        <div class="login-glow"></div>
    `;

    document.body.appendChild(overlay);

    overlay.classList.add("show");

    await new Promise(r=>setTimeout(r,120));

    await renderPage();

    overlay.classList.add("hide");

    await new Promise(r=>setTimeout(r,140));

    overlay.remove();
}

/* ════════════════════════════════════════════
   LOGIN
   ════════════════════════════════════════════ */
function drawLogin(d) {
  set(`
    <section class="login-shell">
      <div class="login-visual">
        <div class="login-orbit orbit-one"></div>
        <div class="login-orbit orbit-two"></div>
        <div class="login-chip"><span class="chip-dot"></span> DIGITAL EVALUATION SYSTEM</div>
        <div class="login-symbol">⌘</div>
        <div class="login-visual-copy">
          <p class="login-kicker">INFORMATION TECHNOLOGY</p>
          <h1>PROJECT<br><span>EVALUATION</span></h1>
          <p>พื้นที่จัดการและประเมินผลงานโปรเจกต์นักเรียน<br>อย่างเป็นระบบและมีประสิทธิภาพ</p>
        </div>
        <div class="login-visual-foot"><span>SECURE WORKSPACE</span><span>● ONLINE</span></div>
      </div>
      <div class="login-form-panel">
        <div class="login-mini-mark">◈ <span>IT SYSTEM</span></div>
        <p class="login-welcome">ยินดีต้อนรับกลับ</p>
        <h2>เข้าสู่ระบบ</h2>
        <p class="login-subtitle">กรุณาเลือกบัญชีและกรอกรหัสผ่านเพื่อดำเนินการต่อ</p>
        <div id="errLogin"></div>
        <div class="field"><label>บัญชีผู้ใช้งาน</label>
          <select id="loginRole">
            <option value="admin">แอดมิน — ${esc(d.adminName)}</option>
            ${d.evaluators.map(e=>`<option value="${e.id}">${esc(e.name)}</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>รหัสผ่าน</label>
          <input id="loginPw" type="password" placeholder="กรอกรหัสผ่าน" onkeydown="if(event.key==='Enter')doLogin()">
        </div>
        <button class="btn btn-primary login-submit" onclick="doLogin()"><span>เข้าสู่ระบบ</span><b>→</b></button>
        <div class="login-secure"><span>▣</span> ระบบสำหรับผู้ดูแลและคณะกรรมการประเมิน</div>
      </div>
    </section>
  `);
}
window.doLogin = async () => {
  const d = await load();

  const role = document.getElementById('loginRole').value;
  const pw = document.getElementById('loginPw').value;

  if (role === 'admin') {

    if (pw !== d.adminPassword) {
      showErr('errLogin', 'รหัสผ่านไม่ถูกต้อง');
      return;
    }

    session = {
      role: 'admin',
      evId: null,
      name: d.adminName
    };
    saveSession();

    await enterWithWarp(drawAdmin);

  } else {

    const ev = d.evaluators.find(e => e.id === role);

    if (!ev || pw !== ev.password) {
      showErr('errLogin', 'รหัสผ่านไม่ถูกต้อง');
      return;
    }

    session = {
      role: 'evaluator',
      evId: ev.id,
      name: ev.name
    };
    saveSession();

    await enterWithWarp(drawEvaluator);
  }
};

/* ════════════════════════════════════════════
   ADMIN VIEW
   ════════════════════════════════════════════ */
let adminTab = 'groups';

async function drawAdmin() {
  const d = await load();
  const tabs = [
    ['groups','📁 กลุ่ม'],['criteria','📝 เกณฑ์การให้คะแนน'],
    ['evaluators','👥 ผู้ประเมิน'],['scores','📊 คะแนนทั้งหมด']
  ];
  let body = '';
  if (adminTab === 'groups')     body = adminGroups(d);
  if (adminTab === 'criteria')   body = adminCriteria(d);
  if (adminTab === 'evaluators') body = adminEvaluators(d);
  if (adminTab === 'scores')     body = adminScores(d);

  set(`
    <div class="topbar">
      <div><h2>ระบบประเมินโปรเจกต์นักเรียน</h2>
      <div class="sub">${esc(d.adminName)} <span class="badge badge-admin">แอดมิน</span></div></div>
      <button class="btn btn-outline" onclick="doLogout()">ออกจากระบบ</button>
    </div>
    <div class="tabs">${tabs.map(([k,l])=>`<button class="tab ${adminTab===k?'on':''}" onclick="setAdminTab('${k}')">${l}</button>`).join('')}</div>
    ${body}
  `);
}

window.setAdminTab = async t => {
  adminTab = t;
  await drawAdmin();
};
window.doLogout = async () => {
  clearSession();
  await boot();
};

/* ── กลุ่ม ── */
function adminGroups(d) {
  const cards = d.groups.map(g => {
    const members = (g.members ?? []).map((m, i) =>
      `<div class="list-row"><span>${esc(m)}</span>
       <span class="dlnk" onclick="doDelMember('${g.id}',${i})">ลบ</span></div>`
    ).join('') || `<p class="muted" style="font-size:13px;padding:6px 0">ยังไม่มีสมาชิก</p>`;
    return `<div class="card">
      <div class="topbar" style="margin-bottom:12px">
        <b>${esc(g.name)}</b>
        <span class="dlnk" onclick="doDelGroup('${g.id}')">🗑 ลบกลุ่ม</span>
      </div>
      ${members}
      <div class="row" style="margin-top:12px">
        <input type="text" id="mi_${g.id}" placeholder="ชื่อสมาชิกใหม่">
        <button class="btn btn-outline" onclick="doAddMember('${g.id}')">+ เพิ่มสมาชิก</button>
      </div>
    </div>`;
  }).join('');

  return `<div class="card">
    <div class="field"><label>เพิ่มกลุ่มใหม่</label>
    <div class="row"><input id="newGrp" type="text" placeholder="เช่น กลุ่ม 1 / ทีม Alpha">
    <button class="btn btn-primary" onclick="doAddGroup()">+ เพิ่มกลุ่ม</button></div></div>
  </div>${cards || '<div class="card muted" style="font-size:13px">ยังไม่มีกลุ่ม — กรอกชื่อแล้วกด "+ เพิ่มกลุ่ม"</div>'}`;
}

window.doAddGroup = async () => {

  const d = await load();

  const v = document.getElementById('newGrp').value.trim();

  if (!v) return;

  if (!d.groups) d.groups = [];

  d.groups.push({
    id: uid(),
    name: v,
    members: []
  });

  await save(d);

  await drawAdmin();
};

window.doDelGroup = async id => {
  if (!confirm('ลบกลุ่มนี้?')) return;

  const d = await load();
  d.groups = d.groups.filter(g => g.id !== id);

  await save(d);
  await drawAdmin();
};
window.doAddMember = async gid => {
  const d = await load();
  const g = d.groups.find(x => x.id === gid);
  const v = document.getElementById('mi_' + gid).value.trim();

  if (!v || !g) return;

  g.members.push(v);

  await save(d);
  await drawAdmin();
};
window.doDelMember = async (gid, idx) => {
  const d = await load();
  const g = d.groups.find(x => x.id === gid);

  if (!g) return;

  g.members.splice(idx, 1);

  await save(d);
  await drawAdmin();
};

/* ── เกณฑ์ ── */
function adminCriteria(d) {
  const list = d.criteria.map(c =>
    `<div class="list-row">
      <span>${esc(c.name)} <span class="tag-max">(เต็ม ${c.max} คะแนน)</span></span>
      <span class="dlnk" onclick="doDelCrit('${c.id}')">ลบ</span>
    </div>`
  ).join('') || `<p class="muted" style="font-size:13px;padding:6px 0">ยังไม่มีเกณฑ์</p>`;

  return `<div class="card">
    <label>เพิ่มเกณฑ์การให้คะแนน</label>
    <div class="row">
      <input id="cName" type="text" placeholder="ชื่อเกณฑ์ เช่น ความคิดสร้างสรรค์" style="flex:3">
      <input id="cMax"  type="number" placeholder="คะแนนเต็ม" value="10" style="flex:1;min-width:90px">
      <button class="btn btn-primary" onclick="doAddCrit()">+ เพิ่ม</button>
    </div>
  </div>
  <div class="card">${list}</div>`;
}

window.doAddCrit = async () => {
  const d = await load();
  const n = document.getElementById('cName').value.trim();
  const m = Number(document.getElementById('cMax').value) || 10;

  if (!n) return;

  d.criteria.push({
    id: uid(),
    name: n,
    max: m
  });

  await save(d);
  await drawAdmin();
}
window.doDelCrit = async id => {
  const d = await load();

  d.criteria = d.criteria.filter(c => c.id !== id);

  await save(d);
  await drawAdmin();
};

/* ── ผู้ประเมิน ── */
function adminEvaluators(d) {
  const rows = d.evaluators.map(e =>
    `<div class="list-row">
      <span>${esc(e.name)} <span class="badge badge-ev">ผู้ประเมิน</span></span>
      <div style="display:flex;gap:10px;align-items:center">
        <span class="pw">${esc(e.password)}</span>
        <span class="dlnk" onclick="doDelEv('${e.id}')">ลบ</span>
      </div>
    </div>`
  ).join('') || `<p class="muted" style="font-size:13px;padding:6px 0">ยังไม่มีผู้ประเมิน</p>`;

  const canAdd = d.evaluators.length < 4;
  return `<div class="card">
    <p class="muted" style="font-size:13px;margin-bottom:14px">ผู้ประเมิน ${d.evaluators.length}/4 คน</p>
    ${rows}
    ${canAdd ? `
    <hr class="sep">
    <label>เพิ่มผู้ประเมิน</label>
    <div class="row">
      <input id="evNewName" type="text" placeholder="ชื่อผู้ประเมิน" style="flex:2">
      <input id="evNewPw"   type="text" placeholder="รหัสผ่าน" style="flex:1;min-width:100px">
      <button class="btn btn-outline" onclick="doAddEv()">+ เพิ่ม</button>
    </div>` : `<p class="muted" style="margin-top:12px;font-size:13px">ผู้ประเมินเต็มแล้ว (สูงสุด 4 คน)</p>`}
    <div class="note" style="margin-top:14px">
      💡 <b>วิธีแจกรหัสผ่าน:</b> ส่งไฟล์ HTML นี้ให้ผู้ประเมินแต่ละคน พร้อมบอกรหัสผ่านของตัวเอง
    </div>
  </div>`;
}

window.doAddEv = async () => {
  const d = await load();
  const n = document.getElementById('evNewName').value.trim();
  const pw = document.getElementById('evNewPw').value.trim();

  if (!n || !pw) return;

  if (d.evaluators.length >= 4) {
    alert('ผู้ประเมินเต็มแล้ว');
    return;
  }

  d.evaluators.push({
    id: uid(),
    name: n,
    password: pw
  });

  await save(d);
  await drawAdmin();
};
window.doDelEv = async id => {
  if (!confirm('ลบผู้ประเมินนี้?')) return;

  const d = await load();
  d.evaluators = d.evaluators.filter(e => e.id !== id);

  await save(d);
  await drawAdmin();
};

/* ── คะแนนทั้งหมด ── */
function adminScores(d) {
  if (!d.groups.length || !d.criteria.length)
    return `<div class="card"><p class="muted">ต้องมีกลุ่มและเกณฑ์การให้คะแนนก่อน</p></div>`;
  if (!d.evaluators.length)
    return `<div class="card"><p class="muted">ยังไม่มีผู้ประเมิน</p></div>`;

  return d.groups.map(g => {
    const rows = d.evaluators.map(ev => {
      const cells = d.criteria.map(c => {
        const key = `${ev.id}__${g.id}__${c.id}`;
        const val = d.scores[key];
        return `<td>${val != null ? val : '<span class="muted">-</span>'}</td>`;
      }).join('');
      const total = d.criteria.reduce((s, c) => {
        const v = d.scores[`${ev.id}__${g.id}__${c.id}`];
        return s + (v != null ? v : 0);
      }, 0);
      return `<tr><td>${esc(ev.name)}</td>${cells}<td><b>${total}</b></td></tr>`;
    }).join('');

    // avg row
    const avgCells = d.criteria.map(c => {
      const vals = d.evaluators.map(ev => d.scores[`${ev.id}__${g.id}__${c.id}`]).filter(v => v != null);
      const avg  = vals.length ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : '-';
      return `<td><i>${avg}</i></td>`;
    }).join('');
    const avgTotal = d.criteria.reduce((s, c) => {
      const vals = d.evaluators.map(ev => d.scores[`${ev.id}__${g.id}__${c.id}`]).filter(v => v != null);
      return s + (vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : 0);
    }, 0);

    return `<div class="card">
      <b>${esc(g.name)}</b>
      <p class="muted" style="font-size:12px;margin-bottom:12px">สมาชิก: ${(g.members??[]).join(', ')||'-'}</p>
      <div class="overflow">
        <table>
          <tr><th>ผู้ประเมิน</th>${d.criteria.map(c=>`<th>${esc(c.name)}<br><span class="tag-max">/${c.max}</span></th>`).join('')}<th>รวม</th></tr>
          ${rows}
          <tr style="background:var(--accent)"><td><i>ค่าเฉลี่ย</i></td>${avgCells}<td><i>${avgTotal.toFixed(1)}</i></td></tr>
        </table>
      </div>
    </div>`;
  }).join('');
}

/* ════════════════════════════════════════════
   EVALUATOR VIEW
   ════════════════════════════════════════════ */
let evalGroup = null;

async function drawEvaluator() {
  const d = await load();

  if (!evalGroup && d.groups.length) evalGroup = d.groups[0].id;
  const g = d.groups.find(x => x.id === evalGroup);

  // score form
  let scoreForm = '';
  if (!d.groups.length) {
    scoreForm = `<div class="card"><p class="muted">รอแอดมินเพิ่มกลุ่มก่อน</p></div>`;
  } else if (!d.criteria.length) {
    scoreForm = `<div class="card"><p class="muted">รอแอดมินกำหนดเกณฑ์การให้คะแนน</p></div>`;
  } else if (g) {
    const fields = d.criteria.map(c => {
      const key = `${session.evId}__${g.id}__${c.id}`;
      const val = d.scores[key];
      return `<div class="score-row">
        <span>${esc(c.name)} <span class="tag-max">(เต็ม ${c.max})</span></span>
        <input type="number" class="si" min="0" max="${c.max}"
          data-gid="${g.id}" data-cid="${c.id}" data-max="${c.max}"
          value="${val != null ? val : ''}">
      </div>`;
    }).join('');
    scoreForm = `<div class="card">
      <b>${esc(g.name)}</b>
      <p class="muted" style="font-size:12px;margin:4px 0 16px">สมาชิก: ${(g.members??[]).join(', ')||'-'}</p>
      ${fields}
      <button class="btn btn-good" style="margin-top:8px" onclick="doSave()">💾 บันทึกคะแนน</button>
    </div>`;
  }

  // my scores summary
  const myRows = d.groups.flatMap(grp =>
    d.criteria.map(c => {
      const key = `${session.evId}__${grp.id}__${c.id}`;
      const val = d.scores[key];
      if (val == null) return '';
      return `<tr><td>${esc(grp.name)}</td><td>${esc(c.name)}</td><td>${val} / ${c.max}</td></tr>`;
    })
  ).filter(Boolean).join('');

  set(`
    <div class="topbar">
      <div><h2>ระบบประเมินโปรเจกต์นักเรียน</h2>
      <div class="sub">${esc(session.name)} <span class="badge badge-ev">ผู้ประเมิน</span></div></div>
      <button class="btn btn-outline" onclick="doLogout()">ออกจากระบบ</button>
    </div>

    <div class="card">
      <label>เลือกกลุ่มที่จะให้คะแนน</label>
      <select onchange="setEvalGroup(this.value)">
        ${d.groups.map(x=>`<option value="${x.id}" ${x.id===evalGroup?'selected':''}>${esc(x.name)}</option>`).join('') || '<option>ยังไม่มีกลุ่ม</option>'}
      </select>
    </div>

    ${scoreForm}

    <div class="card">
      <b style="font-size:14px">คะแนนที่คุณให้ไปแล้ว (เห็นเฉพาะของคุณ)</b>
      <div class="overflow" style="margin-top:10px">
        ${myRows
          ? `<table><tr><th>กลุ่ม</th><th>เกณฑ์</th><th>คะแนน</th></tr>${myRows}</table>`
          : `<p class="muted" style="font-size:13px;padding:6px 0">ยังไม่มีคะแนน</p>`}
      </div>
    </div>
  `);
}

window.setEvalGroup = async gid => {
  evalGroup = gid;
  await drawEvaluator();
};

window.doSave = async () => {
  const d = await load();

  document.querySelectorAll('.si').forEach(inp => {
    let v = Number(inp.value);
    const max = Number(inp.dataset.max);

    if (isNaN(v)) v = 0;
    v = Math.max(0, Math.min(max, v));

    d.scores[`${session.evId}__${inp.dataset.gid}__${inp.dataset.cid}`] = v;
  });

  await save(d);
  await drawEvaluator();
};

/* ════════════════════════════════════════════
   UTIL
   ════════════════════════════════════════════ */
function showErr(id, msg) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = `<div class="err">⚠️ ${esc(msg)}</div>`;
}

/* ════════════════════════════════════════════
   START
   ════════════════════════════════════════════ */
window.addEventListener("load", async () => {
  await boot();
});
