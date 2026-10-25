const form = document.querySelector("#login-form");
const error = document.querySelector("#login-error");
const submit = form.querySelector("button[type='submit']");

fetch("/api/auth/me").then(async (response) => {
  if (response.ok && (await response.json()).authenticated) window.location.replace("/");
}).catch(() => {});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  submit.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.elements.username.value.trim(),
        password: form.elements.password.value
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Sign in failed.");
    window.location.replace("/");
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
    form.elements.password.focus();
  } finally {
    submit.disabled = false;
  }
});
