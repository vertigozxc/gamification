import { forwardRef } from "react";

// Text input that renders a subtle ✕ clear button when non-empty.
// All layout + theming is controlled by the caller through the
// `containerStyle` / `inputStyle` props so each screen keeps its own
// look. The clear button is absolutely positioned inside the input
// so the overall layout matches a plain <input>.
const InputWithClear = forwardRef(function InputWithClear(
  {
    value,
    onChange,
    onClear,
    placeholder,
    type = "text",
    maxLength,
    inputMode,
    autoCapitalize,
    autoCorrect,
    spellCheck,
    disabled = false,
    ariaLabel,
    clearAriaLabel,
    containerStyle,
    inputStyle,
    rightPadding = 40
  },
  ref
) {
  const hasValue = String(value || "").length > 0;

  return (
    <div style={{ position: "relative", width: "100%", ...containerStyle }}>
      <input
        ref={ref}
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        inputMode={inputMode}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        disabled={disabled}
        aria-label={ariaLabel}
        style={{
          width: "100%",
          boxSizing: "border-box",
          paddingRight: hasValue ? rightPadding : undefined,
          ...inputStyle
        }}
      />
      {hasValue && !disabled ? (
        <button
          type="button"
          onClick={() => {
            if (onClear) onClear();
            else onChange?.("");
          }}
          aria-label={clearAriaLabel || "Clear"}
          className="mobile-pressable"
          style={{
            position: "absolute",
            top: "50%",
            right: 10,
            transform: "translateY(-50%)",
            width: 24,
            height: 24,
            borderRadius: 999,
            border: "none",
            background: "rgba(148, 163, 184, 0.22)",
            color: "var(--color-muted)",
            fontSize: 12,
            fontWeight: 900,
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            padding: 0,
            WebkitTapHighlightColor: "transparent"
          }}
        >
          ✕
        </button>
      ) : null}
    </div>
  );
});

export default InputWithClear;
