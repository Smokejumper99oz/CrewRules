"use client";

const SHIELD_COLOR = "#75C043";
const UNSELECTED_COLOR = "rgb(100 116 139)";
const STROKE_WIDTH = 1.5;

const shieldPath =
  "M12 2L4 6v8c0 6 8 9 8 9s8-3 8-9V6l-8-4z";

type IconProps = { className?: string; selected?: boolean };

function PilotShieldIcon({ className, selected = true }: IconProps) {
  const color = selected ? SHIELD_COLOR : UNSELECTED_COLOR;
  return (
    <svg
      viewBox="0 0 24 28"
      className={className}
      aria-hidden
      fill="none"
      stroke={color}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={shieldPath} />
      {/* Filled side-profile passenger jet - slight upward angle */}
      <path
        d="M7 14.2 L7.6 12.6 L8 12.3 L13.5 12 L15.5 12.2 L17 12.6 L16.5 13.2 L15 13 L11.5 14.5 L9 13.2 L7.5 13.8 Z"
        fill={color}
        stroke="none"
      />
    </svg>
  );
}

function FlightAttendantShieldIcon({ className, selected = true }: IconProps) {
  const stroke = selected ? SHIELD_COLOR : UNSELECTED_COLOR;
  return (
    <svg
      viewBox="0 0 24 28"
      className={className}
      aria-hidden
      fill="none"
      stroke={stroke}
      strokeWidth={STROKE_WIDTH}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={shieldPath} />
      {/* Two wings symmetrically from central circle - enterprise wing badge */}
      <circle cx="12" cy="14" r="1.5" stroke={stroke} strokeWidth={STROKE_WIDTH} fill="none" />
      <path d="M12 14Q6 10 5 14" />
      <path d="M12 14Q18 10 19 14" />
    </svg>
  );
}

export { PilotShieldIcon, FlightAttendantShieldIcon };
