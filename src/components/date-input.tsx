"use client";

/** A date input where clicking anywhere in the field opens the native calendar picker,
 * not just the small icon — `showPicker()` is what the browser normally only wires to the icon. */
export function DateInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="date"
      {...props}
      onClick={(e) => {
        (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
        props.onClick?.(e);
      }}
    />
  );
}
