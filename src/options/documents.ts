// Document manager: upload/validate/thumbnail/remove for every file-kind field
// (B1 required docs, B2 optional docs, B3 validate type/size with a clear error).
// Auto-compress (B4) shrinks an oversized photo before validating; B6 lives in core/planner.ts.
import { FILE_FIELDS, type FieldDef } from '../core/fieldMap';
import { MAX_IMAGE_BYTES, validateImage } from '../core/image';
import { compressFile } from './canvasCompress';
import { labelForPath } from '../core/labels';
import { deleteDoc, getDoc, putDoc } from '../shared/db';

// jsdom (this project's test environment) doesn't implement URL.createObjectURL, so
// thumbnail-URL creation is injectable — same DI pattern as image.ts's Encoder for the
// one other browser-only API (canvas) this codebase deals with.
export interface DocumentManagerDeps {
  createThumbnailUrl: (blob: Blob) => string;
  revokeThumbnailUrl: (url: string) => void;
  // B4: returns a smaller file, or null when it can't be compressed.
  compress: (file: File) => Promise<File | null>;
}

const DEFAULT_DEPS: DocumentManagerDeps = {
  createThumbnailUrl: (blob) => URL.createObjectURL(blob),
  revokeThumbnailUrl: (url) => URL.revokeObjectURL(url),
  compress: compressFile,
};

function acceptAttribute(acceptedTypes: ReadonlySet<string>): string {
  return [...acceptedTypes].join(',');
}

export async function initDocumentManager(
  root: HTMLElement,
  deps: Partial<DocumentManagerDeps> = {},
): Promise<void> {
  const { createThumbnailUrl, revokeThumbnailUrl, compress } = { ...DEFAULT_DEPS, ...deps };
  const currentThumbnailUrls = new Map<string, string>();

  root.innerHTML = '';

  for (const def of FILE_FIELDS) {
    await renderSlot(def);
  }

  async function renderSlot(def: FieldDef & { source: string; acceptedTypes: ReadonlySet<string> }): Promise<void> {
    const source = def.source;
    const label = labelForPath(source);
    const inputId = `doc-${source}`;
    const errorId = `doc-error-${source}`;

    const wrapper = document.createElement('div');
    wrapper.className = 'doc-slot';

    const labelEl = document.createElement('label');
    labelEl.htmlFor = inputId;
    labelEl.textContent = label + (def.required ? ' *' : '');
    wrapper.appendChild(labelEl);

    const input = document.createElement('input');
    input.type = 'file';
    input.id = inputId;
    input.accept = acceptAttribute(def.acceptedTypes);
    input.dataset.doc = source;
    input.setAttribute('aria-describedby', errorId);
    wrapper.appendChild(input);

    const thumbnail = document.createElement('img');
    thumbnail.dataset.thumbnailFor = source;
    thumbnail.hidden = true;
    thumbnail.alt = label;
    wrapper.appendChild(thumbnail);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.dataset.removeFor = source;
    removeButton.setAttribute('aria-label', `Remove ${label}`);
    removeButton.hidden = true;
    wrapper.appendChild(removeButton);

    const errorEl = document.createElement('span');
    errorEl.id = errorId;
    errorEl.className = 'error';
    errorEl.dataset.errorFor = source;
    errorEl.setAttribute('role', 'alert');
    wrapper.appendChild(errorEl);

    root.appendChild(wrapper);

    // Guards against a change-then-remove (or change-then-change) race on the same
    // slot: each async op captures the generation it started at, and only applies its
    // result if nothing newer has started since. The input/button are also disabled
    // while an op is in flight so a second op can't even start concurrently.
    let generation = 0;

    function setBusy(busy: boolean): void {
      input.disabled = busy;
      removeButton.disabled = busy;
    }

    function showThumbnail(blob: Blob): void {
      const previous = currentThumbnailUrls.get(source);
      if (previous) {
        revokeThumbnailUrl(previous);
      }
      const url = createThumbnailUrl(blob);
      currentThumbnailUrls.set(source, url);
      thumbnail.src = url;
      thumbnail.hidden = false;
      removeButton.hidden = false;
    }

    function clearThumbnail(): void {
      const previous = currentThumbnailUrls.get(source);
      if (previous) {
        revokeThumbnailUrl(previous);
        currentThumbnailUrls.delete(source);
      }
      thumbnail.removeAttribute('src');
      thumbnail.hidden = true;
      removeButton.hidden = true;
    }

    function setError(message: string): void {
      errorEl.textContent = message;
    }

    function setRequiredState(hasDoc: boolean): void {
      setError(def.required && !hasDoc ? 'Required' : '');
    }

    const existing = await getDoc(source);
    if (existing) {
      showThumbnail(existing);
    }
    setRequiredState(existing !== null);

    input.addEventListener('change', () => {
      const picked = input.files?.[0];
      input.value = '';
      if (!picked) {
        return;
      }
      void (async () => {
        let file: File = picked;
        if (file.size > MAX_IMAGE_BYTES && def.acceptedTypes.has('image/jpeg')) {
          setBusy(true);
          const smaller = await compress(file).catch(() => null);
          setBusy(false);
          if (smaller) {
            file = smaller;
          }
        }
        handlePicked(file);
      })();
    });

    function handlePicked(file: File): void {
      const result = validateImage(file, def.acceptedTypes);
      if (!result.valid) {
        setError(result.errors.join(' '));
        return;
      }
      const startedAt = ++generation;
      setBusy(true);
      void putDoc(source, file).then(() => {
        setBusy(false);
        if (startedAt !== generation) return; // superseded by a remove/change since
        showThumbnail(file);
        setError('');
      });
    }

    removeButton.addEventListener('click', () => {
      const startedAt = ++generation;
      setBusy(true);
      void deleteDoc(source).then(() => {
        setBusy(false);
        if (startedAt !== generation) return; // superseded by a remove/change since
        clearThumbnail();
        setRequiredState(false);
      });
    });
  }
}

const app = document.getElementById('documents');
if (app) {
  void initDocumentManager(app);
}
