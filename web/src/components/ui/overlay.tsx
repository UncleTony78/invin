"use client";

import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { Drawer } from "@base-ui/react/drawer";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { clsx } from "clsx";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Kbd } from "./button";

/* ---------------- Tooltip ----------------
   First tooltip waits 450ms; neighbours open instantly within 400ms (Provider timeout). */
export function TooltipProvider({ children }: { children: ReactNode }) {
  return (
    <BaseTooltip.Provider delay={450} timeout={400}>
      {children}
    </BaseTooltip.Provider>
  );
}

export function Tooltip({ label, kbd, side = "bottom", children }: { label: ReactNode; kbd?: string; side?: "top" | "bottom" | "left" | "right"; children: ReactElement }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-90">
          <BaseTooltip.Popup className="iv-tooltip">
            {label}
            {kbd && <Kbd>{kbd}</Kbd>}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

/* ---------------- Menu ----------------
   Scales from its trigger (--transform-origin). */
export const Menu = BaseMenu.Root;

export function MenuTrigger({ children }: { children: ReactElement }) {
  return <BaseMenu.Trigger render={children} />;
}

export function MenuContent({ children, align = "start", side = "bottom", className }: { children: ReactNode; align?: "start" | "center" | "end"; side?: "top" | "bottom" | "left" | "right"; className?: string }) {
  return (
    <BaseMenu.Portal>
      <BaseMenu.Positioner sideOffset={6} align={align} side={side} className="z-70">
        <BaseMenu.Popup className={clsx("iv-popup", className)}>{children}</BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  );
}

export function MenuItem({ danger, className, ...props }: ComponentProps<typeof BaseMenu.Item> & { danger?: boolean }) {
  return <BaseMenu.Item className={clsx("iv-menu-item", danger && "iv-menu-item--danger", className as string)} {...props} />;
}

export function MenuSeparator() {
  return <BaseMenu.Separator className="iv-menu-sep" />;
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="iv-menu-label">{children}</div>;
}

/* ---------------- Popover ---------------- */
export const Popover = BasePopover.Root;

export function PopoverTrigger({ children }: { children: ReactElement }) {
  return <BasePopover.Trigger render={children} />;
}

export function PopoverContent({ children, align = "start", className, width }: { children: ReactNode; align?: "start" | "center" | "end"; className?: string; width?: number | "anchor" }) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner sideOffset={6} align={align} className="z-70">
        <BasePopover.Popup
          className={clsx("iv-popup", className)}
          style={{ width: width === "anchor" ? "var(--anchor-width)" : width }}
        >
          {children}
        </BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  );
}

/* ---------------- Dialog ----------------
   Centred, scales from .96 (modals stay centred; only popovers follow triggers).
   Focus is trapped and returned by Base UI. */
export const Dialog = BaseDialog.Root;
export const DialogClose = BaseDialog.Close;

export function DialogTrigger({ children }: { children: ReactElement }) {
  return <BaseDialog.Trigger render={children} />;
}

export function DialogContent({
  title,
  description,
  children,
  footer,
  width,
}: {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="iv-backdrop" />
      <BaseDialog.Popup className="iv-dialog" style={width ? { width: `min(${width}px, calc(100vw - 32px))` } : undefined}>
        <div className="iv-dialog-head">
          <BaseDialog.Title className="iv-dialog-title">{title}</BaseDialog.Title>
          {description && <BaseDialog.Description className="iv-dialog-desc">{description}</BaseDialog.Description>}
        </div>
        {children && <div className="iv-dialog-body">{children}</div>}
        {footer && <div className="iv-dialog-foot">{footer}</div>}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  );
}

/* ---------------- Sheet ----------------
   A right-hand Drawer: tracks the finger 1:1, velocity decides dismissal,
   and the page behind steps back in step with the swipe (SheetStage). */
export const Sheet = (props: ComponentProps<typeof Drawer.Root>) => <Drawer.Root swipeDirection="right" {...props} />;
export const SheetClose = Drawer.Close;

export function SheetTrigger({ children }: { children: ReactElement }) {
  return <Drawer.Trigger render={children} />;
}

export function SheetContent({ label, top, children }: { label: string; top?: ReactNode; children: ReactNode }) {
  return (
    <Drawer.Portal>
      <Drawer.Backdrop className="iv-sheet-backdrop" />
      <Drawer.Viewport className="iv-sheet-viewport">
        <Drawer.Popup className="iv-sheet" aria-label={label}>
          {top && <div className="iv-sheet-top">{top}</div>}
          <Drawer.Content className="iv-sheet-body">{children}</Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  );
}

/** Wrap the app once so any open sheet pushes the page back. */
export function SheetStage({ children }: { children: ReactNode }) {
  return (
    <Drawer.Provider>
      <Drawer.IndentBackground className="iv-indent-bg" />
      <Drawer.Indent className="iv-indent">{children}</Drawer.Indent>
    </Drawer.Provider>
  );
}
