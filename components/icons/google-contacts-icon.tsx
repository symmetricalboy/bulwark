import { cn } from "@/lib/utils";

// Official Google Contacts (2022 Material You edition, 96x96)
const CONTACTS_ICON_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAEGklEQVR4Ae2bA5AcXRSF+7dt22bpN8JCPIht21yjsqXYmulCbBbCmY2dFGLbejfvpmaNmVeZzO3ZnK/qrLdf1Tndj7ctxwIAAAAAAAAANe2HLHfgL8sVHKq1TGuX1vmQdoV+NpT/5s7fRglQe82z2tQEbe4pLRWhTvH/3PnfuwC4Am0sd/BEjrHG4v/laxgCaq56Qhs3jU2MivhafE0QAQ02PK+7jwAbF1XxNfnaYcBA6wosNjLWQHxtDNClUSuYZW6qobiNYgDewK/aoFv3PABug9sqBHAHVrBBMRG3lQ/gXvcvGxNTcZshgCswPOYBcJtAQ/SAHhgPxzwAbpPbxlZD8Bs2RETcNvr/YGWxALht9P/BJmIBcNtY/QZ7iAXAbd/X4AnAGIAAMAvCOgBgJYy9IIDdUJwHAJyI4UwYoCoCdUEAlXGoDQVlujoaAAAAAAAAMGQavZPgo3qJfspKsmleoo/2dhxz5VjFwUfV5x32qLeab1fPNdgc8Qr4yTqb1YuNtqs3m+9R33U5qioPuapc6VSiaqXTflcardOfZ7pTqYsrlT6yyjrJNr2b7Kc+ST7aoY1XrCE+paqmnFCvNtka9Z3QZxtsVb90P6FqpSk2PbzSaJs7jRoPGEAPli3jffRdok22NvymlspRvayz0TM+TBC/9znLJpsEEf/lK9r0V5L8ND7H8Hx3vTbkQMxLUj5vf4CfBpMgUvlpiNc+3qXNPl3Y/P6Tb6pP2+1hQ0T0RrM9qnrKTZMQ5tYcQE9b8cKIEfRIgo+Gs9mFlaD1WXsJ8wuF0HwPD8IRh1ArjeZQPNQTpU2kp7TRi7RUMSqt2xHpjthck+7I+ebbtKYE83nALWSCvEwGZhYPzI7tdrT5C0synwfdV5tudVwAPDsyGJRZWx05KOf0+SWI5/lhzBATrxNMn4LGTpztqFJkcPeLPAVsrIm2Wk6h/0R6NWeqWZI6j7lqYIiMKiVcNQqhThJ9bDmBnEVWaao45KjjA+C9I5MAPJnUWb7fn0Lfa4NvhQvgiw57HR/AW833GgVQM4NmWNKE9nZUOPGuptMD4F1UwzXBOtmBdwq9l7OxFk7P1t/k+ACeqLPJdCA+KNv329SbzY1ED7qzHR/AA+5s0wBuSM/7t0cYgIERsjIMQImeZLGxCECI0DEiApCCz3AlA0AANi2QDQBPwB7JADAG+Om4YACYhmpTrwgGgIUYmyoQALYiBALAZpxkANiOlg8ABzLyAeBIUj4AHMrLB4CyFPkAUJglHwBKE+UDQHGu+VbEw96oHkmiPD3RpnU55gpUReAFjQSbupoEUGHwkWiaiFeU+I5ItGlZpAFwZfSHrXcZmoaX9MKH4KcuWkGtq5GEwK+fvqm7owc92TcNTIz711QBAAAAAAAAAABwGzu2xPmLj8HiAAAAAElFTkSuQmCC";

export function GoogleContactsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("w-4 h-4 shrink-0", className)}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <image href={CONTACTS_ICON_DATA_URI} width="96" height="96" />
    </svg>
  );
}
