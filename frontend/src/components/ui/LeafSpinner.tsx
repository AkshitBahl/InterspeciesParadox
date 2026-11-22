interface LeafSpinnerProps {
  size?: number;
  className?: string;
}

// Three leaves turning around a stem. The brightest leaf leads, the others trail behind it.
const leaves = [
  { angle: 0, opacity: 0.35 },
  { angle: 120, opacity: 0.65 },
  { angle: 240, opacity: 1 },
];

/** A small leaf spinner. It uses the current text color, so set it with a text class. */
export default function LeafSpinner({ size = 24, className = "" }: LeafSpinnerProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`leaf-spinner shrink-0 ${className}`}
    >
      <g className="leaf-spinner-wheel">
        {leaves.map(({ angle, opacity }) => (
          <g key={angle} transform={`rotate(${angle} 20 20)`} opacity={opacity}>
            <path d="M20 2.5c4.8 3 6.2 7.6 0 13.5-6.2-5.9-4.8-10.5 0-13.5z" fill="currentColor" />
            <path d="M20 5.5v9" stroke="#fff" strokeOpacity=".45" strokeWidth="1.1" strokeLinecap="round" />
          </g>
        ))}
        <circle cx="20" cy="20" r="2.2" fill="currentColor" opacity=".55" />
      </g>
    </svg>
  );
}
