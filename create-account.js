const form = document.querySelector("#create-account-form");
const error = document.querySelector("#create-account-error");
const success = document.querySelector("#create-account-success");
const submit = form.querySelector("button[type='submit']");

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.hidden = true;
  success.hidden = true;
  submit.disabled = true;
  try {
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: form.elements.username.value.trim(),
        email: form.elements.email.value.trim(),
        password: form.elements.password.value
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Please try again.");
    success.hidden = false;
    form.reset();
    form.hidden = true;
  } catch (requestError) {
    error.textContent = `Account creation was not successful. ${requestError.message}`;
    error.hidden = false;
  } finally {
    submit.disabled = false;
  }
});
