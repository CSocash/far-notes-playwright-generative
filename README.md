# FAA Regulations Study Log

A personal study tracker for commonly studied FAA Part 91 and Part 61 regulations. Create an account or sign in to access a private study list, then select a part from the dropdown to switch lists. Each account has its own progress, dates, notes, and regulation sections. Regulations are grouped by section, with coverage tracked separately for each lettered subsection. Sections without lettered subsections remain trackable as a single item.

Section and subsection citations link to their corresponding eCFR text and open in a new tab. Missing subsection headings are filled with concise descriptions based on the opening text of the official paragraph.

The built-in Part 61 and Part 91 section headings are protected and cannot be edited. User-added headings remain editable. Section deletion is not available.

## Run the website

1. Install Node.js 22.13 or later.
2. From this project folder, create the initial account once by setting `INITIAL_PASSWORD` and running `npm run setup-user`. The default account name and email are `VMC43` and `VMC43@test.com`; the password is never included in the source code and is stored as a salted hash.
3. Run `npm start`.
4. Open [http://127.0.0.1:3000](http://127.0.0.1:3000), create another account from the sign-in page if needed, and sign in with a username or email and password.
5. Keep the terminal window running while using the tracker.

For example, in macOS or Linux, run `INITIAL_PASSWORD='your-password' npm run setup-user` once before starting the server. On Windows PowerShell, run `$env:INITIAL_PASSWORD='your-password'; npm run setup-user`. Account creation refuses to overwrite an existing account. The initial password can be changed later through **Forgot password?**; because this local app has no email service, the one-time reset link is printed in the server terminal and expires after 30 minutes.

Accounts created on the sign-in page require a username, email address, and password of at least 15 characters. The initial password must also be at least 15 characters. Passwords may be long passphrases; uppercase letters, numbers, and symbols are not required. Each account has a separate study log. Passwords are stored as salted hashes.

The database is created automatically at `data/part91.sqlite` the first time the server starts. Existing Part 91 progress is preserved when the database is upgraded. Back up that file to back up your study log. Do not open `index.html` directly; use the local server so the website can connect to SQLite.

When the subsection tracking is first enabled, existing section-level coverage, dates, and notes are copied to each subsection in that section because the old data did not distinguish individual subsections. Review those migrated values and adjust them as needed.

This is a local app intended for use on one computer. The starter lists are study aids, not complete or authoritative reproductions of Parts 61 or 91; verify current regulations with official FAA sources.

Subsection identifiers and available paragraph headings are based on the eCFR Title 14 snapshot dated June 1, 2026, stored in `regulation-subsections.json` ([Part 61](https://www.ecfr.gov/api/versioner/v1/full/2026-06-01/title-14.xml?part=61), [Part 91](https://www.ecfr.gov/api/versioner/v1/full/2026-06-01/title-14.xml?part=91)). The app does not automatically refresh this catalog; confirm current subsection structure and legal text with official FAA sources.
# far-notes
