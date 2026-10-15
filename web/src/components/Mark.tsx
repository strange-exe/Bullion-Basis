/** The team's ingot mark (same artwork as favicon.svg). Decorative next to the wordmark. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true">
      <rect width="34" height="34" rx="9" fill="#1B2430" />
      <path d="M7 24 L11 14 H23 L27 24 Z" fill="#C9962B" />
      <path d="M11 14 H23 L21.5 10 H12.5 Z" fill="#F2B27A" />
    </svg>
  );
}
