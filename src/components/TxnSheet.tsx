"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { Field } from "./Field";
import { Sheet } from "./Sheet";
import { SubmitButton } from "./SubmitButton";

import { createTransaction } from "@/lib/actions";
import { idleState } from "@/lib/action-state";
import { fileBadge, isImage, shortFileName } from "@/lib/mime";
import {
  MAX_FILES_PER_ENTRY,
  MAX_FILE_LABEL,
  TOO_LARGE_MESSAGE,
  TOO_MANY_MESSAGE,
  isOversize,
} from "@/lib/upload-limits";
import { TXN_TYPES, txnMeta, type TxnType } from "@/lib/types";

type Pending = { key: string; file: File; url: string | null };

export function TxnSheet({
  open,
  partyId,
  partyName,
  initialType,
  today,
  onClose,
}: {
  open: boolean;
  partyId: string;
  partyName: string;
  initialType: TxnType;
  today: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState(createTransaction, idleState);
  const [type, setType] = useState<TxnType>(initialType);
  const [pending, setPending] = useState<Pending[]>([]);
  // Rejections from the picker itself, shown without a round-trip to the
  // server. `storeUpload` re-checks all of this regardless.
  const [fileError, setFileError] = useState<string | null>(null);
  // A stale error under a field the user has since corrected is noise; it
  // clears on the next edit and comes back only if the server rejects again.
  const [showError, setShowError] = useState(true);

  const filesRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLInputElement>(null);
  const savedAt = useRef(state.savedAt);

  useEffect(() => {
    if (open) setType(initialType);
  }, [open, initialType]);

  useEffect(() => setShowError(true), [state]);

  // A save returns a fresh `savedAt`; that is the signal to close and reset.
  useEffect(() => {
    if (state.savedAt && state.savedAt !== savedAt.current) {
      savedAt.current = state.savedAt;
      setPending([]);
      setFileError(null);
      onClose();
    }
  }, [state.savedAt, onClose]);

  useEffect(() => {
    if (open) return;
    setFileError(null);
    setPending((current) => {
      current.forEach((item) => item.url && URL.revokeObjectURL(item.url));
      return [];
    });
  }, [open]);

  /**
   * The pending list is the source of truth; it is mirrored into a hidden
   * multi-file input via DataTransfer so a plain form submit carries exactly
   * the files still on screen.
   */
  function syncInput(next: Pending[]) {
    const transfer = new DataTransfer();
    next.forEach((item) => transfer.items.add(item.file));
    if (filesRef.current) filesRef.current.files = transfer.files;
  }

  function addFiles(list: FileList | null) {
    const chosen = [...(list ?? [])];
    if (chosen.length === 0) return;

    // Oversized files are dropped rather than queued, so the sheet never shows
    // a receipt that the save is going to reject.
    const tooBig = chosen.filter((file) => isOversize(file.size));
    const withinSize = chosen.filter((file) => !isOversize(file.size));
    const room = Math.max(0, MAX_FILES_PER_ENTRY - pending.length);
    const accepted = withinSize.slice(0, room);

    setFileError(
      tooBig.length > 0
        ? `${namesOf(tooBig)} — ${TOO_LARGE_MESSAGE}`
        : withinSize.length > room
          ? TOO_MANY_MESSAGE
          : null,
    );

    if (accepted.length === 0) return;

    const next = [
      ...pending,
      ...accepted.map((file) => ({
        key: `${file.name}-${file.size}-${file.lastModified}-${Math.random()}`,
        file,
        url: isImage(file.type) ? URL.createObjectURL(file) : null,
      })),
    ];
    syncInput(next);
    setPending(next);
  }

  function removeFile(key: string) {
    setFileError(null);
    setPending((current) => {
      const target = current.find((item) => item.key === key);
      if (target?.url) URL.revokeObjectURL(target.url);
      const next = current.filter((item) => item.key !== key);
      syncInput(next);
      return next;
    });
  }

  return (
    <Sheet open={open} title={`${txnMeta(type).label} · ${partyName}`} onClose={onClose}>
      <form
        action={formAction}
        onChange={() => setShowError(false)}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="partyId" value={partyId} />
        <input type="hidden" name="type" value={type} />

        <div className="grid grid-cols-2 gap-2.5" role="group" aria-label="Entry type">
          {TXN_TYPES.map((option) => {
            const active = type === option.id;
            const inflow = option.dir > 0;
            const activeClass = inflow
              ? "border-in bg-in-bg text-in"
              : "border-out bg-out-bg text-out";
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={active}
                onClick={() => setType(option.id)}
                className={`min-h-12 rounded-[13px] border px-3 py-3 text-left text-sm font-semibold transition-colors ${
                  active ? activeClass : "border-line bg-surface text-muted hover:border-line-dash"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <Field
          label="Amount"
          name="amount"
          inputMode="decimal"
          placeholder="0"
          autoComplete="off"
          maxLength={24}
          inputClassName="min-h-[60px] py-3.5 text-[26px] font-mono font-medium"
        />

        <div className="flex flex-wrap gap-2.5">
          <Field
            label="Date"
            name="date"
            type="date"
            defaultValue={today}
            max={today}
            className="flex-[1_1_150px]"
            inputClassName="text-[15px]"
          />
          <Field
            label="Note"
            name="note"
            placeholder="Cash, UPI, bill no…"
            autoComplete="off"
            maxLength={280}
            className="flex-[1_1_150px]"
            inputClassName="text-[15px]"
          />
        </div>

        <div className="flex flex-col gap-[9px] text-[13px] text-muted">
          <span>
            Receipt or bill
            <span className="text-faint"> · images or PDF, up to {MAX_FILE_LABEL} each</span>
          </span>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="min-h-12 flex-[1_1_140px] rounded-[13px] border border-dashed border-line-dash bg-surface p-3 text-sm font-semibold text-body transition-colors hover:border-ink"
            >
              Take a photo
            </button>
            <button
              type="button"
              onClick={() => browseRef.current?.click()}
              className="min-h-12 flex-[1_1_140px] rounded-[13px] border border-dashed border-line-dash bg-surface p-3 text-sm font-semibold text-body transition-colors hover:border-ink"
            >
              Choose image or PDF
            </button>
          </div>

          {/* The input that actually submits. */}
          <input ref={filesRef} type="file" name="files" multiple hidden />
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={browseRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />

          {pending.length > 0 ? (
            <ul className="flex list-none flex-wrap gap-2.5 p-0">
              {pending.map((item) => (
                <li
                  key={item.key}
                  className="flex items-center gap-2 rounded-xl border border-line bg-surface py-[7px] pr-2.5 pl-[7px] text-xs text-body"
                >
                  <span
                    aria-hidden
                    className="flex h-8 w-8 items-center justify-center rounded-lg bg-raised bg-cover bg-center text-[10px] font-semibold text-subtle"
                    style={item.url ? { backgroundImage: `url(${item.url})` } : undefined}
                  >
                    {fileBadge(item.file.type)}
                  </span>
                  <span className="max-w-[140px] truncate">
                    {shortFileName(item.file.name)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(item.key)}
                    aria-label={`Remove ${item.file.name}`}
                    className="px-1 py-0.5 text-sm text-faint transition-colors hover:text-ink"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {fileError ? (
            <p role="alert" className="text-[13px] text-out">
              {fileError}
            </p>
          ) : null}
        </div>

        {state.error && showError ? (
          <p role="alert" className="text-[13px] text-out">
            {state.error}
          </p>
        ) : null}

        <SubmitButton pendingLabel="Saving…">Save entry</SubmitButton>
      </form>
    </Sheet>
  );
}

/** "bill.pdf" or "bill.pdf and 2 others" — enough to know which file failed. */
function namesOf(files: File[]): string {
  const [first, ...rest] = files.map((file) => shortFileName(file.name));
  return rest.length === 0 ? first : `${first} and ${rest.length} more`;
}
