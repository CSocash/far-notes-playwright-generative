from playwright.sync_api import Page, expect


class StudyLogPage:
    def __init__(self, page: Page) -> None:
        self.page = page
        self.part_select = page.get_by_label("Select regulation part")

    def verify_part_options(self) -> None:
        expect(self.part_select.locator("option")).to_have_text(
            ["Part 91", "Part 61"]
        )

    def choose_part(self, part: str) -> None:
        self.part_select.select_option(part)
        expect(self.page).to_have_title(f"Part {part} Study Log")

    def mark_covered(self, regulation: str) -> None:
        checkbox = self.page.get_by_role(
            "checkbox", name=f"Mark {regulation} as covered"
        )
        with self.page.expect_response(
            lambda response: (
                "/api/subsections/" in response.url
                and "part=61" in response.url
                and response.request.method == "PATCH"
            )
        ) as response_info:
            checkbox.check()
        assert response_info.value.ok, "The coverage entry was not saved."
        expect(checkbox).to_be_checked()

    def date_field(self, regulation: str):
        return self.page.get_by_role(
            "textbox", name=f"Date covered for {regulation}"
        )

    def notes_field(self, regulation: str):
        return self.page.get_by_role("textbox", name=f"Notes for {regulation}")

    def save_notes(self, regulation: str, notes: str) -> None:
        field = self.notes_field(regulation)
        field.fill(notes)
        with self.page.expect_response(
            lambda response: (
                "/api/subsections/" in response.url
                and "part=61" in response.url
                and response.request.method == "PATCH"
            )
        ) as response_info:
            field.blur()
        assert response_info.value.ok, "The notes entry was not saved."
