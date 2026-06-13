auth.onAuthStateChanged(async (user) => {
  if (!user) {
    showScreen("auth");
    return;
  }

  let snap = await db.collection("users").doc(user.uid).get();

  if (!snap.exists) {
    const defaultData = {
      fullName: user.displayName || "",
      email: user.email || "",
      role: "member",
      phone: "",
      dob: "",
      age: 0,
      aadhaar: "",
      pan: "",
      city: "",
      state: "",
      pinCode: "",
      fullAddress: ""
    };
    await db.collection("users").doc(user.uid).set(defaultData);
    snap = await db.collection("users").doc(user.uid).get();
  }

  window._user = user;
  window._userData = snap.data();

  showScreen("app");
  if (typeof initApp === "function") {
    initApp(user, window._userData);
  } else {
    console.error("initApp is not defined");
  }
});

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();
  const errEl = document.getElementById("loginError");
  errEl.textContent = "";
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    errEl.textContent = friendlyError(err.code);
  }
});

document.getElementById("registerForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fullName = document.getElementById("regName").value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value.trim();
  const role = document.getElementById("regRole").value;
  const errEl = document.getElementById("regError");
  errEl.textContent = "";
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection("users").doc(cred.user.uid).set({
      fullName,
      email,
      role,
      phone: "",
      dob: "",
      age: 0,
      aadhaar: "",
      pan: "",
      city: "",
      state: "",
      pinCode: "",
      fullAddress: ""
    });
    showToast("Account created successfully");
  } catch (err) {
    errEl.textContent = friendlyError(err.code);
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  if (window.unsubscribeTasks) window.unsubscribeTasks();
  if (window.unsubscribeUsers) window.unsubscribeUsers();
  if (window.unsubscribeNotifs) window.unsubscribeNotifs();
  await auth.signOut();
  showScreen("auth");
});

document.getElementById("loginTabBtn")?.addEventListener("click", () => {
  document.getElementById("loginTabBtn").classList.add("active");
  document.getElementById("registerTabBtn").classList.remove("active");
  document.getElementById("loginForm").classList.add("active");
  document.getElementById("registerForm").classList.remove("active");
});

document.getElementById("registerTabBtn")?.addEventListener("click", () => {
  document.getElementById("registerTabBtn").classList.add("active");
  document.getElementById("loginTabBtn").classList.remove("active");
  document.getElementById("registerForm").classList.add("active");
  document.getElementById("loginForm").classList.remove("active");
});

function friendlyError(code) {
  const map = {
    "auth/user-not-found": "No account found with this email.",
    "auth/wrong-password": "Incorrect password.",
    "auth/email-already-in-use": "Email already registered.",
    "auth/invalid-email": "Invalid email address.",
    "auth/weak-password": "Password must be at least 6 characters.",
    "auth/too-many-requests": "Too many attempts. Try again later.",
    "auth/invalid-credential": "Invalid email or password."
  };
  return map[code] || "Something went wrong. Try again.";
}