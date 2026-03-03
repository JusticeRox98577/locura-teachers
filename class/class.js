import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== Supabase (same project as your bracket) =====
const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";

// ===== Tables (assumptions) =====
// This page creates + reads rows from: public.classes
//
// Your actual columns (from screenshot):
// id uuid (NOT NULL)
// teacher_id uuid (NOT NULL)
// teacher_name text (NOT NULL)
// class_level text (NOT NULL)
// period text (NOT NULL)
// school text (nullable)
// created_at timestamptz (NOT NULL)
// teacher_user_id uuid (nullable)
// is_active boolean (NOT NULL)
// level text (nullable)
//
// This file will use the NOT-NULL schema columns:
// teacher_id, teacher_name, class_level, period, is_active
const TBL_CLASSES = "classes";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let session = null;
let user = null;
let classes = [];
let loading = true;
let errorMsg = "";

const $ = (sel) => document.querySelector(sel);

function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k === "html") n.innerHTML = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  }
  for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
  return n;
}

function setError(msg) {
  errorMsg = msg || "";
  render();
}

async function init() {
  render();

  const { data } = await supabase.auth.getSession();
  session = data.session;
  user = session?.user ?? null;

  supabase.auth.onAuthStateChange((_evt, newSession) => {
    session = newSession;
    user = newSession?.user ?? null;
    boot().catch((e) => setError(e?.message || String(e)));
  });

  await boot();
}

async function boot() {
  loading = true;
  setError("");
  render();

  if (user) {
    await fetchMyClasses();
  } else {
    classes = [];
  }

  loading = false;
  render();
}

