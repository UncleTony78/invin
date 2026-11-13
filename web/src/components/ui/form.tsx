"use client";

import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Field } from "@base-ui/react/field";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { clsx } from "clsx";
import { useLayoutEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Icon } from "./icon";

type TextFieldProps = Omit<ComponentProps<"input">, "size"> & {
  label: string;
  description?: ReactNode;
  error?: string;
};

/** Label, input, hint and error wired together for screen readers. */
export function TextField({ label, description, error, className, ...props }: TextFieldProps) {
  return (
    <Field.Root className={clsx("iv-field", className)} invalid={!!error}>
      <Field.Label className="iv-label">{label}</Field.Label>
      <Field.Control className="iv-input" {...props} />
      {error ? (
        <Field.Error className="iv-error" match>
          <Icon name="alert" size={14} />
          {error}
        </Field.Error>
      ) : (
        description && <Field.Description className="iv-hint">{description}</Field.Description>
      )}
    </Field.Root>
  );
}

export function TextArea({ label, description, className, ...props }: ComponentProps<"textarea"> & { label: string; description?: ReactNode }) {
  return (
    <Field.Root className={clsx("iv-field", className)}>
      <Field.Label className="iv-label">{label}</Field.Label>
      <Field.Control render={<textarea className="iv-input" {...props} />} />
      {description && <Field.Description className="iv-hint">{description}</Field.Description>}
    </Field.Root>
  );
}

/** The knob stretches while pressed, then slides. */
export function Switch({ label, description, ...props }: ComponentProps<typeof BaseSwitch.Root> & { label?: ReactNode; description?: ReactNode }) {
  const control = (
    <BaseSwitch.Root className="iv-switch" {...props}>
      <BaseSwitch.Thumb className="iv-switch-thumb" />
    </BaseSwitch.Root>
  );
  if (!label) return control;
  return (
    <label className="iv-switch-row">
      {control}
      <span>
        {label}
        {description && <small>{description}</small>}
      </span>
    </label>
  );
}

/** The tick draws itself in. */
export function Checkbox(props: ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    <BaseCheckbox.Root className="iv-check" {...props}>
      <BaseCheckbox.Indicator keepMounted render={<svg viewBox="0 0 24 24" aria-hidden="true" />}>
        <path d="M20 6 9 17l-5-5" />
      </BaseCheckbox.Indicator>
    </BaseCheckbox.Root>
  );
}

export type SegmentOption<T extends string> = { value: T; label: ReactNode };

/** Radio group with a sliding thumb. Arrow keys move between options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  fill,
}: {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  /** Stretch to the container, options sharing the width equally (forms and dialogs) */
  fill?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ x: number; w: number } | null>(null);
  const [animate, setAnimate] = useState(false);

  useLayoutEffect(() => {
    const measure = () => {
      const el = ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
      if (el) setThumb({ x: el.offsetLeft - 3, w: el.offsetWidth });
    };
    measure();
    // A filled control changes size with its container, so keep the thumb on its option
    const ro = new ResizeObserver(measure);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [value, options]);

  function move(delta: number) {
    const i = options.findIndex((o) => o.value === value);
    const next = options[(i + delta + options.length) % options.length];
    setAnimate(true);
    onChange(next.value);
    requestAnimationFrame(() => ref.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]')?.focus());
  }

  return (
    <div
      ref={ref}
      className={fill ? "iv-seg iv-seg--fill" : "iv-seg"}
      role="radiogroup"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {thumb && (
        <span
          className="iv-seg-thumb"
          aria-hidden="true"
          style={{ width: thumb.w, transform: `translateX(${thumb.x}px)`, transition: animate ? undefined : "none" }}
        />
      )}
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          tabIndex={o.value === value ? 0 : -1}
          onClick={() => {
            setAnimate(true);
            onChange(o.value);
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
