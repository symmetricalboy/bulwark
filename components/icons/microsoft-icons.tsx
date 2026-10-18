import { cn } from '@/lib/utils';

export function MicrosoftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="9.5" height="9.5" rx="1" fill="#F25022" />
      <rect x="12.5" y="2" width="9.5" height="9.5" rx="1" fill="#7FBA00" />
      <rect x="2" y="12.5" width="9.5" height="9.5" rx="1" fill="#00A4EF" />
      <rect x="12.5" y="12.5" width="9.5" height="9.5" rx="1" fill="#FFB900" />
    </svg>
  );
}

export function OutlookIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="7" y="3" width="15" height="18" rx="2" fill="#0078D4" />
      <path d="M7 9L14.5 14L22 9V19C22 20.1046 21.1046 21 20 21H9C7.89543 21 7 20.1046 7 19V9Z" fill="#28A8EA" />
      <rect x="2" y="6.5" width="11" height="11" rx="2" fill="#0364B8" />
      <ellipse cx="7.5" cy="12" rx="2.75" ry="3.25" stroke="white" strokeWidth="1.75" />
    </svg>
  );
}

export function MicrosoftCalendarIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="3" y="4" width="18" height="17" rx="2.5" fill="#0078D4" />
      <path d="M3 8.5H21V18.5C21 19.8807 19.8807 21 18.5 21H5.5C4.11929 21 3 19.8807 3 18.5V8.5Z" fill="#28A8EA" />
      <rect x="6.5" y="11" width="3" height="2.5" rx="0.5" fill="white" />
      <rect x="10.5" y="11" width="3" height="2.5" rx="0.5" fill="white" />
      <rect x="14.5" y="11" width="3" height="2.5" rx="0.5" fill="white" />
      <rect x="6.5" y="15" width="3" height="2.5" rx="0.5" fill="white" />
      <rect x="10.5" y="15" width="3" height="2.5" rx="0.5" fill="white" />
    </svg>
  );
}

export function MicrosoftToDoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="4" fill="#2564CF" />
      <path
        d="M7 12.5L10.5 16L17.5 8.5"
        stroke="#50E6FF"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OneDriveIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M9.5 7C12.1 7 14.3 8.6 15.1 10.9C15.5 10.7 16 10.6 16.5 10.6C18.7 10.6 20.5 12.4 20.5 14.6C20.5 14.9 20.5 15.1 20.4 15.4C21.6 16 22.5 17.3 22.5 18.8C22.5 20.8 20.9 22.5 18.8 22.5H6.2C3.6 22.5 1.5 20.4 1.5 17.8C1.5 15.5 3.2 13.6 5.4 13.2C5.2 12.6 5.1 12 5.1 11.4C5.1 8.9 7.1 7 9.5 7Z"
        fill="#0078D4"
      />
      <path
        d="M15.1 10.9C15.5 10.7 16 10.6 16.5 10.6C18.7 10.6 20.5 12.4 20.5 14.6C20.5 14.9 20.5 15.1 20.4 15.4C21.6 16 22.5 17.3 22.5 18.8C22.5 20.8 20.9 22.5 18.8 22.5H9.5C9.5 16.5 12 12.5 15.1 10.9Z"
        fill="#28A8EA"
      />
    </svg>
  );
}

export function MicrosoftPeopleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('w-4 h-4 shrink-0', className)}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="9.5" cy="8" r="3.5" fill="#28A8EA" />
      <circle cx="16" cy="9.5" r="2.75" fill="#0078D4" />
      <path
        d="M3.5 18.5C3.5 15.7386 6.18629 13.5 9.5 13.5C12.8137 13.5 15.5 15.7386 15.5 18.5V19.5C15.5 20.0523 15.0523 20.5 14.5 20.5H4.5C3.94772 20.5 3.5 20.0523 3.5 19.5V18.5Z"
        fill="#28A8EA"
      />
      <path
        d="M14.5 14.5C14.8 14.5 15.2 14.5 15.5 14.6C18.3 15 20.5 16.8 20.5 19V19.5C20.5 20.0523 20.0523 20.5 19.5 20.5H15.5V18.5C15.5 16.9 15.1 15.5 14.5 14.5Z"
        fill="#0078D4"
      />
    </svg>
  );
}
