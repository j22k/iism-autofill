// Dropdown options captured from the live admission form on 2026-11-17 (Course/Level/
// Schedule/State) and from tests/fixtures/admission.html (Qualification/Diet). They feed
// the options page's pickers only; the fill itself always matches against the options the
// live page actually has (core/match.ts), so a stale entry here can't cause a wrong
// selection - at worst the user picks "Other" and types the text. Level and schedule lists
// depend on the chosen course and season, hence the "Other" escape hatch in the UI.
export const SITE_OPTIONS_CAPTURED_ON = '2026-11-17';

export const SITE_OPTIONS: Readonly<Record<string, readonly string[]>> = {
  'course.type': ['Snow Skiing Courses at Gulmarg', 'MOI Courses at Gulmarg'],
  'course.level': ['Basic SSC', 'Intermediate SSC', 'Advance SSC', 'Snow Boarding'],
  'course.batch': [
    '1st course from 20 Dec 2026 to 02 Jan 2027',
    '2nd course from 03rd Jan to 16 Jan 2027',
    '3rd course from 17 Jan to 30 Jan 2027',
    '4th course from 31 Jan to 13 Feb 2027',
    '5th course from 14 Feb to 27 Feb 2027',
    '6th course from 28 Feb to 13 Mar 2027',
  ],
  'course.state': [
    'ANDAMAN AND NICOBAR ISLANDS', 'Andhra Pradesh', 'ANDHRA PRADESH (NEW)', 'ANDHRA PRADESH(BEFORE DIVISION)',
    'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHANDIGARH', 'CHATTISGARH', 'DADRA AND NAGAR HAVELI', 'DAMAN AND DIU',
    'DELHI', 'GOA', 'GUJARAT', 'HARYANA', 'HIMACHAL PRADESH', 'JAMMU AND KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA',
    'LADAKH', 'LAKSHWADEEP', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHLAYA', 'MIZORAM', 'NAGALAND', 'ODISHA',
    'PUDUCHERRY', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA', 'UTTAR PRADESH', 'UTTARAKHAND',
    'WEST BENGAL',
  ],
  'education.qualification': ['High School', 'Intermediate', 'Graduation', 'Post graduation'],
  'medical.diet': ['Vegetarian', 'Non-Vegetarian'],
};
