import { describe, expect, it, vi } from 'vitest';
import { executeStep } from '../../../src/content/executeStep';

function setBody(html: string): void {
  document.body.innerHTML = html;
}

describe('executeStep', () => {
  it('fails for an unknown field id', () => {
    setBody('');
    const result = executeStep({ id: 'notAField', kind: 'text', value: 'x' });
    expect(result).toEqual({ status: 'failed', message: expect.stringContaining('notAField') });
  });

  it('fails when the field is not present on the page', () => {
    setBody('<div></div>');
    const result = executeStep({ id: 'txtName', kind: 'text', value: 'Test Name' });
    expect(result.status).toBe('failed');
  });

  it('fills a text field and reports ok', () => {
    setBody('<input id="txtName" name="txtName" />');
    const result = executeStep({ id: 'txtName', kind: 'text', value: 'Test Name' });
    expect(result).toEqual({ status: 'ok' });
    expect((document.getElementById('txtName') as HTMLInputElement).value).toBe('Test Name');
  });

  it('checks a checkbox and reports ok', () => {
    setBody('<input id="chkIAgree" name="chkIAgree" type="checkbox" />');
    const result = executeStep({ id: 'chkIAgree', kind: 'checkbox', value: true });
    expect(result).toEqual({ status: 'ok' });
    expect((document.getElementById('chkIAgree') as HTMLInputElement).checked).toBe(true);
  });

  it('skips a text field already holding the target value, without redispatching events', () => {
    setBody('<input id="txtName" name="txtName" value="Test Name" />');
    const input = document.getElementById('txtName') as HTMLInputElement;
    const onInput = vi.fn();
    input.addEventListener('input', onInput);

    const result = executeStep({ id: 'txtName', kind: 'text', value: 'Test Name' });

    expect(result).toEqual({ status: 'skipped', message: 'already correct' });
    expect(onInput).not.toHaveBeenCalled();
  });

  it('skips a checkbox already in the target state', () => {
    setBody('<input id="chkIAgree" name="chkIAgree" type="checkbox" checked />');
    const result = executeStep({ id: 'chkIAgree', kind: 'checkbox', value: true });
    expect(result).toEqual({ status: 'skipped', message: 'already correct' });
  });

  it('formats and fills the DOB field from the dd/MM/yyyy value it is given (formatting itself is dateFormat.ts\'s job, done before this is called)', () => {
    setBody('<input id="txtDateOfBirth" name="txtDateOfBirth" />');
    const result = executeStep({ id: 'txtDateOfBirth', kind: 'text', value: '15/06/2005' });
    expect(result).toEqual({ status: 'ok' });
    expect((document.getElementById('txtDateOfBirth') as HTMLInputElement).value).toBe('15/06/2005');
  });

  describe('select fields', () => {
    function buildSelect(options: string[]): string {
      return `<select id="ddlVegetarianOrNon" name="ddlVegetarianOrNon">${options
        .map((o, i) => `<option value="opt${i}">${o}</option>`)
        .join('')}</select>`;
    }

    it('skips when the profile has no value to match', () => {
      setBody(buildSelect(['Vegetarian', 'Non-Vegetarian']));
      const result = executeStep({ id: 'ddlVegetarianOrNon', kind: 'select', value: '' });
      expect(result.status).toBe('skipped');
    });

    it('matches by fuzzy text and selects the right option, reporting ok', () => {
      setBody(buildSelect(['Vegetarian', 'Non-Vegetarian']));
      const result = executeStep({ id: 'ddlVegetarianOrNon', kind: 'select', value: 'Non Veg' });
      expect(result).toEqual({ status: 'ok' });
      expect((document.getElementById('ddlVegetarianOrNon') as HTMLSelectElement).value).toBe('opt1');
    });

    it('skips with a message when nothing matches', () => {
      setBody(buildSelect(['Vegetarian', 'Non-Vegetarian']));
      const result = executeStep({ id: 'ddlVegetarianOrNon', kind: 'select', value: 'Pescatarian' });
      expect(result.status).toBe('skipped');
      expect(result.message).toMatch(/no match/i);
    });

    it('fails with a message when the match is ambiguous, leaving it for a human', () => {
      setBody(buildSelect(['Snow Skiing at Gulmarg', 'Snow Skiing at Auli']));
      const result = executeStep({ id: 'ddlVegetarianOrNon', kind: 'select', value: 'Snow Skiing' });
      expect(result.status).toBe('failed');
      expect(result.message).toMatch(/ambiguous/i);
    });

    it('skips re-selecting an option that already matches, avoiding a needless re-trigger of its postback', () => {
      setBody(buildSelect(['Vegetarian', 'Non-Vegetarian']));
      const select = document.getElementById('ddlVegetarianOrNon') as HTMLSelectElement;
      select.value = 'opt1'; // already "Non-Vegetarian"
      const onChange = vi.fn();
      select.addEventListener('change', onChange);

      const result = executeStep({ id: 'ddlVegetarianOrNon', kind: 'select', value: 'Non Veg' });

      expect(result).toEqual({ status: 'skipped', message: 'already correct' });
      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('file fields', () => {
    it('fails when no file payload is provided', () => {
      setBody('<input id="FupPhototOfApplicant" name="FupPhototOfApplicant" type="file" />');
      const result = executeStep({ id: 'FupPhototOfApplicant', kind: 'file', value: null });
      expect(result.status).toBe('failed');
    });

    it('decodes the payload and hands it to assignFile, reporting ok', () => {
      setBody('<input id="FupPhototOfApplicant" name="FupPhototOfApplicant" type="file" />');
      const assignFile = vi.fn();
      const base64 = Buffer.from([1, 2, 3]).toString('base64');

      const result = executeStep(
        { id: 'FupPhototOfApplicant', kind: 'file', value: null, file: { base64, mimeType: 'image/png', filename: 'photo.png' } },
        { assignFile },
      );

      expect(result).toEqual({ status: 'ok' });
      expect(assignFile).toHaveBeenCalledTimes(1);
      const [, file] = assignFile.mock.calls[0] as [HTMLInputElement, File];
      expect(file.name).toBe('photo.png');
      expect(file.type).toBe('image/png');
      expect(file.size).toBe(3);
    });
  });

  it('skips a readonly field without touching the page', () => {
    setBody('<input id="txtCourseFee" name="txtCourseFee" readonly />');
    const result = executeStep({ id: 'txtCourseFee', kind: 'readonly', value: null });
    expect(result.status).toBe('skipped');
  });
});
