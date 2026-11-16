import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initDocumentManager } from '../../../src/options/documents';
import * as db from '../../../src/shared/db';
import { FILE_FIELDS } from '../../../src/core/fieldMap';

function testThumbnailUrl(blob: Blob): string {
  return `blob:test/${blob.size}`;
}

let revokeThumbnailUrl: (url: string) => void;

beforeEach(() => {
  document.body.innerHTML = '<div id="docs"></div>';
  revokeThumbnailUrl = vi.fn<(url: string) => void>();
  vi.spyOn(db, 'getDoc').mockResolvedValue(null);
  vi.spyOn(db, 'putDoc').mockResolvedValue(undefined);
  vi.spyOn(db, 'deleteDoc').mockResolvedValue(undefined);
});

function root(): HTMLElement {
  return document.getElementById('docs') as HTMLElement;
}

function selectFile(input: HTMLInputElement, file: File): void {
  Object.defineProperty(input, 'files', { value: [file], configurable: true });
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

async function init(): Promise<void> {
  await initDocumentManager(root(), { createThumbnailUrl: testThumbnailUrl, revokeThumbnailUrl });
}

describe('initDocumentManager', () => {
  it('renders one file input per FILE_FIELDS entry, each with a label association', async () => {
    await init();
    expect(root().querySelectorAll('input[type="file"]')).toHaveLength(FILE_FIELDS.length);
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]');
    expect(input).not.toBeNull();
    if (!input) return;
    const label = root().querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
    expect(label).not.toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(root().querySelector('[data-error-for="docs.photo"]')?.id);
  });

  it('restricts accept to PDF+images for a document field, images-only for photo/signature/guardian', async () => {
    await init();
    const dobProofInput = root().querySelector<HTMLInputElement>('input[data-doc="docs.dobProof"]');
    const photoInput = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]');
    expect(dobProofInput?.accept).toContain('application/pdf');
    expect(photoInput?.accept).not.toContain('application/pdf');
  });

  it('shows Required on load for a missing required doc, nothing for a missing optional doc', async () => {
    await init();
    expect(root().querySelector('[data-error-for="docs.photo"]')?.textContent).toBe('Required');
    expect(root().querySelector('[data-error-for="docs.domicileProof"]')?.textContent).toBe('');
  });

  it('shows a thumbnail on load for an already-stored doc', async () => {
    vi.spyOn(db, 'getDoc').mockImplementation(async (key: string) =>
      key === 'docs.photo' ? new Blob([new Uint8Array(5)], { type: 'image/png' }) : null,
    );
    await init();
    const img = root().querySelector<HTMLImageElement>('img[data-thumbnail-for="docs.photo"]');
    expect(img?.src).toContain('blob:test/5');
    expect(root().querySelector('[data-error-for="docs.photo"]')?.textContent).toBe('');
  });

  it('rejects an invalid file with a clear error and never stores it', async () => {
    await init();
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]');
    expect(input).not.toBeNull();
    if (!input) return;

    const badFile = new File(['x'], 'photo.txt', { type: 'text/plain' });
    selectFile(input, badFile);
    await Promise.resolve();
    await Promise.resolve();

    expect(db.putDoc).not.toHaveBeenCalled();
    expect(root().querySelector('[data-error-for="docs.photo"]')?.textContent).toMatch(/Unsupported file type/);
  });

  it('accepts a PDF for a document field that allows it (e.g. docs.dobProof)', async () => {
    await init();
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.dobProof"]');
    if (!input) throw new Error('input not found');

    const pdfFile = new File([new Uint8Array(10)], 'birth-certificate.pdf', { type: 'application/pdf' });
    selectFile(input, pdfFile);
    await Promise.resolve();
    await Promise.resolve();

    expect(db.putDoc).toHaveBeenCalledWith('docs.dobProof', pdfFile);
    expect(root().querySelector('[data-error-for="docs.dobProof"]')?.textContent).toBe('');
  });

  it('rejects an oversized file with a clear error', async () => {
    await init();
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]');
    if (!input) throw new Error('input not found');

    const bigFile = new File([new Uint8Array(600_000)], 'photo.png', { type: 'image/png' });
    selectFile(input, bigFile);
    await Promise.resolve();
    await Promise.resolve();

    expect(db.putDoc).not.toHaveBeenCalled();
    expect(root().querySelector('[data-error-for="docs.photo"]')?.textContent).toMatch(/must be 500 KB or smaller/);
  });

  it('stores a valid file and renders its thumbnail, clearing any error', async () => {
    await init();
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]');
    if (!input) throw new Error('input not found');

    const goodFile = new File([new Uint8Array(10)], 'photo.png', { type: 'image/png' });
    selectFile(input, goodFile);
    await Promise.resolve();
    await Promise.resolve();

    expect(db.putDoc).toHaveBeenCalledWith('docs.photo', goodFile);
    expect(root().querySelector('[data-error-for="docs.photo"]')?.textContent).toBe('');
    const img = root().querySelector<HTMLImageElement>('img[data-thumbnail-for="docs.photo"]');
    expect(img?.src).toContain('blob:test/10');
  });

  it('revokes the previous thumbnail URL when a new file replaces an existing doc', async () => {
    vi.spyOn(db, 'getDoc').mockImplementation(async (key: string) =>
      key === 'docs.photo' ? new Blob([new Uint8Array(5)], { type: 'image/png' }) : null,
    );
    await init();
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]');
    if (!input) throw new Error('input not found');

    const newFile = new File([new Uint8Array(10)], 'photo.png', { type: 'image/png' });
    selectFile(input, newFile);
    await Promise.resolve();
    await Promise.resolve();

    expect(revokeThumbnailUrl).toHaveBeenCalledWith('blob:test/5');
  });

  it('works the same for an optional doc (docs.domicileProof): upload then remove', async () => {
    await init();
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.domicileProof"]');
    if (!input) throw new Error('input not found');

    const file = new File([new Uint8Array(10)], 'domicile.png', { type: 'image/png' });
    selectFile(input, file);
    await Promise.resolve();
    await Promise.resolve();
    expect(db.putDoc).toHaveBeenCalledWith('docs.domicileProof', file);
    expect(root().querySelector('[data-error-for="docs.domicileProof"]')?.textContent).toBe('');

    const removeButton = root().querySelector<HTMLButtonElement>('[data-remove-for="docs.domicileProof"]');
    removeButton?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(db.deleteDoc).toHaveBeenCalledWith('docs.domicileProof');
    // optional field: removing it must NOT show a Required error
    expect(root().querySelector('[data-error-for="docs.domicileProof"]')?.textContent).toBe('');
  });

  it('removing a stored required doc deletes it, clears the thumbnail, revokes its URL, and re-shows Required', async () => {
    vi.spyOn(db, 'getDoc').mockImplementation(async (key: string) =>
      key === 'docs.photo' ? new Blob([new Uint8Array(5)], { type: 'image/png' }) : null,
    );
    await init();
    const removeButton = root().querySelector<HTMLButtonElement>('[data-remove-for="docs.photo"]');
    expect(removeButton).not.toBeNull();
    if (!removeButton) return;

    removeButton.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(db.deleteDoc).toHaveBeenCalledWith('docs.photo');
    expect(revokeThumbnailUrl).toHaveBeenCalledWith('blob:test/5');
    expect(root().querySelector('img[data-thumbnail-for="docs.photo"]')?.getAttribute('hidden')).not.toBeNull();
    expect(root().querySelector('[data-error-for="docs.photo"]')?.textContent).toBe('Required');
  });

  it('gives each Remove button a distinguishing aria-label', async () => {
    await init();
    const removeButton = root().querySelector<HTMLButtonElement>('[data-remove-for="docs.photo"]');
    expect(removeButton?.getAttribute('aria-label')).toMatch(/Photo/);
  });
});

