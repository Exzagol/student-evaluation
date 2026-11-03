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
  try {
    await window.setDoc(
      window.doc(window.db, "system", "main"),
      data
    );
    console.log("Firestore save success");
    return true;
  } catch (e) {
    console.error("Firestore save error:", e);
    alert("บันทึกไม่สำเร็จ: " + e.message);
    return false;
  }
}
  function defaultData() {
  return {
    adminUsername: '',
    adminPassword: '',
    adminName: '',
    adminDisplayNameSet: false,
    evaluators: [],
    groups: [],
    criteria: [],
    scores: {}
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
    const saved = JSON.parse(
      sessionStorage.getItem(SESSION_KEY) || 'null'
    );

    if (!saved) return false;

    // กู้คืนบัญชีแอดมิน
    if (saved.role === 'admin' && d.adminPassword) {
      session = {
        role: 'admin',
        evId: null,
        name: d.adminName || saved.name || ''
      };

      return true;
    }

    // กู้คืนบัญชีผู้ประเมิน
    if (saved.role === 'evaluator') {
      const evaluators = d.evaluators || [];

      const ev = evaluators.find(
        e => e.id === saved.evId
      );

      if (ev) {
        session = {
          role: 'evaluator',
          evId: ev.id,
          name: ev.nicknameSet
            ? (ev.nickname || '')
            : ''
        };

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
function personScoreKey(evId, groupId, memberName, critId) {
  return JSON.stringify([evId, groupId, memberName, critId]);
}


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

    // บัญชีแอดมิน
    if (session.role === 'admin') {
      if (!d.adminDisplayNameSet) {
        await drawAdminNameSetup();
      } else {
        await drawAdmin();
      }
    }

    // บัญชีผู้ประเมิน
    else if (session.role === 'evaluator') {
      const ev = (d.evaluators || []).find(
        e => e.id === session.evId
      );

      if (!ev) {
        clearSession();
        drawLogin(d);
        return;
      }

      // ถ้ายังไม่เคยตั้งชื่อเล่น ให้ไปหน้าตั้งชื่อ
      if (
        !ev.nicknameSet ||
        !ev.nickname ||
        !ev.nickname.trim()
      ) {
        session.name = '';
        saveSession();
        await drawEvaluatorNameSetup();
      } else {
        session.name = ev.nickname;
        saveSession();
        await drawEvaluator();
      }
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
        <p class="sub" style="margin-bottom:18px">
          กำหนดบัญชีเข้าสู่ระบบของแอดมิน
        </p>

        <div id="errSetup"></div>

        <div class="field">
          <label>ชื่อผู้ใช้แอดมิน</label>
          <input id="sAdminName" type="text"
            placeholder="เช่น sbt3">
        </div>

        <div class="field">
          <label>รหัสผ่านแอดมิน</label>
          <input id="sAdminPw" type="password"
            placeholder="ตั้งรหัสผ่านแอดมิน">
        </div>

        <button class="btn btn-primary"
          style="margin-top:18px;width:100%"
          onclick="doSetup()">
          เริ่มใช้งาน →
        </button>
      </div>
    </div>
  `);
}


window.doSetup = async () => {
  const adminUsername = document
    .getElementById('sAdminName').value.trim();

  const adminPw = document
    .getElementById('sAdminPw').value.trim();

  if (!adminUsername || !adminPw) {
    showErr('errSetup', 'กรุณากรอกชื่อผู้ใช้และรหัสผ่านแอดมิน');
    return;
  }

  const d = defaultData();

  // บัญชีสำหรับเข้าสู่ระบบ
  d.adminUsername = adminUsername;
  d.adminPassword = adminPw;

  // ชื่อแสดงผลจะตั้งในหน้าถัดไป
  d.adminName = '';
  d.adminDisplayNameSet = false;

  // ยังไม่มีผู้ประเมิน ให้แอดมินเพิ่มภายหลัง
  d.evaluators = [];

  const saved = await save(d);

  if (saved === false) return;

  session = {
    role: 'admin',
    evId: null,
    name: ''
  };

  saveSession();

  await enterWithWarp(drawAdminNameSetup);
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
        <p class="login-subtitle">กรอกชื่อและรหัสผ่านเพื่อดำเนินการต่อ</p>

        <div id="errLogin"></div>

        <div class="field">
          <label>ชื่อผู้ใช้งาน</label>
          <input id="loginName" type="text"
            placeholder="กรอกชื่อของคุณ"
            autocomplete="username"
            onkeydown="if(event.key==='Enter')doLogin()">
        </div>

        <div class="field">
          <label>รหัสผ่าน</label>
          <input id="loginPw" type="password"
            placeholder="กรอกรหัสผ่าน"
            autocomplete="current-password"
            onkeydown="if(event.key==='Enter')doLogin()">
        </div>

        <button class="btn btn-primary login-submit" onclick="doLogin()">
          <span>เข้าสู่ระบบ</span><b>→</b>
        </button>

        <div class="login-secure">
          <span>▣</span> ระบบสำหรับผู้ดูแลและคณะกรรมการประเมิน
        </div>
      </div>
    </section>
  `);
}


window.doLogin = async () => {
  const d = await load();

  const name = document.getElementById('loginName').value.trim();
  const pw = document.getElementById('loginPw').value;

  if (!name || !pw) {
    showErr('errLogin', 'กรุณากรอกชื่อและรหัสผ่าน');
    return;
  }

  // ตรวจสอบบัญชีแอดมิน
  if (
    name === (d.adminUsername || '').trim() &&
    pw === d.adminPassword
  ) {
    const needsDisplayName = !d.adminDisplayNameSet;

    session = {
      role: 'admin',
      evId: null,
      name: needsDisplayName ? '' : d.adminName
    };

    saveSession();

    if (needsDisplayName) {
      await enterWithWarp(drawAdminNameSetup);
    } else {
      await enterWithWarp(drawAdmin);
    }

    return;
  }

  // ตรวจสอบบัญชีผู้ประเมิน
  const ev = (d.evaluators || []).find(e =>
    e.name.trim() === name && e.password === pw
  );

  if (!ev) {
    showErr('errLogin', 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง');
    return;
  }

  // ตรวจสอบว่าผู้ประเมินตั้งชื่อเล่นแล้วหรือยัง
  if (!ev.nicknameSet || !ev.nickname || !ev.nickname.trim()) {
    session = {
      role: 'evaluator',
      evId: ev.id,
      name: ''
    };

    saveSession();

    await enterWithWarp(drawEvaluatorNameSetup);
    return;
  }

  // ผู้ประเมินที่ตั้งชื่อเล่นแล้ว
  session = {
    role: 'evaluator',
    evId: ev.id,
    name: ev.nickname
  };

  saveSession();

  await enterWithWarp(drawEvaluator);
};



/* ════════════════════════════════════════════
   ADMIN VIEW
   ════════════════════════════════════════════ */
   
function drawAdminNameSetup() {
  set(`
    <div class="card" style="max-width:480px;margin:60px auto;padding:30px;">
      <h2 style="text-align:center;">ตั้งชื่อที่ใช้ในระบบ</h2>
      <p class="sub" style="text-align:center;margin-bottom:24px;">
        กรุณากรอกชื่อที่ต้องการให้แสดงในระบบประเมิน
      </p>

      <div id="errAdminName"></div>

      <div class="field">
        <label>ชื่อที่ต้องการแสดงในเว็บไซต์</label>
        <input
          id="adminDisplayName"
          type="text"
          placeholder="เช่น อาจารย์สมชาย"
          maxlength="60"
        >
      </div>

      <button
        class="btn btn-primary"
        style="width:100%;margin-top:15px;"
        onclick="saveAdminDisplayName()"
      >
        ยืนยันชื่อและเข้าสู่ระบบ →
      </button>
    </div>
  `);
}
function drawEvaluatorNameSetup() {
  set(`
    <div class="card" style="max-width:480px;margin:60px auto;padding:30px;">
      <h2 style="text-align:center;">ตั้งชื่อเล่นของคุณ</h2>

      <p class="sub" style="text-align:center;margin-bottom:24px;">
        กรุณาตั้งชื่อที่ต้องการให้แสดงในระบบประเมิน
      </p>

      <div id="errEvaluatorName"></div>

      <div class="field">
        <label>ชื่อเล่นที่ต้องการแสดง</label>
        <input
          id="evaluatorNickname"
          type="text"
          placeholder="เช่น กรรมการ A"
          maxlength="60"
        >
      </div>

      <button
        class="btn btn-primary"
        style="width:100%;margin-top:15px;"
        onclick="saveEvaluatorNickname()"
      >
        บันทึกชื่อและเข้าสู่ระบบ →
      </button>
    </div>
  `);
}

window.saveEvaluatorNickname = async () => {
  const nickname = document
    .getElementById('evaluatorNickname')
    .value.trim();

  if (!nickname) {
    showErr('errEvaluatorName', 'กรุณากรอกชื่อเล่น');
    return;
  }

  const d = await load();

  const evaluator = (d.evaluators || []).find(
    e => e.id === session.evId
  );

  if (!evaluator) {
    alert('ไม่พบบัญชีผู้ประเมิน กรุณาเข้าสู่ระบบใหม่');
    clearSession();
    await boot();
    return;
  }

  evaluator.nickname = nickname;
  evaluator.nicknameSet = true;

  const saved = await save(d);

  if (saved === false) return;

  session.name = nickname;
  saveSession();

  await drawEvaluator();
};

window.saveAdminDisplayName = async () => {
  const name = document
    .getElementById('adminDisplayName')
    .value.trim();

  if (!name) {
    showErr('errAdminName', 'กรุณากรอกชื่อที่ต้องการแสดง');
    return;
  }

  const d = await load();
  if (!d.adminUsername) {
  d.adminUsername = d.adminName;
}

  d.adminName = name;
  d.adminDisplayNameSet = true;

  const saved = await save(d);

  if (saved === false) return;

  session.name = name;
  saveSession();

  await drawAdmin();
};

let adminTab = 'groups';
let adminEvalGroup = null;
let adminEvalMember = '';

async function drawAdmin() {
  const d = await load();
  const tabs = [
    ['groups','📁 กลุ่ม'],
    ['criteria','📝 เกณฑ์การให้คะแนน'],
    ['evaluators','👥 ผู้ประเมิน'],
    ['evaluate','📝 ประเมินโปรเจกต์'],
    ['scores','📊 คะแนนทั้งหมด'],
    ['settings','⚙️ ตั้งค่าบัญชี']
  ];
  let body = '';
  if (adminTab === 'groups')     body = adminGroups(d);
  if (adminTab === 'criteria')   body = adminCriteria(d);
  if (adminTab === 'evaluators') body = adminEvaluators(d);
  if (adminTab === 'evaluate')   body = adminEvaluate(d);
  if (adminTab === 'scores')     body = adminScores(d);
  if (adminTab === 'settings') body = adminSettings(d);

  set(`
    <div class="topbar">
      <div><h2>ระบบประเมินโปรเจกต์นักเรียน</h2>
      <div class="sub">${esc(d.adminName)} <span class="badge badge-admin">แอดมิน</span></div></div>
      <button class="btn btn-outline" onclick="doLogout()">
        ออกจากระบบ
      </button>
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
    const members = (g.members ?? []).map((m, i) => `
  <div class="list-row member-display" style="display:block;padding:14px 16px">

    <div id="memberView_${g.id}_${i}">
  <div style="display:flex;justify-content:space-between;align-items:center">
    <strong style="font-size:16px;color:#183b63">
      ${esc(m.name || '')}
    </strong>

    <span style="display:flex;gap:12px">
      <span class="dlnk"
        onclick="toggleEditMember('${g.id}',${i})">
        ✏️ แก้ไข
      </span>

      <span class="dlnk"
        onclick="doDelMember('${g.id}',${i})">
        ลบ
      </span>
    </span>
  </div>

  <div style="display:flex;gap:20px;margin-top:7px;font-size:13px;color:#667085">
    <span>เลขประจำตัว: <b>${esc(m.studentId || '-')}</b></span>
    <span>ระดับชั้น: <b>${esc(m.level || '-')}</b></span>
  </div>
</div>

<div id="memberEdit_${g.id}_${i}" style="display:none;margin-top:10px">
<select
  id="editPrefix_${g.id}_${i}"
  style="flex:0 0 130px;width:130px;min-width:130px;
  min-height:48px;padding:10px 14px;
  border:2px solid #9bbcf5;border-radius:12px;
  background:#fff;font-size:15px;font-weight:600;color:#183b63"
>
  <option value="นาย" ${m.name.startsWith('นาย ') ? 'selected' : ''}>นาย</option>
  <option value="นางสาว" ${m.name.startsWith('นางสาว ') ? 'selected' : ''}>นางสาว</option>
</select>
  <div style="display:flex;flex-wrap:nowrap;gap:10px;margin-bottom:10px;align-items:center">

    <input
      id="editName_${g.id}_${i}"
      value="${esc(m.name || '')}"
      placeholder="ชื่อ-นามสกุล"
      style="flex:2;min-width:180px;min-height:48px;
      padding:10px 14px;border:2px solid #9bbcf5;
      border-radius:12px;background:#fff;
      font-size:15px;font-weight:600;color:#183b63"
    >

    <input
      id="editId_${g.id}_${i}"
      value="${esc(m.studentId || '')}"
      placeholder="เลขประจำตัว"
      style="flex:1;min-width:160px;min-height:48px;
      padding:10px 14px;border:2px solid #9bbcf5;
      border-radius:12px;background:#fff;
      font-size:15px;font-weight:600;color:#183b63"
    >

    <select
      id="editLevel_${g.id}_${i}"
      style="flex:1;min-width:150px;min-height:48px;
      padding:10px 14px;border:2px solid #9bbcf5;
      border-radius:12px;background:#fff;
      font-size:15px;font-weight:600;color:#183b63"
    >
      ${['ปวช.1','ปวช.2','ปวช.3','ปวส.1','ปวส.2','ปวส.3'].map(level =>
        `<option value="${level}" ${m.level === level ? 'selected' : ''}>${level}</option>`
      ).join('')}
    </select>

  </div>

  <button class="btn btn-primary"
    onclick="saveEditMember('${g.id}',${i})">
    💾 บันทึก
  </button>

  <button class="btn btn-outline"
    onclick="toggleEditMember('${g.id}',${i})">
    ยกเลิก
  </button>

</div>

  </div>
`).join('') || `
  <p class="muted" style="font-size:13px;padding:6px 0">
    ยังไม่มีสมาชิก
  </p>
`;`<p class="muted" style="font-size:13px;padding:6px 0">ยังไม่มีสมาชิก</p>`;
    return `<div class="card">
      <div class="topbar" style="margin-bottom:12px">
        <b>${esc(g.name)}</b>

        <div id="groupNameView_${g.id}"
     style="display:flex;align-items:center;gap:12px">
  <b>${esc(g.name)}</b>

  <span class="dlnk"
    style="color:#fff;cursor:pointer"
    onclick="editGroupName('${g.id}')">
    ✏️ แก้ไขชื่อ
  </span>
</div>

<div id="groupNameEdit_${g.id}"
     style="display:none;align-items:center;gap:8px;flex:1">

  <input
    id="groupNameInput_${g.id}"
    type="text"
    value="${esc(g.name)}"
    style="flex:1;min-width:100px;padding:9px 12px;border:1px solid #9bbcf5;border-radius:9px;font-size:15px"
    onkeydown="if(event.key==='Enter') saveGroupName('${g.id}')"
  >

  <button class="btn btn-primary"
    onclick="saveGroupName('${g.id}')">
    💾 บันทึก
  </button>

  <button class="btn btn-outline"
    onclick="cancelEditGroupName('${g.id}')">
    ยกเลิก
  </button>
</div>
      </div>
      ${members}
      <div class="row" style="margin-top:12px;flex-wrap:wrap">
  <select
  id="prefix_${g.id}"
  style="
    width:180px;
    min-height:48px;
    padding:10px 14px;
    border:2px solid #9bbcf5;
    border-radius:12px;
    background:#fff;
    font-size:15px;
    font-weight:600;
    color:#183b63;
    box-shadow:0 2px 6px rgba(0,0,0,0.06);
  "
>
  <option value="นาย">นาย</option>
  <option value="นางสาว">นางสาว</option>
</select>

  <input type="text" id="mi_${g.id}" placeholder="ชื่อ-นามสกุล">
  <input type="text" id="sid_${g.id}" placeholder="เลขประจำตัวนักศึกษา">

  <select id="level_${g.id}">
    <option value="ปวช.1">ปวช.1</option>
    <option value="ปวช.2">ปวช.2</option>
    <option value="ปวช.3">ปวช.3</option>
    <option value="ปวส.1">ปวส.1</option>
    <option value="ปวส.2">ปวส.2</option>
    <option value="ปวส.3">ปวส.3</option>
</select>

  <button class="btn btn-outline" onclick="doAddMember('${g.id}')">
    + เพิ่มสมาชิก
  </button>
</div>
    </div>`;
  }).join('');

  return `<div class="card">
    <div class="field"><label>เพิ่มกลุ่มใหม่</label>
    <div class="row">
  <input id="newGrp" type="text" placeholder="ชื่อกลุ่ม เช่น กลุ่ม 1">

  <button class="btn btn-primary" onclick="doAddGroup()">+ เพิ่มกลุ่ม</button>
</div>
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
window.editGroupName = (id) => {
  const view = document.getElementById(`groupNameView_${id}`);
  const edit = document.getElementById(`groupNameEdit_${id}`);

  if (!view || !edit) return;

  view.style.display = 'none';
  edit.style.display = 'flex';

  const input = document.getElementById(`groupNameInput_${id}`);
  input.focus();
  input.select();
};

window.cancelEditGroupName = (id) => {
  const view = document.getElementById(`groupNameView_${id}`);
  const edit = document.getElementById(`groupNameEdit_${id}`);

  if (!view || !edit) return;

  edit.style.display = 'none';
  view.style.display = 'flex';
};

window.saveGroupName = async (id) => {
  const d = await load();
  const g = d.groups.find(x => x.id === id);
  const input = document.getElementById(`groupNameInput_${id}`);

  if (!g || !input) return;

  const name = input.value.trim();

  if (!name) {
    alert('กรุณากรอกชื่อกลุ่ม');
    return;
  }

  g.name = name;

  await save(d);
  await drawAdmin();
};
window.doAddMember = async gid => {
  const d = await load();
  const g = d.groups.find(x => x.id === gid);

  if (!g) return;

  const prefix = document.getElementById('prefix_' + gid).value;
  const name = document.getElementById('mi_' + gid).value.trim();
  const studentId = document.getElementById('sid_' + gid).value.trim();
  const level = document.getElementById('level_' + gid).value;

  if (!name) {
    alert('กรุณากรอกชื่อ-นามสกุล');
    return;
  }

  if (!studentId) {
    alert('กรุณากรอกเลขประจำตัวนักศึกษา');
    return;
  }

  const fullName = `${prefix} ${name}`;

  g.members.push({
    name: fullName,
    studentId: studentId,
    level: level
  });

  await save(d);
  await drawAdmin();
};
window.toggleEditMember = (gid, idx) => {
  const view = document.getElementById(`memberView_${gid}_${idx}`);
  const edit = document.getElementById(`memberEdit_${gid}_${idx}`);

  if (!view || !edit) return;

  const isHidden = edit.style.display === 'none';

  view.style.display = isHidden ? 'none' : 'block';
  edit.style.display = isHidden ? 'block' : 'none';
};
window.saveEditMember = async (gid, idx) => {
  try {
    const d = await load();
    const g = d.groups.find(x => x.id === gid);

    if (!g || !g.members[idx]) {
      alert('ไม่พบข้อมูลสมาชิก');
      return;
    }

    const prefix = document.getElementById(`editPrefix_${gid}_${idx}`).value;
    const name = document.getElementById(`editName_${gid}_${idx}`).value.trim();
    const studentId = document.getElementById(`editId_${gid}_${idx}`).value.trim();
    const level = document.getElementById(`editLevel_${gid}_${idx}`).value;

    if (!name || !studentId) {
      alert('กรุณากรอกชื่อและเลขประจำตัวให้ครบ');
      return;
    }

    const cleanName = name.replace(/^(นาย|นางสาว)\s*/, '');

    g.members[idx] = {
      ...g.members[idx],
      name: `${prefix} ${cleanName}`,
      studentId,
      level
    };

    await save(d);
    await drawAdmin();

    alert('บันทึกข้อมูลเรียบร้อยแล้ว');
  } catch (error) {
    console.error(error);
    alert('บันทึกไม่สำเร็จ กรุณาลองใหม่');
  }
};
window.doEditMember = async (gid, idx) => {
  const d = await load();
  const g = d.groups.find(x => x.id === gid);

  if (!g || !g.members[idx]) return;

  const member = g.members[idx];

  const newName = prompt(
    'แก้ไขชื่อสมาชิก',
    member.name || ''
  );

  if (newName === null) return;

  if (!newName.trim()) {
    alert('กรุณากรอกชื่อสมาชิก');
    return;
  }

  const newStudentId = prompt(
    'แก้ไขเลขประจำตัวนักศึกษา',
    member.studentId || ''
  );

  if (newStudentId === null) return;

  if (!newStudentId.trim()) {
    alert('กรุณากรอกเลขประจำตัวนักศึกษา');
    return;
  }

  const newLevel = prompt(
    'แก้ไขระดับชั้น เช่น ปวช.1, ปวช.2, ปวช.3',
    member.level || 'ปวช.1'
  );

  if (newLevel === null) return;

  g.members[idx] = {
    name: newName.trim(),
    studentId: newStudentId.trim(),
    level: newLevel.trim()
  };

  await save(d);
  await drawAdmin();
};
window.doEditMemberInline = async (gid, idx, newName) => {
  const d = await load();
  const g = d.groups.find(x => x.id === gid);

  if (!g) return;

  newName = newName.trim();

  if (!newName) {
    alert('กรุณากรอกชื่อสมาชิก');
    await drawAdmin();
    return;
  }

  g.members[idx] = newName;

  await save(d);
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
  const evaluators = d.evaluators || [];

  const rows = evaluators.map(e =>
    `<div class="list-row">
      <div>
        <strong>${esc(e.name)}</strong>
        <span class="badge badge-ev">ผู้ประเมิน</span>

        <div class="muted" style="font-size:12px;margin-top:4px">
          ชื่อเล่น: ${esc(e.nickname || 'ยังไม่ได้ตั้ง')}
        </div>

        <button
          class="btn btn-outline"
          style="margin-top:8px;font-size:12px;padding:5px 10px"
          onclick="doEditEvNickname('${e.id}')"
        >
          ✏️ แก้ชื่อเล่น
        </button>
      </div>

      <div style="display:flex;gap:10px;align-items:center">
        <span class="pw">${esc(e.password)}</span>
        <span class="dlnk" onclick="doDelEv('${e.id}')">ลบ</span>
      </div>
    </div>`
  ).join('') || `
    <p class="muted" style="font-size:13px;padding:6px 0">
      ยังไม่มีผู้ประเมิน
    </p>`;

  const canAdd = evaluators.length < 4;

  return `<div class="card">
    <p class="muted" style="font-size:13px;margin-bottom:14px">
      ผู้ประเมิน ${evaluators.length}/4 คน
    </p>

    ${rows}

    ${canAdd ? `
      <hr class="sep">

      <label>เพิ่มบัญชีผู้ประเมิน</label>

      <div class="row">
        <input
          id="evNewName"
          type="text"
          placeholder="ชื่อผู้ใช้"
          style="flex:2"
        >

        <input
          id="evNewPw"
          type="password"
          placeholder="รหัสผ่าน"
          style="flex:1;min-width:100px"
        >

        <button class="btn btn-outline" onclick="doAddEv()">
          + เพิ่ม
        </button>
      </div>
    ` : `
      <p class="muted" style="margin-top:12px;font-size:13px">
        ผู้ประเมินเต็มแล้ว (สูงสุด 4 คน)
      </p>
    `}

    <div class="note" style="margin-top:14px">
      💡 <b>วิธีใช้งาน:</b>
      แอดมินแจกลิงก์เว็บไซต์ ชื่อผู้ใช้ และรหัสผ่านให้ผู้ประเมิน
      เมื่อเข้าใช้งานครั้งแรก ผู้ประเมินจะต้องตั้งชื่อเล่นของตนเอง
    </div>
  </div>`;
}



window.doAddEv = async () => {
  const d = await load();

  const n = document.getElementById('evNewName').value.trim();
  const pw = document.getElementById('evNewPw').value.trim();

  if (!n || !pw) {
    alert('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    return;
  }

  if (!d.evaluators) d.evaluators = [];

  if (d.evaluators.length >= 4) {
    alert('ผู้ประเมินเต็มแล้ว');
    return;
  }

  // ตรวจสอบชื่อผู้ใช้ซ้ำ
  const duplicate = d.evaluators.some(
    e => e.name.trim().toLowerCase() === n.toLowerCase()
  );

  if (duplicate) {
    alert('ชื่อผู้ใช้นี้มีอยู่แล้ว กรุณาใช้ชื่ออื่น');
    return;
  }

  // สร้างบัญชีผู้ประเมิน
  d.evaluators.push({
    id: uid(),
    name: n,
    password: pw,
    nickname: '',
    nicknameSet: false
  });

  const saved = await save(d);

  if (saved === false) return;

  alert('เพิ่มบัญชีผู้ประเมินเรียบร้อยแล้ว');
  await drawAdmin();
};


window.doDelEv = async id => {
  if (!confirm('ต้องการลบผู้ประเมินคนนี้ใช่หรือไม่?')) return;

  const d = await load();

  d.evaluators = (d.evaluators || []).filter(
    e => e.id !== id
  );

  const saved = await save(d);

  if (saved === false) return;

  alert('ลบบัญชีผู้ประเมินเรียบร้อยแล้ว');
  await drawAdmin();
};


/* ── คะแนนทั้งหมด ── */


function adminScores(d) {
  if (!d.groups.length || !d.criteria.length) {
    return `<div class="card">
      <p class="muted">ต้องมีกลุ่มและเกณฑ์การให้คะแนนก่อน</p>
    </div>`;
  }

  const assessors = [
    { id: 'admin', name: d.adminName || 'แอดมิน' },
    ...(d.evaluators || []).map(ev => ({
      ...ev,
      name: ev.nickname || ev.name
    }))
  ];

  return d.groups.map(g => {
    const members = g.members || [];

    // แปลงสมาชิกให้เป็นชื่อ รองรับทั้งข้อมูลแบบ String และ Object
    const memberNames = members.map(member =>
      typeof member === 'string'
        ? member
        : member?.name || member?.fullName || member?.studentName || ''
    ).filter(Boolean);

    const studentTables = memberNames.map(memberName => {
      const rows = assessors.map(ev => {
        const cells = d.criteria.map(c => {
          const key = personScoreKey(
            ev.id, g.id, memberName, c.id
          );

          const val = d.scores[key];

          return `<td>
            ${val != null ? val : '<span class="muted">-</span>'}
          </td>`;
        }).join('');

        const total = d.criteria.reduce((sum, c) => {
          const key = personScoreKey(
            ev.id, g.id, memberName, c.id
          );

          const val = d.scores[key];

          return sum + (val != null ? Number(val) : 0);
        }, 0);

        return `<tr>
          <td>${esc(ev.name)}</td>
          ${cells}
          <td><b>${total}</b></td>
        </tr>`;
      }).join('');

      const avgCells = d.criteria.map(c => {
        const vals = assessors
          .map(ev => d.scores[
            personScoreKey(ev.id, g.id, memberName, c.id)
          ])
          .filter(v => v != null)
          .map(Number);

        const avg = vals.length
          ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)
          : '-';

        return `<td><i>${avg}</i></td>`;
      }).join('');

      const avgTotal = d.criteria.reduce((sum, c) => {
        const vals = assessors
          .map(ev => d.scores[
            personScoreKey(ev.id, g.id, memberName, c.id)
          ])
          .filter(v => v != null)
          .map(Number);

        return sum + (vals.length
          ? vals.reduce((a, b) => a + b, 0) / vals.length
          : 0);
      }, 0);

      return `
        <div style="margin-top:18px">
          <h3>👤 ${esc(memberName)}</h3>

          <div class="overflow">
            <table>
              <tr>
                <th>ผู้ประเมิน</th>
                ${d.criteria.map(c => `
                  <th>
                    ${esc(c.name)}<br>
                    <span class="tag-max">/${c.max}</span>
                  </th>
                `).join('')}
                <th>รวม</th>
              </tr>

              ${rows}

              <tr style="background:var(--accent)">
                <td><b>ค่าเฉลี่ย</b></td>
                ${avgCells}
                <td><b>${avgTotal.toFixed(1)}</b></td>
              </tr>
            </table>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="card">
        <h2>${esc(g.name)}</h2>

        <p class="muted">
          สมาชิก: ${memberNames.map(esc).join(', ') || '-'}
        </p>

        <h3>📊 คะแนนประเมินรายบุคคล</h3>

        ${studentTables || '<p class="muted">กลุ่มนี้ยังไม่มีนักเรียน</p>'}
      </div>
    `;
  }).join('');
}


/* ── ตั้งค่าบัญชีแอดมิน ── */
function adminSettings(d) {
  return `
    <div class="card">
      <h3 style="font-size:18px;margin-bottom:8px">
        ✏️ แก้ไขชื่อแสดงผล
      </h3>

      <p class="muted" style="font-size:13px;margin-bottom:18px">
        เปลี่ยนชื่อที่แสดงในระบบได้โดยไม่กระทบชื่อผู้ใช้และรหัสผ่าน
      </p>

      <div id="errAdminDisplayName"></div>

      <div class="field">
        <label>ชื่อแสดงผลของแอดมิน</label>
        <input
          id="adminDisplayNameEdit"
          type="text"
          maxlength="60"
          value="${esc(d.adminName || '')}"
          placeholder="กรอกชื่อที่ต้องการแสดง"
        >
      </div>

      <button class="btn btn-primary"
        style="width:100%;justify-content:center;padding:13px"
        onclick="doSaveAdminDisplayName()">
        💾 บันทึกชื่อแสดงผล
      </button>
    </div>

    <div class="card">
      <h3 style="font-size:18px;margin-bottom:8px">
        🔐 เปลี่ยนรหัสผ่านแอดมิน
      </h3>

      <p class="muted" style="font-size:13px;margin-bottom:18px">
        กรอกรหัสผ่านเดิมและกำหนดรหัสผ่านใหม่ของคุณ
      </p>

      <div id="errAdminPassword"></div>

      <div class="field">
        <label>รหัสผ่านเดิม</label>
        <input id="oldAdminPw" type="password"
          placeholder="กรอกรหัสผ่านปัจจุบัน">
      </div>

      <div class="field">
        <label>รหัสผ่านใหม่</label>
        <input id="newAdminPw" type="password"
          placeholder="ตั้งรหัสผ่านใหม่">
      </div>

      <div class="field">
        <label>ยืนยันรหัสผ่านใหม่</label>
        <input id="confirmAdminPw" type="password"
          placeholder="กรอกรหัสผ่านใหม่อีกครั้ง">
      </div>

      <button class="btn btn-primary"
        style="width:100%;justify-content:center;padding:13px"
        onclick="doChangeAdminPassword()">
        🔒 บันทึกรหัสผ่านใหม่
      </button>
    </div>
  `;
}

  window.doChangeAdminPassword = async () => {
    const d = await load();

    const oldPw = document.getElementById('oldAdminPw').value;
    const newPw = document.getElementById('newAdminPw').value;
    const confirmPw = document.getElementById('confirmAdminPw').value;

    if (!oldPw || !newPw || !confirmPw) {
      showErr('errAdminPassword', 'กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }

    if (oldPw !== d.adminPassword) {
      showErr('errAdminPassword', 'รหัสผ่านเดิมไม่ถูกต้อง');
      return;
    }

    if (newPw.length < 6) {
      showErr('errAdminPassword', 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }

    if (newPw !== confirmPw) {
      showErr('errAdminPassword', 'รหัสผ่านใหม่ไม่ตรงกัน');
      return;
    }

    if (newPw === oldPw) {
      showErr('errAdminPassword', 'กรุณาตั้งรหัสผ่านที่แตกต่างจากรหัสผ่านเดิม');
      return;
    }

    d.adminPassword = newPw;

    await save(d);

    const verify = await load();

    if (verify.adminPassword !== newPw) {
      showErr('errAdminPassword', 'บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');
      return;
    }

    alert('เปลี่ยนรหัสผ่านแอดมินเรียบร้อยแล้ว');

    await drawAdmin();
  };


/* ════════════════════════════════════════════
   EVALUATOR VIEW
   ════════════════════════════════════════════ */
   
/* ── แอดมินประเมินคะแนน ── */

  function adminEvaluate(d) {
  if (!d.groups.length) {
    return `<div class="card"><p class="muted">ยังไม่มีกลุ่ม กรุณาเพิ่มกลุ่มก่อน</p></div>`;
  }

  if (!d.criteria.length) {
    return `<div class="card"><p class="muted">ยังไม่มีเกณฑ์ กรุณาเพิ่มเกณฑ์ก่อน</p></div>`;
  }

  if (!adminEvalGroup || !d.groups.some(g => g.id === adminEvalGroup)) {
    adminEvalGroup = d.groups[0].id;
    adminEvalMember = '';
  }

  const g = d.groups.find(x => x.id === adminEvalGroup);
  const members = (g.members || []).map(m => {
  if (typeof m === 'string') {
    return { name: m, studentId: '', level: '' };
  }

  return {
    ...m,
    name: m.name || m.fullName || m.studentName || ''
  };
}).filter(m => m.name);

if (!members.some(m => m.name === adminEvalMember)) {
  adminEvalMember = members[0]?.name || '';
}

  if (!members.length) {
    return `<div class="card"><p class="muted">กลุ่มนี้ยังไม่มีสมาชิก กรุณาเพิ่มสมาชิกก่อน</p></div>`;
  }

  const fields = d.criteria.map(c => {
    const key = personScoreKey('admin', g.id, adminEvalMember, c.id);
    const val = d.scores[key];

    return `
      <div class="score-row">
        <span style="font-size:16px;font-weight:700">
          ${esc(c.name)}
          <span class="tag-max">(เต็ม ${c.max})</span>
        </span>
        <input type="number" class="admin-si"
          min="0" max="${c.max}"
          data-gid="${g.id}"
          data-member="${encodeURIComponent(adminEvalMember)}"
          data-cid="${c.id}"
          data-max="${c.max}"
          value="${val != null ? val : ''}">
      </div>`;
  }).join('');

  
  return `
    <div class="card">
      <h3 style="font-size:21px;font-weight:800;margin-bottom:16px">
        📝 แบบประเมินรายบุคคล
      </h3>

      <div class="field">
        <label style="font-size:15px;font-weight:700">เลือกกลุ่ม</label>
        <select onchange="setAdminEvalGroup(this.value)">
          ${d.groups.map(x => `
            <option value="${x.id}" ${x.id === g.id ? 'selected' : ''}>
              ${esc(x.name)}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="field">
        <label style="font-size:15px;font-weight:700">เลือกนักเรียน</label>
        <select style="font-size:17px;font-weight:700"
          onchange="setAdminEvalMember(this.value)">
          ${members.map(m => `
            <option value="${esc(m.name)}"
              ${m.name === adminEvalMember ? 'selected' : ''}>
              ${esc(m.name)} | เลขประจำตัว: ${esc(m.studentId || '-')} | ${esc(m.level || '-')}
            </option>
          `).join('')}
        </select>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size:20px;font-weight:800">
        👤 กำลังประเมิน: ${esc(adminEvalMember)}
      </h3>
      <p class="muted" style="font-size:14px;margin:6px 0 18px">
        ${esc(g.name)} · ผู้ประเมิน ${esc(d.adminName)}
      </p>
      ${fields}
      <button class="btn btn-good"
        style="margin-top:14px;width:100%;font-size:16px;font-weight:800;padding:14px"
        onclick="doSaveAdmin()">
        💾 บันทึกคะแนนของ ${esc(adminEvalMember)}
      </button>
    </div>`;

}
  window.setAdminEvalGroup = async gid => {
    adminEvalGroup = gid;
    adminEvalMember = '';
    await drawAdmin();
  };

  window.setAdminEvalMember = async member => {
    adminEvalMember = member;
    await drawAdmin();
  };
  
window.doSaveAdmin = async () => {
  const d = await load();

  if (!d.scores) d.scores = {};

  document.querySelectorAll('.admin-si').forEach(inp => {
    const member = decodeURIComponent(inp.dataset.member);

    const key = personScoreKey(
      'admin',
      inp.dataset.gid,
      member,
      inp.dataset.cid
    );

    if (inp.value.trim() === '') {
      delete d.scores[key];
      return;
    }

    let v = Number(inp.value);
    const max = Number(inp.dataset.max);

    if (!Number.isFinite(v)) v = 0;

    v = Math.max(0, Math.min(max, v));

    d.scores[key] = v;
  });

  await save(d);

  alert('บันทึกคะแนนแอดมินแล้ว');

  await drawAdmin();
};


let evalGroup = null;
let evalMember = '';

async function drawEvaluator() {
  const d = await load();

  if (!d.scores) d.scores = {};

  if (!evalGroup || !d.groups.some(g => g.id === evalGroup)) {
    evalGroup = d.groups.length ? d.groups[0].id : null;
    evalMember = '';
  }

  const g = d.groups.find(x => x.id === evalGroup);
  const members = g ? (g.members || []) : [];

  if (g && !members.some(m => m.name === evalMember)) {
    evalMember = members[0]?.name || '';
  }
    
  const selectedMember = members.find(m => m.name === evalMember);

  let scoreForm = '';

  if (!d.groups.length) {
    scoreForm = `<div class="card">
      <p class="muted">รอแอดมินเพิ่มกลุ่มก่อน</p>
    </div>`;
  } else if (!d.criteria.length) {
    scoreForm = `<div class="card">
      <p class="muted">รอแอดมินกำหนดเกณฑ์การให้คะแนน</p>
    </div>`;
  } else if (!members.length) {
    scoreForm = `<div class="card">
      <p class="muted">กลุ่มนี้ยังไม่มีสมาชิก กรุณาติดต่อแอดมิน</p>
    </div>`;
  } else {
    const fields = d.criteria.map(c => {
      const key = personScoreKey(
        session.evId, g.id, evalMember, c.id
      );
      const val = d.scores[key];

      return `<div class="score-row">
        <span style="font-size:16px;font-weight:700">
          ${esc(c.name)}
          <span class="tag-max">(เต็ม ${c.max})</span>
        </span>
        <input type="number" class="si"
          min="0" max="${c.max}"
          data-gid="${g.id}"
          data-member="${encodeURIComponent(evalMember)}"
          data-cid="${c.id}"
          data-max="${c.max}"
          value="${val != null ? val : ''}">
      </div>`;
    }).join('');

    scoreForm = `
      <div class="card">
        <h3 style="font-size:21px;font-weight:800">
          📝 แบบประเมินรายบุคคล
        </h3>

        <div class="field">
          <label style="font-size:15px;font-weight:700">
            เลือกนักเรียน
          </label>
          <select style="font-size:17px;font-weight:700"
            onchange="setEvalMember(this.value)">
            ${members.map(m => `
              <option value="${esc(m.name)}"
                ${m.name === evalMember ? 'selected' : ''}>
              ${esc(m.name)}
            </option>
          `).join('')}
          </select>
        </div>

        <div style="margin:12px 0 8px;padding:14px;background:#f0f5fb;border-radius:10px">
  <div style="font-size:18px;font-weight:800;color:#183b63">
    👤 ${esc(selectedMember?.name || '-')}
  </div>

  <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:8px;font-size:14px;color:#667085">
    <span>เลขประจำตัว: <b>${esc(selectedMember?.studentId || '-')}</b></span>
    <span>ระดับชั้น: <b>${esc(selectedMember?.level || '-')}</b></span>
  </div>
</div>

        <p class="muted" style="font-size:14px;margin:6px 0 18px">
          ${esc(g.name)} · ผู้ประเมิน ${esc(session.name)}
        </p>

        ${fields}

        <button class="btn btn-good"
          style="margin-top:14px;width:100%;font-size:16px;font-weight:800;padding:14px"
          onclick="doSave()">
          💾 บันทึกคะแนนของ ${esc(evalMember)}
        </button>
      </div>`;
  }

  // สรุปคะแนนที่ผู้ประเมินคนนี้เคยให้
  const myRows = d.groups.flatMap(grp =>
    (grp.members || []).flatMap(member =>
      d.criteria.map(c => {
        const key = personScoreKey(
          session.evId, grp.id, member, c.id
        );

        const val = d.scores[key];

        if (val == null) return '';

        return `<tr>
          <td>${esc(grp.name)}</td>
          <td>${esc(member)}</td>
          <td>${esc(c.name)}</td>
          <td>${val} / ${c.max}</td>
        </tr>`;
      })
    )
  ).filter(Boolean).join('');

  set(`
    <div class="topbar">
      <div>
        <h2>ระบบประเมินโปรเจกต์นักเรียน</h2>
        <div class="sub">
          ${esc(session.name)}
          <span class="badge badge-ev">ผู้ประเมิน</span>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline" onclick="editMyNickname()">
          ✏️ แก้ชื่อเล่น
        </button>
        <button class="btn btn-outline" onclick="doLogout()">
          ออกจากระบบ
         </button>
        </div>
    </div>

    <div class="card">
      <label style="font-size:15px;font-weight:700">
        เลือกกลุ่มที่จะให้คะแนน
      </label>
      <select onchange="setEvalGroup(this.value)">
        ${d.groups.map(x => `
          <option value="${x.id}"
            ${x.id === evalGroup ? 'selected' : ''}>
            ${esc(x.name)}
          </option>
        `).join('') || '<option>ยังไม่มีกลุ่ม</option>'}
      </select>
    </div>

    ${scoreForm}

    <div class="card">
      <b style="font-size:17px">
        📊 คะแนนที่คุณให้ไปแล้ว
      </b>
      <div class="overflow" style="margin-top:10px">
        ${myRows
          ? `<table>
              <tr>
                <th>กลุ่ม</th>
                <th>นักเรียน</th>
                <th>เกณฑ์</th>
                <th>คะแนน</th>
              </tr>
              ${myRows}
            </table>`
          : `<p class="muted" style="font-size:13px;padding:6px 0">
              ยังไม่มีคะแนน
            </p>`}
      </div>
    </div>
  `);
}

window.setEvalGroup = async gid => {
  evalGroup = gid;
  evalMember = '';
  await drawEvaluator();
};

window.setEvalMember = async member => {
  evalMember = member;
  await drawEvaluator();
};

window.doSave = async () => {
  const d = await load();

  if (!d.scores) d.scores = {};

  document.querySelectorAll('.si').forEach(inp => {
    const member = decodeURIComponent(inp.dataset.member);

    const key = personScoreKey(
      session.evId,
      inp.dataset.gid,
      member,
      inp.dataset.cid
    );

    if (inp.value.trim() === '') {
      delete d.scores[key];
      return;
    }

    let v = Number(inp.value);
    const max = Number(inp.dataset.max);

    if (!Number.isFinite(v)) v = 0;

    v = Math.max(0, Math.min(max, v));

    d.scores[key] = v;
  });

  const saved = await save(d);

  if (!saved) return;

  alert('บันทึกคะแนนเรียบร้อยแล้ว');

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
   // แอดมินแก้ชื่อแสดงผลของตัวเอง
window.editAdminNickname = async () => {
  const d = await load();

  const newName = prompt(
    'กรอกชื่อแสดงผลใหม่ของแอดมิน',
    d.adminName || ''
  );

  if (newName === null) return;

  const name = newName.trim();

  if (!name) {
    alert('กรุณากรอกชื่อ');
    return;
  }

  d.adminName = name;

  const saved = await save(d);
  if (saved === false) return;

  session.name = name;
  saveSession();

  await drawAdmin();
};


// ผู้ประเมินแก้ชื่อเล่นของตัวเอง
window.editMyNickname = async () => {
  const d = await load();

  const ev = (d.evaluators || []).find(
    e => e.id === session.evId
  );

  if (!ev) {
    alert('ไม่พบบัญชีผู้ประเมิน');
    return;
  }

  const newName = prompt(
    'กรอกชื่อเล่นใหม่',
    ev.nickname || ''
  );

  if (newName === null) return;

  const nickname = newName.trim();

  if (!nickname) {
    alert('กรุณากรอกชื่อเล่น');
    return;
  }

  ev.nickname = nickname;
  ev.nicknameSet = true;

  const saved = await save(d);
  if (saved === false) return;

  session.name = nickname;
  saveSession();

  await drawEvaluator();
};


// แอดมินแก้ชื่อเล่นของผู้ประเมิน
window.doEditEvNickname = async (id) => {
  const d = await load();

  const ev = (d.evaluators || []).find(
    e => e.id === id
  );

  if (!ev) {
    alert('ไม่พบบัญชีผู้ประเมิน');
    return;
  }

  const newName = prompt(
    'กรอกชื่อเล่นใหม่ของผู้ประเมิน',
    ev.nickname || ''
  );

  if (newName === null) return;

  const nickname = newName.trim();

  if (!nickname) {
    alert('กรุณากรอกชื่อเล่น');
    return;
  }

  ev.nickname = nickname;
  ev.nicknameSet = true;

  const saved = await save(d);
  if (saved === false) return;

  alert('แก้ไขชื่อเล่นเรียบร้อยแล้ว');
  await drawAdmin();
};
// บันทึกชื่อแสดงผลของแอดมินจากหน้าตั้งค่าบัญชี
window.doSaveAdminDisplayName = async () => {
  const input = document.getElementById('adminDisplayNameEdit');

  const name = input.value.trim();

  if (!name) {
    showErr(
      'errAdminDisplayName',
      'กรุณากรอกชื่อที่ต้องการแสดง'
    );
    return;
  }

  const d = await load();

  d.adminName = name;
  d.adminDisplayNameSet = true;

  const saved = await save(d);

  if (saved === false) return;

  session.name = name;
  saveSession();

  alert('บันทึกชื่อแสดงผลเรียบร้อยแล้ว');

  await drawAdmin();
};
window.addEventListener("load", async () => {
  await boot();
});
