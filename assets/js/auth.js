/* ── Auth State Listener ─────────────────── */
auth.onAuthStateChanged(async (user) => {
  if (!user) { showScreen("auth"); return; }

  let snap = await db.collection("users").doc(user.uid).get();

  if (!snap.exists) {
    const defaultData = {
      fullName: user.displayName || "",
      email: user.email || "",
      role: "member",
      phone: "", dob: "", age: 0,
      aadhaar: "", pan: "", city: "",
      state: "", pinCode: "", fullAddress: ""
    };
    await db.collection("users").doc(user.uid).set(defaultData);
    snap = await db.collection("users").doc(user.uid).get();
  }

  window._user     = user;
  window._userData = snap.data();

  showScreen("app");
  initApp(user, window._userData);
});

/* ── Login ───────────────────────────────── */
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email    = v("loginEmail");
  const password = v("loginPassword");
  const errEl    = document.getElementById("loginError");
  errEl.textContent = "";
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) { errEl.textContent = friendlyError(err.code); }
});

/* ── Register ────────────────────────────── */
document.getElementById("registerForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = v("regName");
  const email    = v("regEmail");
  const password = v("regPassword");
  const role     = document.getElementById("regRole").value;
  const errEl    = document.getElementById("regError");
  errEl.textContent = "";
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(cred.user.uid).set({
      fullName, email, role,
      phone: "", dob: "", age: 0,
      aadhaar: "", pan: "", city: "",
      state: "", pinCode: "", fullAddress: ""
    });
    showToast("Account created — welcome to TeamSync");
  } catch (err) { errEl.textContent = friendlyError(err.code); }
});

/* ── Logout ──────────────────────────────── */
document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
  document.body.classList.remove("role-admin","role-member");
  showScreen("auth");
});

/* ── Tab toggle ──────────────────────────── */
document.querySelectorAll(".atab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".atab").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".aform").forEach(f => f.classList.remove("active"));
    document.getElementById(tab === "login" ? "loginForm" : "registerForm").classList.add("active");
  });
});

/* ── Helpers ─────────────────────────────── */
function v(id) { return document.getElementById(id).value.trim(); }

function friendlyError(code) {
  const m = {
    "auth/user-not-found":       "No account found with this email.",
    "auth/wrong-password":       "Incorrect password. Try again.",
    "auth/invalid-credential":   "Invalid email or password.",
    "auth/email-already-in-use": "This email is already registered.",
    "auth/invalid-email":        "Please enter a valid email address.",
    "auth/weak-password":        "Password must be at least 6 characters.",
    "auth/too-many-requests":    "Too many attempts. Please try again later."
  };
  return m[code] || "Something went wrong. Please try again.";
}