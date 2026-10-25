const form = document.querySelector("#forgot-form");
const error = document.querySelector("#forgot-error");
const success = document.querySelector("#forgot-success");
const submit = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  success.hidden = true;
  submit.disabled = true;
  try {
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: form.elements.email.value.trim() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not request a reset link.");
    success.hidden = false;
  } catch (requestError) {
    error.textContent = requestError.message;
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
