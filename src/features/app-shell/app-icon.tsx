import { ImageResponse } from "next/og";

const shell = "#080907";
const volt = "#D5FF3F";

export function appIcon(size: number) {
  const mark = Math.round(size * 0.56);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: volt,
      }}
    >
      <svg width={mark} height={mark} viewBox="0 0 16 16">
        <path
          d="M4.5 13.5 8.5 2.5M9 13.5l4-11"
          fill="none"
          stroke={shell}
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>,
    { width: size, height: size },
  );
}
