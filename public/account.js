// Account: save codes and passkeys, kept by the shared Accounts service like the other 88x31 games. A save code or a
// passkey brings your player (and your sealed runs) to another browser or device. Laid out after Dawn Baton's Account
// tab (dawn-baton public/index.html accountScreen); the passkey code (WebAuthn in the browser) is copied from there.

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
async function api(path, data) {
  const r = await fetch("/api/" + path, data ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) } : {});
  return r.json().catch(() => ({ error: "That didn't work. Try again." }));
}
const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (t) => { t = t.replace(/-/g, "+").replace(/_/g, "/"); return Uint8Array.from(atob(t + "===".slice((t.length + 3) % 4)), (c) => c.charCodeAt(0)); };
const pkOk = () => !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
const day = (s) => new Date(s * 1000).toLocaleDateString([], { month: "short", day: "numeric" });
const device = () => { const u = navigator.userAgent; return /Android/.test(u) ? "Android" : /iPhone|iPad/.test(u) ? "iPhone" : /Mac/.test(u) ? "Mac" : /Windows/.test(u) ? "Windows PC" : "This device"; };
const pkOops = (e) => (e && e.name === "NotAllowedError" ? "Passkey cancelled (or it timed out)." : (e && e.message) || "The passkey didn't work.");

let newCode = null, onChange = () => {};

async function show(msg = "") {
  const a = await api("account"), el = $("account"), has = a.codes.length || a.passkeys.length;
  el.innerHTML = `
    <div class="acct-head"><h2>Account</h2><button class="link" id="aclose" type="button">Close</button></div>
    <p class="m">${a.player ? `You're player ${a.id}, saved on ${a.devices} device${a.devices > 1 ? "s" : ""}.` : "No player here yet. Play a round, or log in below."}
      A save code or passkey brings your player and runs to another browser, and works in the other 88x31 games too.</p>
    ${newCode ? `<div class="p gold"><h3>Your new save code (shown once)</h3><div class="code">${esc(newCode)}</div>
      <p class="m">Write it down or keep it somewhere safe. Only a fingerprint of it is stored.</p>
      <div class="r"><button id="copycode" type="button">Copy</button><button id="dlcode" type="button">Download as a text file</button></div></div>` : ""}
    <div class="p"><h3>Save codes (${a.codes.length}/5)</h3>
      ${a.codes.map((c) => `<div class="r"><span class="m">made ${day(c.created_at)}${c.last_used_at ? ", used " + day(c.last_used_at) : ""}</span><button data-rm="codes" data-id="${c.id}" type="button">Forget</button></div>`).join("") || '<p class="m">None yet.</p>'}
      <button id="mkcode" type="button">Make a save code</button></div>
    <div class="p"><h3>Passkeys (${a.passkeys.length})</h3>
      ${a.passkeys.map((k) => `<div class="r"><span class="m">${esc(k.label || "passkey")}${k.created_at ? ", made " + day(k.created_at) : ""}</span><button data-rm="passkey" data-id="${k.id}" type="button">Forget</button></div>`).join("") || '<p class="m">None yet.</p>'}
      ${pkOk() ? '<button id="mkpk" type="button">Add a passkey</button>' : '<p class="m">This browser can\'t do passkeys. Use a save code instead.</p>'}</div>
    <div class="p"><h3>Log in on this device</h3>
      <div class="r"><input id="codein" placeholder="Save code" autocomplete="off" spellcheck="false" aria-label="Save code"><button id="usecode" type="button">Use code</button></div>
      ${pkOk() ? '<button id="pklogin" type="button">Log in with a passkey</button>' : ""}</div>
    ${has ? '<button class="link" id="logout" type="button">Log out of this browser</button>' : ""}
    <p class="m" id="amsg" role="status">${esc(msg)}</p>`;
  wire();
}

function wire() {
  const say = (t) => { $("amsg").textContent = t; };
  const on = (id, f) => { const b = $(id); if (b) b.onclick = async () => { try { await f(); } catch (e) { say(e.message || String(e)); } }; };
  const changed = async (msg) => { newCode = null; await show(msg); onChange(); };
  on("aclose", async () => { newCode = null; $("account").hidden = true; });
  on("mkcode", async () => { const r = await api("codes", { action: "new" }); if (r.error) return say(r.error); newCode = r.code; await show(); onChange(); });
  on("copycode", async () => { try { await navigator.clipboard.writeText(newCode); say("Copied. Keep it somewhere safe."); } catch { say("Couldn't copy. Select the code and copy it by hand."); } });
  on("dlcode", async () => {
    const text = `Beat Fighter II save code\r\n\r\n  ${newCode}\r\n\r\nOn any browser: open ${location.origin}, open Account, and use this code under "Log in on this device".\r\nIt works in the other 88x31 games too. Keep it private: anyone with it can log in as you.\r\n`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: "text/plain" })); a.download = "beat-fighter-save-code.txt";
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  $("account").querySelectorAll("[data-rm]").forEach((b) => b.onclick = async () => {
    const r = await api(b.dataset.rm, { action: "remove", id: Number(b.dataset.id) }); if (r.error) return say(r.error); await show("Forgotten.");
  });
  on("usecode", async () => { const r = await api("load", { code: $("codein").value.trim() }); if (r.error) return say(r.error); await changed("Logged in."); });
  on("logout", async () => { const r = await api("logout", {}); if (r.error) return say(r.error); await changed("Logged out."); });
  on("mkpk", async () => {
    say("Waiting for your fingerprint, face or PIN...");
    try {
      const o = await api("passkey", { action: "register_options" }); if (o.error) return say(o.error);
      const cred = await navigator.credentials.create({ publicKey: { ...o, challenge: unb64(o.challenge), user: { ...o.user, id: unb64(o.user.id) }, excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: unb64(c.id) })) } });
      const r = await api("passkey", { action: "register", label: device(), credential: { id: cred.id, response: { clientDataJSON: b64(cred.response.clientDataJSON), attestationObject: b64(cred.response.attestationObject) } } });
      if (r.error) return say(r.error);
      await changed("Passkey added.");
    } catch (e) { say(pkOops(e)); }
  });
  on("pklogin", async () => {
    say("Waiting for your passkey...");
    try {
      const o = await api("passkey", { action: "login_options" }); if (o.error) return say(o.error);
      const cred = await navigator.credentials.get({ publicKey: { ...o, challenge: unb64(o.challenge) } });
      const r = await api("passkey", { action: "login", credential: { id: cred.id, response: { clientDataJSON: b64(cred.response.clientDataJSON), authenticatorData: b64(cred.response.authenticatorData), signature: b64(cred.response.signature) } } });
      if (r.error) return say(r.error);
      await changed("Logged in.");
    } catch (e) { say(pkOops(e)); }
  });
}

// Wire the Account button. `changed()` is called after logging in or out, or making a save code.
export function setupAccount(changed) {
  onChange = changed;
  $("acct").onclick = async () => { const el = $("account"); el.hidden = !el.hidden; if (!el.hidden) await show(); };
}
