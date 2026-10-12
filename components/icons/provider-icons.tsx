import { cn } from "@/lib/utils";

export function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", className)} viewBox="0 0 24 24" fill="none">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" rx="1" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" rx="1" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" rx="1" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" rx="1" />
    </svg>
  );
}

export function AppleIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", className)} viewBox="0 0 170 170" fill="currentColor">
      <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.04-7.69-7.74-11.99-14.09-6.3-9.3-11.24-20.08-14.81-32.33-3.58-12.25-5.37-23.75-5.37-34.5 0-14.24 3.73-26.04 11.19-35.39 7.46-9.35 16.73-14.12 27.81-14.31 5.34 0 11.15 1.48 17.43 4.45 6.28 2.97 10.3 4.54 12.06 4.71 2.21-.34 6.77-2.07 13.68-5.2 6.91-3.13 12.76-4.52 17.55-4.17 13.27.72 23.51 5.57 30.73 14.54-11.59 7.02-17.29 16.71-17.1 29.07.19 9.8 4.04 17.99 11.55 24.58 7.51 6.59 16.48 10.23 26.91 10.92-2.39 7.39-5.18 14.86-8.37 22.41zM119.22 33.64c0-7.39 2.64-14.28 7.93-20.67 5.29-6.39 11.83-10.74 19.63-13.06.39 1.58.59 3.09.59 4.53 0 7.39-2.73 14.37-8.19 20.94-5.46 6.57-12.08 10.74-19.86 12.51-.1-.85-.1-2.27-.1-4.25z" />
    </svg>
  );
}

export function NextcloudIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", className)} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="4.2" stroke="#0082c9" strokeWidth="2.2" />
      <circle cx="5.2" cy="12" r="2.6" stroke="#0082c9" strokeWidth="1.8" />
      <circle cx="18.8" cy="12" r="2.6" stroke="#0082c9" strokeWidth="1.8" />
    </svg>
  );
}

export function AtprotoIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", className)} viewBox="0 0 568 501" fill="none">
      <path
        fill="#1185FE"
        d="M123.12 35.78C169.6 7.42 227.42 0 284 0c56.58 0 114.4 7.42 160.88 35.78 48.78 29.77 78.58 79.16 82.84 135.08 6.42 84.18-36.46 158.46-87.3 205.8-56.12 52.26-118.8 84.28-156.42 124.34-37.62-40.06-100.3-72.08-156.42-124.34-50.84-47.34-93.72-121.62-87.3-205.8C44.54 114.94 74.34 65.55 123.12 35.78z"
      />
    </svg>
  );
}

export function DropboxIcon({ className }: { className?: string }) {
  return (
    <svg className={cn("w-4 h-4 shrink-0", className)} viewBox="0 0 24 24" fill="#0061FF">
      <path d="M6 2l6 4-6 4-6-4 6-4zm12 0l6 4-6 4-6-4 6-4zM0 10l6 4-6 4-6-4 6-4zm24 0l-6 4 6 4 6-4-6-4zM6 18l6-4 6 4-6 4-6-4z" />
    </svg>
  );
}
