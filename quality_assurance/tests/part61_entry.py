from datetime import datetime
from uuid import uuid4

from playwright.sync_api import Page, expect, sync_playwright

from quality_assurance.pages import AccountCreationPage, LoginPage, StudyLogPage

'''
Generate and execute a Playwright test using pytest and
Playwright MCP. Test scenario: Open http://127.0.0.1:3000 Create a new
user account. Once the account has been created, log into the
application. Verify that the page now displays a dropdown at the top
with options of Part 91 and Part 61. Choose Part 61. Select one of the
regulations in the table below by checking the box.  Confirm that the
adjacent date field shows today's date.  Add some notes in the adjacent
notes field. Toggle the page to the Part 91 table and then toggle back
to Part 61. Confirm all the previous selections and entries were saved.
Guidance: Use pytest-style structure (functions starting with test_) Use
page object model. Execute each step interactively through Playwright
MCP tools. Once all steps succeed, generate and save the final test
script as tests/part61_entry.py Run the saved test automatically in
headed mode (browser visible). If any step or assertion fails, identify
and fix the issue.  Then rerun until the test passes Use page object
model for all pages. Expected output: a fully working Playwright +
pytest test script. The script should automate the complete flow
described above and successfully validate the entry for the selected
regulation. All new files and folders related to this testing effort
should be saved underneath a folder in the project called
quality_assurance if it does not already exist.
put the page objects into a new folder called pages underneath 
quality_assurance so that they are separate from the tests.

python3 -m pytest quality_assurance/tests/part61_entry.py
'''


REGULATION = "61.103(a)"
NOTES = "Reviewed eligibility age requirement and checked certificate-rating prerequisites."
PASSWORD = "Part61AutomationTestPassphrase2026"


def test_part61_entry_survives_switching_parts() -> None:
    username = f"qa-part61-{uuid4().hex[:12]}"
    email = f"{username}@example.test"

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=False)
        page = browser.new_page()
        try:
            account_page = AccountCreationPage(page)
            account_page.open()
            account_page.create_account(username, email, PASSWORD)

            login_page = LoginPage(page)
            login_page.open()
            login_page.sign_in(username, PASSWORD)

            study_log = StudyLogPage(page)
            study_log.verify_part_options()
            study_log.choose_part("61")

            study_log.mark_covered(REGULATION)
            today = datetime.now().astimezone().date().isoformat()
            expect(study_log.date_field(REGULATION)).to_have_value(today)
            study_log.save_notes(REGULATION, NOTES)

            study_log.choose_part("91")
            study_log.choose_part("61")

            expect(
                page.get_by_role(
                    "checkbox", name=f"Mark {REGULATION} as covered"
                )
            ).to_be_checked()
            expect(study_log.date_field(REGULATION)).to_have_value(today)
            expect(study_log.notes_field(REGULATION)).to_have_value(NOTES)
        finally:
            browser.close()
