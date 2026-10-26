from playwright.sync_api import Page, expect

from quality_assurance.pages.config import BASE_URL


class LoginPage:
    def __init__(self, page: Page) -> None:
        self.page = page

    def open(self) -> None:
        self.page.goto(f"{BASE_URL}/login")

    def sign_in(self, username: str, password: str) -> None:
        self.page.get_by_label("Username or email").fill(username)
        self.page.get_by_label("Password").fill(password)
        self.page.get_by_role("button", name="Sign in").click()
        expect(self.page).to_have_title("Part 91 Study Log")
