import { useEffect, useRef, useState } from "react";

type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

type UseAutosaveOptions = {
  snapshot: string;
  enabled: boolean;
  delayMs?: number;
  onSave: () => Promise<void>;
};

export function useAutosave({ snapshot, enabled, delayMs = 30_000, onSave }: UseAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const lastSavedSnapshotRef = useRef(snapshot);
  const initializedRef = useRef(false);
  const savingRef = useRef(false);
  const onSaveRef = useRef(onSave);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!enabled) return;
    if (!initializedRef.current) {
      initializedRef.current = true;
      lastSavedSnapshotRef.current = snapshot;
      setStatus("idle");
      return;
    }

    if (snapshot === lastSavedSnapshotRef.current) {
      setStatus((current) => (current === "saving" ? current : "saved"));
      return;
    }

    setStatus("dirty");
    const timer = window.setTimeout(async () => {
      if (savingRef.current || snapshot === lastSavedSnapshotRef.current) return;
      savingRef.current = true;
      setStatus("saving");
      try {
        await onSaveRef.current();
        lastSavedSnapshotRef.current = snapshot;
        setStatus("saved");
      } catch {
        setStatus("error");
      } finally {
        savingRef.current = false;
      }
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [delayMs, enabled, snapshot]);

  const markSaved = (nextSnapshot = snapshot) => {
    initializedRef.current = true;
    lastSavedSnapshotRef.current = nextSnapshot;
    setStatus("saved");
  };

  return { status, markSaved };
}

export type { AutosaveStatus };
