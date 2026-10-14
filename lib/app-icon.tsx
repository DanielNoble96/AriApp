import { ImageResponse } from "next/og";

// Same 5 petal colors, order and geometry as the sidebar's FlowerIcon
// (app/sidebar.tsx), on the app's pink background.
const PETAL_COLORS = ["#f2716a", "#b28cf5", "#f472b6", "#5cd9e8", "#86efac"];
const BG = "#f6bfe0";

/** Square, full-bleed icon (iOS/Android apply their own corner rounding). */
export function renderAppIcon(size: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: BG,
        }}
      >
        <svg width={size * 0.8} height={size * 0.8} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          {PETAL_COLORS.map((color, i) => (
            <g key={color} transform={`rotate(${i * 72} 50 50)`}>
              <ellipse cx="50" cy="28" rx="17" ry="23" fill={color} stroke="#0a0a0a" strokeWidth="4" />
            </g>
          ))}
          <circle cx="50" cy="50" r="13" fill="#ffffff" stroke="#0a0a0a" strokeWidth="4" />
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}
