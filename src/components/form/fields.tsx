"use client";

// Native HTML controls, Tailwind-styled. Every radio/checkbox row is a
// >=44px tap target because the whole label wraps the input.

export function TextField({
  label,
  value,
  onChange,
  type = "text",
  maxLength,
  placeholder,
  inputMode,
  disabled,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  maxLength?: number;
  placeholder?: string;
  inputMode?: "text" | "email" | "tel" | "search";
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <div>
      <label className="block">
        <span className="block text-sm font-medium text-brand-navy">
          {label}
        </span>
        <input
          type={type}
          inputMode={inputMode}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 h-11 w-full rounded-xl border border-black/10 bg-white px-3 text-sm text-brand-navy outline-none transition-colors placeholder:text-brand-navy/35 focus-visible:border-brand-navy/40 focus-visible:ring-2 focus-visible:ring-brand-navy/15 disabled:cursor-not-allowed disabled:bg-black/[0.03] disabled:text-brand-navy/40"
        />
      </label>
      {(hint || maxLength) && (
        <p className="mt-1 flex justify-between text-xs text-brand-navy/45">
          <span>{hint}</span>
          {maxLength && (
            <span>
              {value.length}/{maxLength}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 6,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-brand-navy">
        {label}
      </span>
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full resize-y rounded-xl border border-black/10 bg-white p-3 text-sm leading-relaxed text-brand-navy outline-none transition-colors placeholder:text-brand-navy/35 focus-visible:border-brand-navy/40 focus-visible:ring-2 focus-visible:ring-brand-navy/15"
      />
    </label>
  );
}

export function RadioGroup({
  label,
  name,
  options,
  value,
  onChange,
  required,
  error,
}: {
  label: string;
  name: string;
  options: readonly string[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-brand-navy">
        {label}
        {required && <span className="ml-1 text-brand-warm">*</span>}
      </legend>
      <div className="mt-2 space-y-2">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm text-brand-navy/80 transition-colors has-[:checked]:border-brand-navy has-[:checked]:bg-brand-navy/5 has-[:checked]:text-brand-navy"
          >
            <input
              type="radio"
              name={name}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="h-4 w-4 shrink-0 accent-brand-navy"
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
      {error && (
        <p className="mt-2 text-sm font-medium text-brand-warm" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}

export function CheckboxGroup({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: readonly string[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(opt: string) {
    onChange(
      values.includes(opt)
        ? values.filter((v) => v !== opt)
        : [...values, opt],
    );
  }
  return (
    <fieldset>
      <legend className="text-sm font-medium text-brand-navy">{label}</legend>
      <div className="mt-2 space-y-2">
        {options.map((opt) => (
          <label
            key={opt}
            className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl border border-black/10 px-3 py-2 text-sm text-brand-navy/80 transition-colors has-[:checked]:border-brand-navy has-[:checked]:bg-brand-navy/5 has-[:checked]:text-brand-navy"
          >
            <input
              type="checkbox"
              value={opt}
              checked={values.includes(opt)}
              onChange={() => toggle(opt)}
              className="h-4 w-4 shrink-0 accent-brand-navy"
            />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
