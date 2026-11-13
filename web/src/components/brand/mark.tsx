/** The InVin slot symbol, drawn inline so it can take a size and colour. */
export function InVinMark({ size = 28, color = "var(--brand-tangerine)", className }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="48 48 160 160" aria-hidden="true" className={className}>
      <path
        fill={color}
        fillRule="evenodd"
        d="M94 48H162A46 46 0 0 1 208 94V162A46 46 0 0 1 162 208H94A46 46 0 0 1 48 162V94A46 46 0 0 1 94 48ZM109 88H147A13 13 0 0 1 147 114H109A13 13 0 0 1 109 88Z"
      />
    </svg>
  );
}