async function signUp(email, password) {
  setError("");
  const { error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // If email confirmations are OFF, you’ll be logged in immediately.
  // If confirmations are ON, you’ll need to confirm email first.
  // Either way, boot() will run on auth state change if a session is created.
}

async function signIn(email, password) {
  setError("");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

async function signOut() {
  setError("");
  await supabase.auth.signOut();
}

async function fetchMyClasses() {
  // IMPORTANT: your real ownership column is teacher_id (NOT NULL)
  const { data, error } = await supabase
    .from(TBL_CLASSES)
    .select("*")
    .eq("teacher_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  classes = data || [];
}

async function createClass({ teacher_name, class_level, period }) {
  setError("");

  // Basic validation
  teacher_name = (teacher_name || "").trim();
  class_level = (class_level || "").trim();
  period = (period || "").trim();

  if (!teacher_name) throw new Error("Teacher name is required.");
  if (!class_level) throw new Error("Class level is required.");
  if (!period) throw new Error("Period is required.");

  // Your table requires: teacher_id, teacher_name, class_level, period, is_active
  const row = {
    teacher_id: user.id,
    // keep teacher_user_id in sync too (optional column in your table, but harmless/helpful)
    teacher_user_id: user.id,
    teacher_name,
    class_level,
    period,
    is_active: true,
  };

  const { error } = await supabase.from(TBL_CLASSES).insert(row);
  if (error) throw error;

  await fetchMyClasses();
}

async function deleteClass(classId) {
  setError("");
  const { error } = await supabase
    .from(TBL_CLASSES)
    .delete()
    .eq("id", classId)
    .eq("teacher_id", user.id);

  if (error) throw error;
  await fetchMyClasses();
}

function render() {
  const root = $("#app");
  if (!root) return;

  root.innerHTML = "";

  const container = el("div", { class: "container" }, []);
  root.appendChild(container);

  container.appendChild(
    el("div", { class: "header" }, [
      el("div", { class: "brand" }, [
        el("h1", {}, ["Teacher Classes"]),
        el("div", { class: "sub" }, ["Create and manage class sections for student join dropdown."]),
      ]),
      el("div", { class: "top-actions" }, [
        user
          ? el("button", { class: "btn", onclick: () => signOut().catch((e) => setError(e.message)) }, ["Sign out"])
          : el("div", { class: "smallMuted" }, ["Not signed in"]),
      ]),
    ])
  );

  if (errorMsg) {
    container.appendChild(
      el("div", { class: "errorBox" }, [
        el("div", { class: "mono" }, ["Error: " + errorMsg]),
      ])
    );
  }

  if (loading) {
    container.appendChild(
      el("div", { class: "card" }, [
        el("h2", {}, ["Loading…"]),
        el("p", { class: "hint" }, ["Checking session and loading your classes."]),
      ])
    );
    return;
  }

  if (!user) {
    container.appendChild(renderAuthCard());
    return;
  }

  container.appendChild(renderDashboard());
  container.appendChild(renderCreateClass());
  container.appendChild(renderClassList());
}

function renderAuthCard() {
  const emailDefault = "";

  const emailUp = el("input", { class: "input", id: "emailUp", placeholder: "Email", value: emailDefault });
  const passUp = el("input", { class: "input", id: "passUp", placeholder: "Password", type: "password" });

  const emailIn = el("input", { class: "input", id: "emailIn", placeholder: "Email", value: emailDefault });
  const passIn = el("input", { class: "input", id: "passIn", placeholder: "Password", type: "password" });

  const wrap = el("div", { class: "card" }, [
    el("h2", {}, ["Please sign in."]),
    el("p", { class: "hint" }, ["Teachers use email + password (no Google)."]),
    el("div", { class: "grid2" }, [
      el("div", {}, [
        el("h3", {}, ["Create account"]),
        el("div", { class: "label" }, ["Email"]),
        emailUp,
        el("div", { class: "label" }, ["Password"]),
        passUp,
        el("div", { style: "height:12px" }, []),
        el("button", {
          class: "btn primary",
          onclick: async () => {
            try {
              await signUp(emailUp.value, passUp.value);
            } catch (e) {
              setError(e?.message || String(e));
            }
          }
        }, ["Create account"]),
        el("p", { class: "smallMuted" }, [
          "If email confirmations are enabled in Supabase Auth, you may need to confirm first."
        ]),
      ]),
      el("div", {}, [
        el("h3", {}, ["Sign in"]),
        el("div", { class: "label" }, ["Email"]),
        emailIn,
        el("div", { class: "label" }, ["Password"]),
        passIn,
        el("div", { style: "height:12px" }, []),
        el("button", {
          class: "btn",
          onclick: async () => {
            try {
              await signIn(emailIn.value, passIn.value);
            } catch (e) {
              setError(e?.message || String(e));
            }
          }
        }, ["Sign in"]),
      ]),
    ]),
  ]);

  return wrap;
}

function renderDashboard() {
  return el("div", { class: "card" }, [
    el("h2", {}, ["Teacher dashboard"]),
    el("p", { class: "hint" }, [
      "Signed in as ",
      el("span", { class: "mono" }, [user.email]),
      "."
    ]),
    el("div", { class: "pillrow" }, [
      el("div", { class: "pill ok" }, ["Class admin"]),
    ]),
  ]);
}

function renderCreateClass() {
  const teacherName = el("input", { class: "input", id: "tName", placeholder: "Teacher name (e.g., Ms. Smith)" });
  const classLevel = el("input", { class: "input", id: "tLevel", placeholder: "Class level (e.g., Spanish 2)" });
  const period = el("input", { class: "input", id: "tPeriod", placeholder: "Period (e.g., 3rd)" });

  return el("div", { class: "card" }, [
    el("h2", {}, ["Create a class"]),
    el("p", { class: "hint" }, ["Students will pick from these in the dropdown on the student site."]),
    el("div", { class: "grid2" }, [
      el("div", {}, [el("div", { class: "label" }, ["Teacher name"]), teacherName]),
      el("div", {}, [el("div", { class: "label" }, ["Class level"]), classLevel]),
      el("div", {}, [el("div", { class: "label" }, ["Period"]), period]),
      el("div", {}, [
        el("button", {
          class: "btn primary",
          onclick: async () => {
            try {
              await createClass({
                teacher_name: teacherName.value,
                class_level: classLevel.value,
                period: period.value,
              });
              teacherName.value = "";
              classLevel.value = "";
              period.value = "";
              render();
            } catch (e) {
              setError(e?.message || String(e));
            }
          }
        }, ["Create class"])
      ]),
    ]),
  ]);
}

function renderClassList() {
  const wrap = el("div", { class: "card" }, [
    el("h2", {}, ["Your classes"]),
    el("p", { class: "hint" }, ["These are the class options students will see."]),
  ]);

  if (!classes.length) {
    wrap.appendChild(el("div", { class: "note" }, ["No classes yet. Create one above."]));
    return wrap;
  }

  for (const c of classes) {
    // Your canonical column is class_level, but we fall back to level if needed
    const lvl = c.class_level ?? c.level ?? "";
    const title = `${c.teacher_name} • ${lvl} • Period ${c.period}`;

    wrap.appendChild(
      el("div", { class: "match" }, [
        el("div", { class: "matchTop" }, [
          el("div", {}, [
            el("div", { class: "matchCode" }, ["Class"]),
            el("div", { class: "smallMuted" }, [title]),
          ]),
          el("button", {
            class: "btn",
            onclick: async () => {
              try {
                await deleteClass(c.id);
                render();
              } catch (e) {
                setError(e?.message || String(e));
              }
            }
          }, ["Delete"]),
        ]),
      ])
    );
  }

  return wrap;
}

document.addEventListener("DOMContentLoaded", init);
