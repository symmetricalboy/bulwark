import { useId } from "react";
import { cn } from "@/lib/utils";

export function GoogleTasksIcon({ className }: { className?: string }) {
  const rawId = useId();
  const id = rawId.replace(/:/g, "");
  const clipA = `gtasks-clipa-${id}`;
  const clipF = `gtasks-clipf-${id}`;
  const gradE = `gtasks-grade-${id}`;
  const filtB = `gtasks-filtb-${id}`;
  const maskD = `gtasks-maskd-${id}`;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 192 192"
      fill="none"
      className={cn("w-4 h-4 shrink-0", className)}
    >
      <defs>
        <clipPath id={clipA}>
          <path fill="#fff" d="M0 0h192v192H0z" />
        </clipPath>
        <clipPath id={clipF}>
          <path fill="#fff" d="M44 38h104v104H44z" />
        </clipPath>
        <linearGradient
          id={gradE}
          x1="96"
          x2="100.64"
          y1="166.9"
          y2="67.25"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset=".01" stopColor="#a9a8ff" />
          <stop offset=".79" stopColor="#a9a8ff" stopOpacity={0} />
        </linearGradient>
        <filter
          id={filtB}
          width="176"
          height="154"
          x="8"
          y="40"
          colorInterpolationFilters="sRGB"
          filterUnits="userSpaceOnUse"
        >
          <feFlood floodOpacity={0} result="BackgroundImageFix" />
          <feBlend in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur result="effect1_foregroundBlur_37601_9976" stdDeviation={6} />
        </filter>
      </defs>
      <g clipPath={`url(#${clipA})`}>
        <rect width="152" height="130" x="20" y="52" fill="#bbe2ff" rx="65" />
        <rect width="172" height="152" x="10" y="14" fill="#3186ff" rx="74" />
        <mask
          id={maskD}
          width="172"
          height="152"
          x="10"
          y="14"
          maskUnits="userSpaceOnUse"
          style={{ maskType: "alpha" }}
        >
          <rect width="172" height="152" x="10" y="14" fill="#3c90ff" rx="74" />
        </mask>
        <g filter={`url(#${filtB})`} mask={`url(#${maskD})`}>
          <rect width="152" height="130" x="20" y="52" fill={`url(#${gradE})`} rx="65" />
        </g>
        <g clipPath={`url(#${clipF})`}>
          <path
            stroke="#fff"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={12}
            d="m61 90 22.172 22.172a4 4 0 0 0 5.656 0L138 63"
          />
        </g>
      </g>
    </svg>
  );
}