describe('auto-compress (B4)', () => {
  it('replaces an oversized image with the compressed one before saving', async () => {
    const compressed = new File([new Uint8Array(1000)], 'photo.jpg', { type: 'image/jpeg' });
    const compress = vi.fn(() => Promise.resolve(compressed));
    await initDocumentManager(root(), { createThumbnailUrl: testThumbnailUrl, revokeThumbnailUrl, compress });
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]') as HTMLInputElement;
    selectFile(input, new File([new Uint8Array(600_000)], 'big.jpg', { type: 'image/jpeg' }));
    await vi.waitFor(() => expect(db.putDoc).toHaveBeenCalledWith('docs.photo', compressed));
    expect(compress).toHaveBeenCalledTimes(1);
  });

  it('still shows the size error when compression is not possible', async () => {
    const compress = vi.fn(() => Promise.resolve(null));
    await initDocumentManager(root(), { createThumbnailUrl: testThumbnailUrl, revokeThumbnailUrl, compress });
    const input = root().querySelector<HTMLInputElement>('input[data-doc="docs.photo"]') as HTMLInputElement;
    selectFile(input, new File([new Uint8Array(600_000)], 'big.jpg', { type: 'image/jpeg' }));
    await vi.waitFor(() => expect(root().textContent).toContain('KB'));
    expect(db.putDoc).not.toHaveBeenCalled();
  });
});
