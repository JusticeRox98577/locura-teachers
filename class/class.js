import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://nkufgygqbzhtacvoqgmi.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_jpLHfC3L8-Nvw4q4xcgTCw_Y0qA_m_0";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const root = document.querySelector("#app");

function render(html){ root.innerHTML = html; }

async function getUser(){
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

async function loadClasses(){
  const { data } = await supabase
    .from("classes")
    .select("*")
    .order("created_at", { ascending:false });

  return data || [];
}

async function createClass(){
  const teacherName = document.querySelector("#teacher_name").value;
  const classLevel = document.querySelector("#class_level").value;
  const period = document.querySelector("#period").value;
  const school = document.querySelector("#school").value;

  const user = await getUser();

  await supabase.from("classes").insert({
    teacher_id: user.id,
    teacher_name: teacherName,
    class_level: classLevel,
    period: period,
    school: school
  });

  init();
}

async function init(){
  const user = await getUser();
  if(!user){
    render("<h2>Please sign in.</h2>");
    return;
  }

  const classes = await loadClasses();

  render(`
    <div class="container">
      <h1>Create a Class</h1>

      <input id="teacher_name" class="input" placeholder="Teacher Name" />
      <input id="class_level" class="input" placeholder="Class Level (Spanish 2, AP, etc)" />
      <input id="period" class="input" placeholder="Period (1st, 2nd, etc)" />
      <input id="school" class="input" placeholder="School" />
      <button id="create" class="primary">Create Class</button>

      <hr style="margin:40px 0; opacity:.2">

      <h2>Your Classes</h2>
      ${classes.map(c=>`
        <div class="card">
          <strong>${c.teacher_name}</strong><br>
          ${c.class_level} – Period ${c.period}<br>
          ${c.school ?? ""}
        </div>
      `).join("")}
    </div>
  `);

  document.querySelector("#create").onclick = createClass;
}

init();
