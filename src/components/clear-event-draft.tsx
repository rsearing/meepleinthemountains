"use client";

import { useEffect } from "react";

export function ClearEventDraft({ draftKey }: { draftKey: string }) {
  useEffect(() => {
    window.sessionStorage.removeItem(draftKey);
  }, [draftKey]);

  return null;
}
