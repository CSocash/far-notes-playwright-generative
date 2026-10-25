const form = document.querySelector("#reset-form");
const error = document.querySelector("#reset-error");
const success = document.querySelector("#reset-success");
const submit = form.querySelector("button[type='submit']");
const token = new URLSearchParams(window.location.hash.slice(1)).get("token") || "";

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  success.hidden = true;
  const password = form.elements.password.value;
  if (password !== form.elements["confirm-password"].value) {
    error.textContent = "The passwords do not match.";
    error.hidden = false;
    return;
  }
  submit.disabled = true;
  try {
    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not reset the password.");
    success.hidden = false;
    form.reset();
    submit.disabled = true;
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
  } finally {
    if (!success.hidden) return;
    submit.disabled = false;
  }
});
