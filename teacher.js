import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const root = document.querySelector("#app");
const esc = (s) => String(s ?? "").replaceAll("<", "&lt;");

function page(title, innerHtml) {
  root.innerHTML = `
    <div class="container">
      <div class="header">
        <div class="brand">
          <h1>${esc(title)}</h1>
          <div class="sub">Teachers portal</div>
        </div>
        <div class="top-actions" id="topActions"></div>
      </div>
      ${innerHtml}
    </div>
  `;
}

function card(html) {
  return `<div class="card">${html}</div>`;
}

function setTopActions(html) {
  const el = document.querySelector("#topActions");
  if (el) el.innerHTML = html;
}

function bindTopOut() {
  const btn = document.querySelector("#topOut");
  if (btn) btn.onclick = signOut;
}

async function signOut() {
  await supabase.auth.signOut();
  location.reload();
}

async function signUpEmail(email, password) {
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
}

async function signInEmail(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function getSessionUser() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session?.user ?? null;
}

async function isTeacher() {
  // teacher_profiles policy allows teacher to read only their own row, so:
  // - if select returns 1 row -> teacher
  // - if empty -> not a teacher yet
  const { data, error } = await supabase
    .from("teacher_profiles")
    .select("user_id,email,is_active,full_name,class_level,school")
    .limit(1);

  if (error) throw error;
  const row = data?.[0];
  return row && row.is_active === true ? row : null;
}

async function claimTeacher({ code, full_name, class_level, school }) {
  // Calls your SQL function from earlier:
  // public.claim_teacher_master_invite(p_code, p_full_name, p_class_level, p_school)
  const { data, error } = await supabase.rpc("claim_teacher_master_invite", {
    p_code: code,
    p_full_name: full_name,
    p_class_level: class_level,
    p_school: school,
  });
  if (error) throw error;
  if (data?.ok !== true) throw new Error(data?.error || "Could not claim teacher access");
  return data;
}

async function loadLeaderboard() {
  // Uses the view public.leaderboard you created.
  const { data, error } = await supabase
    .from("leaderboard")
    .select("*")
    .order("points", { ascending: false })
    .limit(300);

  if (error) throw error;
  return data ?? [];
}

