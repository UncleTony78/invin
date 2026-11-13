"use client";

import { Toast } from "@base-ui/react/toast";
import type { ReactNode } from "react";
import { Glyph } from "../invoice/status";

/**
 * Bottom-centre stack. Swipe down to dismiss; timers pause on hover and focus.
 * Usage: const toast = useToast(); toast({ title: "Pinned INV-0141", undo: () => ... })
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={5000} limit={3}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="iv-toast-viewport">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root key={t.id} toast={t} className="iv-toast" swipeDirection="down">
      <Toast.Content className="iv-toast-content">
        <span className="iv-toast-tick">
          <Glyph status="paid" />
        </span>
        <Toast.Title className="iv-toast-title" />
        <Toast.Action className="iv-toast-action" />
      </Toast.Content>
    </Toast.Root>
  ));
}

export function useToast() {
  const manager = Toast.useToastManager();
  return ({ title, undo }: { title: string; undo?: () => void }) => {
    const id = manager.add({
      title,
      actionProps: undo
        ? {
            children: "Undo",
            // A press on Undo is never the start of a swipe-to-dismiss
            onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
            onClick: () => {
              undo();
              manager.close(id);
            },
          }
        : undefined,
    });
    return id;
  };
}
