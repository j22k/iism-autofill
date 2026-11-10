# Field Map — VERIFIED 2026-11-10 against a saved copy of `admission_form.aspx` (fixture: `tests/fixtures/admission.html`)

Site: ASP.NET WebForms. IDs below are exact (including misspellings). **No `ctl00_` prefixing: `id` == `name`.** Page URL: `/admission_form.aspx?mobile=<10 digits>` (mobile is prefilled in `txtMobileNo` and the verification step happens on the previous page).

| Section | ID | Type | Postback? | Profile key |
|---|---|---|---|---|
| Course | `ddlCourse` | select | **yes** | course.type ("ski") |
| Course | `ddlCourseLevel` | select | **yes** (verified) | course.level ("Basic") |
| Course | `ddlScheduleCourse` | select | **yes** (clears DOB) | course.batch |
| Course | `ddlState` | select | **yes** | course.state ("JAMMU AND KASHMIR", value 1) |
| Course | `txtAvailableSeat`, `txtCourseFee` | readonly | — | (read only; show in report, warn if seats = 0) |
| Basic | `txtName` | text | no | personal.name |
| Basic | `txtFatherName` | text | no | personal.fatherName |
| Basic | `txtNationality` | text | no | personal.nationality |
| Basic | `txtDateOfBirth` | text dd/MM/yyyy | **yes** (computes fee) | personal.dob |
| Basic | `txtDomicile` | text | no | personal.domicile |
| Basic | `FupBirthCertificate` | file | — | docs.dobProof |
| Basic | `FupDomicileAttachProof` | file (opt) | — | docs.domicileProof |
| Address | `txtHouseNoApartment` | text | no | address.house |
| Address | `txtStreetVillageColony` | text | no | address.street |
| Address | `txtDistrictCity` | text | no | address.city |
| Address | `txtPincode` | text | no | address.pincode |
| Address | `txtMobileNo` | text (10 digits) | no | contact.mobile |
| Address | `txtEmailId` | text | no | contact.email |
| Academic | `ddlEduationQualification` | select | no | education.qualification |
| Academic | `FupEducationQualification` | file | — | docs.educationProof |
| Academic | `FupAnyAdventureCoursePhoto` | file (opt) | — | docs.adventureCert |
| Academic | `FupCurrentEmployment` | file (opt) | — | docs.employmentProof |
| ID | `ddlVegetarianOrNon` | select | no | medical.diet |
| ID | `txtBloodGroup` | text/select | no | medical.bloodGroup |
| ID | `txtMedicalCategory` | text | no | medical.category |
| ID | `txtHeight` `txtWeight` `txtWaist` `txtShoeSize` | text | no | medical.* |
| Photo | `FupPhototOfApplicant` | file | — | docs.photo |
| Photo | `FupSignatureOfAppicant` | file | — | docs.signature |
| Indemnity | `txtEmergencyContactName` | text | no | emergency.name |
| Indemnity | `txtEmergencyContactPhone` | text | no | emergency.phone |
| Indemnity | `FupParentGuardianSignature` | file (client-validation required) | — | docs.guardianSignature |
| Declaration | `chkIAgree` | checkbox | no | (always tick on fill? → user setting, default OFF) |
| Submit | `btnSubmit` | button | — | **NEVER TOUCH** |

## Behavior facts
- Reload ≈ 0.6 s normally; slower on busy days. Text/select/checkbox survive; files don't.
- Recommended order: Course → (Level, Schedule, State) → text/selects/declaration → DOB → files.
- Client validation `Page_ClientValidate('sv')` demands guardian signature even for adults.
- Upload constraints: non-empty, ≤ 500 KB. Types per field — see "Verified details" below (not simply JPG/JPEG/PNG; GIF and, for most fields, PDF are also accepted by the site).
- Mobile verification is a one-time step before the form (user does this manually).
- Full batch ⇒ "Seat Not Available" on submit; not our concern (we never submit).

## Verification checklist (T-001) — done except Level/Schedule options (T-001b)
- [x] Open form manually, DevTools: copy outer HTML of each control; record real ids/names/prefixes and option values/labels.
- [x] Note which controls have `onchange="setTimeout('__doPostBack…')"`.
- [x] Save a sanitized HTML snapshot (no personal data) to `tests/fixtures/admission.html`.
- [x] Update this table; mark verified date.

## Verified details from the real HTML (2026-11-10)
- **Postback fields confirmed** (`onchange=setTimeout(__doPostBack…)`): `ddlCourse`, `ddlCourseLevel`, `ddlScheduleCourse`, `ddlState`, `txtDateOfBirth`. (`ddlCourseLevel` DOES postback too — the bots missed it.)
- `ddlCourse` options: `0` Select Course · `4` Snow Skiing Courses at Gulmarg · `5` Snow Skiing Courses at Kargil · `12` MOI Courses at Gulmarg. Level and Schedule options are empty until a postback fills them (dependent chain: Course → Level → Schedule).
- `ddlState`: `1` = JAMMU AND KASHMIR, `38` HIMACHAL PRADESH, `7` DELHI, … (40 options; "ANDHRA PRADESH" has 3 variants, "LADAKH " has a trailing space → trim when matching).
- `ddlEduationQualification` values: `High School`, `Intermediate`, `Graduation`, `Post graduation` (value == label). `ddlVegetarianOrNon`: `Vegetarian`, `Non-Vegetarian`.
- `txtBloodGroup` is a free-text box (not a select). maxlength: name/father/nationality/domicile/house/city/medical fields 50, street 250, pincode 6, mobile 10, DOB 10.
- **Required (RequiredFieldValidator, group `sv`)**: course, level, schedule, state, `txtCourseFee` (non-empty ⇒ forces the DOB postback), name, father name, nationality, DOB, `FupBirthCertificate`, house, street, city, pincode, mobile, email, qualification + `FupEducationQualification`, blood group, `FupPhototOfApplicant`, `FupSignatureOfAppicant`, emergency name + phone, `FupParentGuardianSignature`.
- **Optional**: `txtDomicile`, `FupDomicileAttachProof`, `FupAnyAdventureCoursePhoto`, `FupCurrentEmployment`, `ddlVegetarianOrNon`, `txtMedicalCategory`, `txtHeight`, `txtWeight`, `txtWaist`, `txtShoeSize`.
- DOB regex: `dd/mm/(19|20)yy`. Email regex `\w+([-+.']\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*`.
- File extension regexes: birth/education/domicile/adventure/employment accept pdf/gif/jpg/png/jpeg; **photo, signature, guardian signature accept gif/jpg/png/jpeg only (no PDF)**.
- **File size**: page text says 500 KB, but client JS `checkFileSize()` only blocks > 1 MB (alert + clears input). Server may enforce 500 KB. We enforce ≤ 500 KB ourselves (safe), and never rely on the 1 MB alert.
- `chkIAgree` is a plain checkbox (declaration text at ~line 633), no postback.
- Buttons: `btnSubmit` (validation group `sv`) and **`btnReset` — also a submit-type button that posts back**. Our Reset must NOT click it blindly; prefer re-navigating to the same URL (GET) or clearing fields client-side. Treat both buttons as forbidden to click automatically.
- Hidden state fields: `__VIEWSTATE`, `__EVENTVALIDATION`, `hdf*` (e.g. `hdfFupBirthCertificate` = "No"/"Yes"). Never edit hidden fields. Setting the file input and firing `change` is what the page expects.
- Because EVENTVALIDATION is enforced, dropdown values must be real option values (never invented).
