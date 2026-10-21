export function BellIcon(
  props: Omit<React.ComponentProps<"svg">, "viewBox" | "children">,
) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 11.5 V7.2 A4 4 0 0 1 12 7.2 V11.5 L13.2 12.8 H2.8 Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M6.6 14.2 H9.4"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
