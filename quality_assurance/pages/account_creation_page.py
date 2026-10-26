from playwright.sync_api import Page, expect

from quality_assurance.pages.config import BASE_URL


class AccountCreationPage:
    def __init__(self, page: Page) -> None:
        self.page = page

    def open(self) -> None:
        self.page.goto(f"{BASE_URL}/create-account")

    def create_account(self, username: str, email: str, password: str) -> None:
        self.page.get_by_label("Username").fill(username)
        self.page.get_by_label("Email address").fill(email)
        self.page.get_by_label("Password").fill(password)
        self.page.get_by_role("button", name="Create account").click()
        expect(
            self.page.get_by_role("status").get_by_text("Account created successfully.")
        ).to_be_visible()
