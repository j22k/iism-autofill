import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, expect, it } from 'vitest';
import { renderPostback } from '../../fixtures/postbackServer';

const baseHtml = readFileSync(resolve(process.cwd(), 'tests/fixtures/admission.html'), 'utf-8');

function parse(html: string) {
  return new JSDOM(html).window.document;
}

describe('renderPostback', () => {
  it('keeps a submitted text field value (survives the postback)', () => {
    const result = renderPostback(baseHtml, 'ddlState', { txtName: 'Test Name' });
    expect(parse(result).getElementById('txtName')?.getAttribute('value')).toBe('Test Name');
  });

  it('keeps a submitted checkbox as checked', () => {
    const result = renderPostback(baseHtml, 'ddlState', { chkIAgree: true });
    const checkbox = parse(result).getElementById('chkIAgree') as HTMLInputElement | null;
    expect(checkbox?.checked).toBe(true);
  });

  it('leaves a field not present in formValues unchanged from the base HTML', () => {
    const original = parse(baseHtml).getElementById('txtFatherName')?.getAttribute('value');
    const result = renderPostback(baseHtml, 'ddlState', { txtName: 'Test Name' });
    expect(parse(result).getElementById('txtFatherName')?.getAttribute('value')).toBe(original);
  });

  it('never lets a file input carry a value, regardless of what was "submitted"', () => {
    const result = renderPostback(baseHtml, 'ddlState', { FupPhototOfApplicant: 'should-be-ignored' });
    const fileInput = parse(result).getElementById('FupPhototOfApplicant') as HTMLInputElement | null;
    expect(fileInput?.value).toBe('');
  });

  it('on ddlCourse postback, regenerates ddlCourseLevel options and resets ddlScheduleCourse', () => {
    const result = renderPostback(baseHtml, 'ddlCourse', { ddlCourse: '4' });
    const doc = parse(result);
    const level = doc.getElementById('ddlCourseLevel') as HTMLSelectElement;
    const schedule = doc.getElementById('ddlScheduleCourse') as HTMLSelectElement;

    expect(level.options.length).toBeGreaterThan(1); // more than just the base "Select..." placeholder
    expect(level.value).toBe('0');
    expect(schedule.options.length).toBe(1); // reset back to just the placeholder
    expect(schedule.value).toBe('0');
  });

  it('on ddlCourse postback, collapses an already-populated ddlScheduleCourse back to just the placeholder', () => {
    // Realistic flow: user already picked a level AND a schedule, then changes course
    // again — the cascade must fully collapse schedule, not merely "not add more".
    const afterLevel = renderPostback(
      renderPostback(baseHtml, 'ddlCourse', { ddlCourse: '4' }),
      'ddlCourseLevel',
      { ddlCourse: '4', ddlCourseLevel: 'fixture-basic' },
    );
    const scheduleBefore = parse(afterLevel).getElementById('ddlScheduleCourse') as HTMLSelectElement;
    expect(scheduleBefore.options.length).toBeGreaterThan(1);

    const result = renderPostback(afterLevel, 'ddlCourse', { ddlCourse: '5', ddlCourseLevel: 'fixture-basic' });
    const schedule = parse(result).getElementById('ddlScheduleCourse') as HTMLSelectElement;

    expect(schedule.options.length).toBe(1);
    expect(schedule.value).toBe('0');
  });

  it('on ddlCourseLevel postback, regenerates ddlScheduleCourse options', () => {
    // Simulates the second postback in the real Course -> Level -> Schedule chain: the
    // level dropdown was already populated by a prior ddlCourse postback.
    const afterCourse = renderPostback(baseHtml, 'ddlCourse', { ddlCourse: '4' });
    const levelValue = (parse(afterCourse).getElementById('ddlCourseLevel') as HTMLSelectElement).options[1]?.value;
    expect(levelValue).toBeTruthy();

    const result = renderPostback(afterCourse, 'ddlCourseLevel', { ddlCourse: '4', ddlCourseLevel: levelValue! });
    const schedule = parse(result).getElementById('ddlScheduleCourse') as HTMLSelectElement;

    expect(schedule.options.length).toBeGreaterThan(1);
    expect(schedule.value).toBe('0');
  });

  it('clears DOB specifically on a ddlScheduleCourse postback, even if DOB was submitted', () => {
    const result = renderPostback(baseHtml, 'ddlScheduleCourse', {
      ddlScheduleCourse: '1',
      txtDateOfBirth: '15/06/2005',
    });
    expect(parse(result).getElementById('txtDateOfBirth')?.getAttribute('value')).toBe('');
  });

  it('does not clear DOB on an unrelated postback (e.g. ddlState)', () => {
    const result = renderPostback(baseHtml, 'ddlState', { ddlState: '1', txtDateOfBirth: '15/06/2005' });
    expect(parse(result).getElementById('txtDateOfBirth')?.getAttribute('value')).toBe('15/06/2005');
  });

  it('on txtDateOfBirth postback (it triggers one too, per docs/04-field-map.md), other fields survive untouched', () => {
    // No special-case branch exists for this eventTarget — only ddlCourse/ddlCourseLevel/
    // ddlScheduleCourse have cascade side effects. This pins that down as deliberate.
    const result = renderPostback(baseHtml, 'txtDateOfBirth', {
      txtDateOfBirth: '15/06/2005',
      txtName: 'Test Name',
    });
    const doc = parse(result);
    expect(doc.getElementById('txtDateOfBirth')?.getAttribute('value')).toBe('15/06/2005');
    expect(doc.getElementById('txtName')?.getAttribute('value')).toBe('Test Name');
  });

  it('throws if formValues names a field id that does not exist in the fixture', () => {
    expect(() => renderPostback(baseHtml, 'ddlState', { thisFieldDoesNotExist: 'x' })).toThrow();
  });
});
