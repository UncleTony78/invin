"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { ComponentProps, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

type ButtonProps = ComponentProps<"button"> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  icon?: IconName;
  /** Square button that shows only the icon. Always pass an aria-label. */
  iconOnly?: boolean;
};

/** One button, four looks. Hover steps up 1px, press sinks and scales to .985. */
export function Button({ variant = "secondary", size = "md", icon, iconOnly, className, children, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={clsx("iv-btn", `iv-btn--${variant}`, size === "sm" && "iv-btn--sm", iconOnly && "iv-btn--icon", className)}
      {...props}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="iv-kbd">{children}</kbd>;
}

/**
 * Crossfades a button label when its key changes, with a short blur bridge so the
 * old and new words read as one morph (Send → Sending… → Sent).
 */
export function MorphLabel({ id, children }: { id: string; children: ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.span
        key={id}
        className="iv-morph"
        initial={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)", y: 4 }}
        animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, filter: "blur(3px)", y: -4 }}
        transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}
