"use client";

/**
 * Local (IndexedDB) queue for the public survey form
 * (`src/app/survey/[token]/SurveyForm.tsx`) so a rep filling in the survey
 * with no signal doesn't lose photos or a final submit — each upload/submit
 * that fails is queued here and retried automatically once the device is
 * back online (see `useOnlineStatus` + the flush logic in `SurveyForm.tsx`).
 * Keyed by survey token so different survey links on the same device never
 * collide.
 *
 * IndexedDB, not localStorage (see `useAutosaveDraft`) — photos are
 * full-res camera images (multi-MB `File`s), too large/wrong-shaped for
 * `useAutosaveDraft`'s JSON-in-localStorage draft, which only ever holds
 * the small text answers.
 *
 * Every function fails soft (returns `false`/`null`/`[]`) if IndexedDB is
 * unavailable (private browsing, disabled storage) — callers should treat
 * that as "queueing isn't possible here" and surface the original
 * upload/submit error instead of claiming something was saved.
 */

import type { BoilerSurveyAnswers, PhotoChecklistItemKey } from "@/types/boiler-survey";

const DB_NAME = "margav-survey-offline";
const DB_VERSION = 1;
const PHOTOS_STORE = "pending-photos";
const SUBMITS_STORE = "pending-submits";

export interface PendingPhoto {
  itemKey: PhotoChecklistItemKey;
  file: File;
  queuedAt: string;
}

interface PendingPhotoRecord extends PendingPhoto {
  id: string;
  token: string;
}

interface PendingSubmitRecord {
  token: string;
  answers: BoilerSurveyAnswers;
  queuedAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) db.createObjectStore(PHOTOS_STORE, { keyPath: "id" });
      if (!db.objectStoreNames.contains(SUBMITS_STORE)) db.createObjectStore(SUBMITS_STORE, { keyPath: "token" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function photoId(token: string, itemKey: string): string {
  return `${token}::${itemKey}`;
}

function withStore<T>(storeName: string, mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const request = fn(tx.objectStore(storeName));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        tx.oncomplete = () => db.close();
      }),
  );
}

/** Queues a photo that failed to upload (offline/network error) for retry later. */
export async function queuePendingPhoto(token: string, itemKey: PhotoChecklistItemKey, file: File): Promise<boolean> {
  try {
    const record: PendingPhotoRecord = { id: photoId(token, itemKey), token, itemKey, file, queuedAt: new Date().toISOString() };
    await withStore<IDBValidKey>(PHOTOS_STORE, "readwrite", (store) => store.put(record));
    return true;
  } catch {
    return false;
  }
}

/** All photos queued for this survey token, oldest first. */
export async function listPendingPhotos(token: string): Promise<PendingPhoto[]> {
  try {
    const all = await withStore<PendingPhotoRecord[]>(PHOTOS_STORE, "readonly", (store) => store.getAll() as IDBRequest<PendingPhotoRecord[]>);
    return all
      .filter((record) => record.token === token)
      .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))
      .map(({ itemKey, file, queuedAt }) => ({ itemKey, file, queuedAt }));
  } catch {
    return [];
  }
}

export async function removePendingPhoto(token: string, itemKey: PhotoChecklistItemKey): Promise<void> {
  try {
    await withStore<undefined>(PHOTOS_STORE, "readwrite", (store) => store.delete(photoId(token, itemKey)) as unknown as IDBRequest<undefined>);
  } catch {
    // ignore — nothing queued, or storage unavailable
  }
}

/** Queues the final submit that failed (offline/network error) for retry later. Overwrites any previous queued submit for this token — only the latest answers matter. */
export async function queuePendingSubmit(token: string, answers: BoilerSurveyAnswers): Promise<boolean> {
  try {
    const record: PendingSubmitRecord = { token, answers, queuedAt: new Date().toISOString() };
    await withStore<IDBValidKey>(SUBMITS_STORE, "readwrite", (store) => store.put(record));
    return true;
  } catch {
    return false;
  }
}

export async function getPendingSubmit(token: string): Promise<BoilerSurveyAnswers | null> {
  try {
    const record = await withStore<PendingSubmitRecord | undefined>(SUBMITS_STORE, "readonly", (store) => store.get(token) as IDBRequest<PendingSubmitRecord | undefined>);
    return record?.answers ?? null;
  } catch {
    return null;
  }
}

export async function clearPendingSubmit(token: string): Promise<void> {
  try {
    await withStore<undefined>(SUBMITS_STORE, "readwrite", (store) => store.delete(token) as unknown as IDBRequest<undefined>);
  } catch {
    // ignore
  }
}