function leaderboardTable(rows) {
  const body = rows.map(r => `
    <tr>
      <td>${r.points ?? 0}</td>
      <td>${esc(r.nombre)}</td>
      <td>${esc(r.teacher_name ?? "")}</td>
      <td>${esc(r.period ?? "")}</td>
      <td>${esc(r.clase)}</td>
      <td class="mono">${esc(r.user_id).slice(0, 12)}...</td>
    </tr>
  `).join("");

  return `
    <div class="smallMuted" style="margin-bottom:10px;">
      Showing locked brackets only.
    </div>
    <table class="adminTable">
      <thead>
        <tr><th>Points</th><th>Name</th><th>Teacher</th><th>Period</th><th>Class</th><th>User</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}
// ---------- Renders ----------

async function renderLoggedOut() {
  page("Teachers", `
    ${card(`
      <h2>Sign up / Sign in</h2>
      <p class="hint">Teachers use email + password (no Google). Then enter the master invite code to unlock teacher access.</p>

      <div class="grid2">
        <div>
          <h3>Create account</h3>
          <div class="label">Email</div>
          <input class="input" id="su_email" placeholder="teacher@school.org" />
          <div class="label">Password</div>
          <input class="input" id="su_pass" type="password" placeholder="••••••••" />
          <div style="margin-top:10px;">
            <button class="btn primary" id="btnSignup" type="button">Create account</button>
          </div>
          <div class="note">If email confirmations are disabled in Supabase Auth, the account is usable immediately.</div>
        </div>

        <div>
          <h3>Sign in</h3>
          <div class="label">Email</div>
          <input class="input" id="si_email" placeholder="teacher@school.org" />
          <div class="label">Password</div>
          <input class="input" id="si_pass" type="password" placeholder="••••••••" />
          <div style="margin-top:10px;">
            <button class="btn" id="btnSignin" type="button">Sign in</button>
          </div>
        </div>
      </div>

      <div id="msg" style="margin-top:12px;"></div>
    `)}
  `);

  setTopActions("");

  const msg = (t, bad=false) => {
    document.querySelector("#msg").innerHTML = bad
      ? `<div class="errorBox">${esc(t)}</div>`
      : `<div class="pill ok">${esc(t)}</div>`;
  };

  document.querySelector("#btnSignup").onclick = async () => {
    try {
      msg("Creating account…");
      await signUpEmail(
        document.querySelector("#su_email").value.trim(),
        document.querySelector("#su_pass").value
      );
      msg("Account created. Now sign in.");
    } catch (e) {
      msg(e.message ?? String(e), true);
    }
  };

  document.querySelector("#btnSignin").onclick = async () => {
    try {
      msg("Signing in…");
      await signInEmail(
        document.querySelector("#si_email").value.trim(),
        document.querySelector("#si_pass").value
      );
      await main();
    } catch (e) {
      msg(e.message ?? String(e), true);
    }
  };
}

async function renderNeedsClaim(user) {
  page("Teachers", `
    ${card(`
      <h2>Teacher setup</h2>
      <p class="hint">Fill this out once. You’ll be auto-added as a teacher after you submit.</p>

      <div class="label">Signed in as</div>
      <div class="mono">${esc(user.email)}</div>

      <hr class="sep" />

      <div class="label">Master invite code</div>
      <input class="input mono" id="code" placeholder="CODE" />

      <div class="grid2" style="margin-top:10px;">
        <div>
          <div class="label">Full name</div>
          <input class="input" id="name" placeholder="Ms. Garcia" />
        </div>
        <div>
          <div class="label">Class level</div>
          <input class="input" id="level" placeholder="Spanish 2 / AP / etc" />
        </div>
      </div>

      <div style="margin-top:10px;">
        <div class="label">School</div>
        <input class="input" id="school" placeholder="Skyline High School" />
      </div>

      <div style="margin-top:12px; display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn primary" id="btnClaim" type="button">Submit & unlock</button>
        <button class="btn danger" id="btnOut" type="button">Sign out</button>
      </div>

      <div id="msg" style="margin-top:12px;"></div>
    `)}
  `);

  // show top signout too (optional)
  setTopActions(`<button class="btn danger small" id="topOut" type="button">Sign out</button>`);
  bindTopOut();

  const msg = (t, bad=false) => {
    document.querySelector("#msg").innerHTML = bad
      ? `<div class="errorBox">${esc(t)}</div>`
      : `<div class="pill ok">${esc(t)}</div>`;
  };

  document.querySelector("#btnOut").onclick = signOut;

  document.querySelector("#btnClaim").onclick = async () => {
    try {
      msg("Submitting…");
      await claimTeacher({
        code: document.querySelector("#code").value.trim(),
        full_name: document.querySelector("#name").value.trim(),
        class_level: document.querySelector("#level").value.trim(),
        school: document.querySelector("#school").value.trim(),
      });
      msg("Unlocked. Loading leaderboard…");
      await main();
    } catch (e) {
      msg(e.message ?? String(e), true);
    }
  };
}

async function renderTeacherDashboard(user, profile) {
  page("Leaderboard", `
    ${card(`
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;">
        <div>
          <h2>Teacher dashboard</h2>
          <div class="smallMuted">Signed in: <span class="mono">${esc(user.email)}</span></div>
          <div class="smallMuted">Profile: ${esc(profile.full_name ?? "")} � ${esc(profile.class_level ?? "")} � ${esc(profile.school ?? "")}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn" id="btnRefresh" type="button">Refresh</button>
          <button class="btn danger" id="btnOut" type="button">Sign out</button>
        </div>
      </div>

      <div class="grid2" style="margin-top:12px;">
        <div>
          <div class="label">Teacher</div>
          <select class="input" id="teacherFilter">
            <option value="">All teachers</option>
          </select>
        </div>
        <div>
          <div class="label">Period</div>
          <select class="input" id="periodFilter">
            <option value="">All periods</option>
          </select>
        </div>
      </div>

      <div id="wrap" style="margin-top:12px;">Loading...</div>
    `)}
  `);

  setTopActions(`<button class="btn danger small" id="topOut" type="button">Sign out</button>`);
  bindTopOut();

  document.querySelector("#btnOut").onclick = signOut;

  let allRows = [];
  let selectedTeacher = "";
  let selectedPeriod = "";

  const renderRows = () => {
    const wrap = document.querySelector("#wrap");
    const filtered = allRows.filter((r) => {
      const teacherOk = !selectedTeacher || String(r.teacher_name ?? "") === selectedTeacher;
      const periodOk = !selectedPeriod || String(r.period ?? "") === selectedPeriod;
      return teacherOk && periodOk;
    });

    wrap.innerHTML = filtered.length
      ? leaderboardTable(filtered)
      : `<div class="smallMuted">No rows for selected filters.</div>`;
  };

  const bindFilters = () => {
    const teacherSel = document.querySelector("#teacherFilter");
    const periodSel = document.querySelector("#periodFilter");

    const teachers = [...new Set(allRows.map(r => String(r.teacher_name ?? "")).filter(Boolean))].sort();
    const periods = [...new Set(allRows.map(r => String(r.period ?? "")).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    teacherSel.innerHTML = `<option value="">All teachers</option>` +
      teachers.map((t) => `<option value="${esc(t)}">${esc(t)}</option>`).join("");

    periodSel.innerHTML = `<option value="">All periods</option>` +
      periods.map((p) => `<option value="${esc(p)}">${esc(p)}</option>`).join("");

    teacherSel.value = selectedTeacher;
    periodSel.value = selectedPeriod;

    teacherSel.onchange = () => {
      selectedTeacher = teacherSel.value;
      renderRows();
    };

    periodSel.onchange = () => {
      selectedPeriod = periodSel.value;
      renderRows();
    };
  };

  const refresh = async () => {
    const wrap = document.querySelector("#wrap");
    wrap.textContent = "Loading...";
    try {
      allRows = await loadLeaderboard();
      if (!allRows.length) {
        wrap.innerHTML = `<div class="smallMuted">No locked brackets yet.</div>`;
        return;
      }
      bindFilters();
      renderRows();
    } catch (e) {
      wrap.innerHTML = `<div class="errorBox">${esc(e.message ?? String(e))}</div>`;
    }
  };

  document.querySelector("#btnRefresh").onclick = refresh;
  await refresh();
}
// ---------- main ----------
async function main() {
  const user = await getSessionUser();
  if (!user) {
    await renderLoggedOut();
    return;
  }

  // If teacher profile exists -> dashboard. Else -> claim form.
  const profile = await isTeacher();
  if (!profile) {
    await renderNeedsClaim(user);
    return;
  }

  await renderTeacherDashboard(user, profile);
}

main().catch(e => {
  page("Teachers", card(`<div class="errorBox">Fatal error: ${esc(e.message ?? String(e))}</div>`));
});


