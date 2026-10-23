/** Separate storage avoids doubling the size of an already large localStorage. */
export async function backupProjectsBeforeRecovery(raw: string, sourceSha256: string): Promise<void> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("ai-architect-recovery-backups", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("snapshots");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("snapshots", "readwrite");
      const store = transaction.objectStore("snapshots");
      const key = `before-${sourceSha256}`;
      const previous = store.get(key);
      previous.onsuccess = () => {
        if (previous.result === undefined) store.add({ raw, createdAt: Date.now() }, key);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error ?? new Error("Project backup was interrupted."));
    });
  } finally { db.close(); }
}
