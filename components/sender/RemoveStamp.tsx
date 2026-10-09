"use client";

/**
 * "Remove this stamp": the quiet danger action at the foot of every editor, with a confirm.
 * Calls services.content.remove, then returns to the portal home. Media cleanup (photos/voice)
 * is passed in by the editor and is best-effort (production keeps removed media 90 days anyway).
 */
import { useLayoutEffect, useState } from "react";
import { InkButton } from "@/components/ui/InkButton";
import { IconTrash } from "@/components/ui/icons";
import { STAMPS } from "@/config/stamps";
import { senderPath } from "@/config/site";
import { services } from "@/lib/services";
import type { StampKind, UnitStatus } from "@/lib/services/types";
import { toast } from "@/lib/state/toast";
import { saveErrorText } from "./copy";
import { SenderConfirm } from "./SenderConfirm";
import { useLeave } from "./SenderShell";

const NOUN: Record<StampKind, string> = {
  photos: "your photos",
  letter: "your letter",
  voice: "your voice message",
  song: "the song",
};

export function RemoveStamp({
  token,
  kind,
  status,
  onRemoved,
}: {
  token: string;
  kind: StampKind;
  status: UnitStatus;
  /** Runs after a successful remove (throw the draft away, delete media files), before leaving. */
  onRemoved?: () => void;
}) {
  const leave = useLeave();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => () => setOpen(false), []);

  const live = status === "sealed" || status === "revealed";

  const remove = async () => {
    setBusy(true);
    const res = await services.content.remove(token, kind);
    setBusy(false);
    if (!res.ok) {
      toast("Couldn't remove it", { tone: "error", body: saveErrorText(res.error) });
      return;
    }
    onRemoved?.();
    setOpen(false);
    toast(`${STAMPS[kind].label} taken out of the envelope`);
    leave(senderPath(token));
  };

  return (
    <div className="mt-12 border-t border-dashed border-paper-edge pt-4">
      <InkButton variant="quiet" className="ss-danger-quiet" icon={<IconTrash size={18} />} onClick={() => setOpen(true)}>
        Remove this stamp
      </InkButton>
      <SenderConfirm
        open={open}
        title={`Remove ${NOUN[kind]}?`}
        confirmLabel="Remove"
        cancelLabel="Keep it"
        onConfirm={remove}
        onCancel={() => setOpen(false)}
        danger
        busy={busy}
        busyLabel="Removing"
      >
        {live
          ? `The ${STAMPS[kind].label.toLowerCase()} stamp comes off the envelope, and they won't see it any more. You can always add a new one.`
          : `The ${STAMPS[kind].label.toLowerCase()} stamp comes off the envelope. You can always add a new one.`}
      </SenderConfirm>
    </div>
  );
}
