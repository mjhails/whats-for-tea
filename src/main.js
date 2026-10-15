import "./styles.css";
import { watchAuth, signIn, signUp, signInWithGoogle } from "./firebase.js";
import { startApp } from "./app.js";

const $ = (id) => document.getElementById(id);
let mode = "signin";

function friendlyError(e) {
  const c = (e && e.code) || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found"))
    return "That email and password don't match. Use the same details as Kcal Tracker.";
  if (c.includes("email-already-in-use")) return "There's already an account with that email. Sign in instead.";
  if (c.includes("weak-password")) return "Use a password of at least 6 characters.";
  if (c.includes("invalid-email")) return "Check the email address.";
  if (c.includes("popup-closed")) return "";
  if (c.includes("network")) return "Couldn't connect. Check your internet and try again.";
  return "Couldn't sign in. Try again.";
}

function setMode(m) {
  mode = m;
  $("authName").hidden = m !== "signup";
  $("authTitle").textContent = m === "signup" ? "Create your account" : "Sign in";
  $("authSubmit").textContent = m === "signup" ? "Create account" : "Sign in";
  $("authToggle").textContent = m === "signup" ? "Already have an account? Sign in" : "New here? Create an account";
  $("authError").textContent = "";
}

function busy(on) {
  ["authSubmit", "authGoogle"].forEach((id) => ($(id).disabled = on));
}

$("authForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  busy(true);
  $("authError").textContent = "";
  try {
    const email = $("authEmail").value.trim();
    const pw = $("authPassword").value;
    if (mode === "signup") await signUp(email, pw, $("authName").value.trim());
    else await signIn(email, pw);
  } catch (e) {
    $("authError").textContent = friendlyError(e);
  } finally {
    busy(false);
  }
});
$("authGoogle").addEventListener("click", async () => {
  busy(true);
  $("authError").textContent = "";
  try {
    await signInWithGoogle();
  } catch (e) {
    $("authError").textContent = friendlyError(e);
  } finally {
    busy(false);
  }
});
$("authToggle").addEventListener("click", () => setMode(mode === "signup" ? "signin" : "signup"));

watchAuth((user) => {
  $("boot").hidden = true;
  if (user) {
    $("auth").hidden = true;
    $("appRoot").hidden = false;
    startApp(user);
  } else {
    $("appRoot").hidden = true;
    $("auth").hidden = false;
  }
});
