/**
 * Saudade icon set: small original stroke drawings, 24px grid, currentColor.
 * Lines are drawn a touch loose (slightly uneven lengths, soft joins) so they sit with the
 * hand-stamped type rather than looking like a system icon font.
 *
 * Decorative by default (aria-hidden). Pass `title` when an icon is the only content of a
 * control and the control has no aria-label of its own.
 */
import type { ReactNode, SVGProps } from "react";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Rendered size in px. Default 24. */
  size?: number;
  /** Accessible name; when set the icon is exposed as role="img". */
  title?: string;
}

function make(name: string, body: ReactNode) {
  function Icon({ size = 24, title, strokeWidth = 1.75, ...rest }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        role={title ? "img" : undefined}
        aria-label={title}
        aria-hidden={title ? undefined : true}
        focusable="false"
        {...rest}
      >
        {title && <title>{title}</title>}
        {body}
      </svg>
    );
  }
  Icon.displayName = `Icon${name}`;
  return Icon;
}

export const IconClose = make("Close", <path d="M6.3 6.2 17.8 17.7M17.7 6.4 6.2 17.8" />);

export const IconBack = make("Back", <path d="M10.6 5.6 4.3 12l6.3 6.4M4.8 12c5.1-.2 10.1.2 15 0" />);

export const IconPlay = make("Play", <path d="M8 5.6c0-.6.6-.9 1.1-.6l9.6 6.3c.5.3.5 1 0 1.3l-9.6 6.4c-.5.3-1.1 0-1.1-.6z" />);

export const IconPause = make(
  "Pause",
  <>
    <rect x="6.6" y="5.4" width="3.6" height="13.2" rx="1" />
    <rect x="13.8" y="5.4" width="3.6" height="13.2" rx="1" />
  </>,
);

export const IconMic = make(
  "Mic",
  <>
    <rect x="9" y="3.3" width="6" height="11" rx="3" />
    <path d="M6 11.2a6 6 0 0 0 12 0M12 17.3v3.3M8.8 20.7h6.4M9 7.3h2M9 10h2" />
  </>,
);

export const IconStop = make("Stop", <rect x="6.5" y="6.5" width="11" height="11" rx="2.2" />);

export const IconUpload = make("Upload", <path d="M12 15.2V4.4M7.6 8.6 12 4.2l4.4 4.4M4.6 14.8v3.6c0 .9.7 1.6 1.6 1.6h11.6c.9 0 1.6-.7 1.6-1.6v-3.6" />);

export const IconTrash = make("Trash", <path d="M4.4 6.9h15.2M9.4 6.8V4.6h5.2v2.2M6.4 7l1 12.6c0 .5.4.9.9.9h7.4c.5 0 .9-.4.9-.9l1-12.6M10.3 10.6v6.3M13.7 10.6v6.3" />);

export const IconCheck = make("Check", <path d="M4.9 12.6 9.6 17.2 19.2 7.2" />);

export const IconLink = make("Link", <path d="M10.2 13.8a3.9 3.9 0 0 0 5.6.1l3-3a4 4 0 0 0-5.7-5.6l-1.2 1.2M13.8 10.2a3.9 3.9 0 0 0-5.6-.1l-3 3a4 4 0 0 0 5.7 5.6l1.2-1.2" />);

export const IconMail = make(
  "Mail",
  <>
    <rect x="3.4" y="5.8" width="17.2" height="12.6" rx="1.2" />
    <path d="M3.8 6.6 12 13l8.2-6.4" />
  </>,
);

export const IconCopy = make(
  "Copy",
  <>
    <rect x="8.6" y="8.4" width="11" height="11.6" rx="1.4" />
    <path d="M15.4 8.2V5.6c0-.8-.6-1.4-1.4-1.4H5.8c-.8 0-1.4.6-1.4 1.4v8.6c0 .8.6 1.4 1.4 1.4h2.6" />
  </>,
);

export const IconPlus = make("Plus", <path d="M12 5.1v13.8M5.1 12.1h13.8" />);

export const IconExternal = make("External", <path d="M13.8 4.6h5.6v5.6M19.3 4.7l-8.2 8.2M17.2 13.6v4.9c0 .6-.5 1.1-1.1 1.1H5.6c-.6 0-1.1-.5-1.1-1.1V8c0-.6.5-1.1 1.1-1.1h4.9" />);

export const IconChevronRight = make("ChevronRight", <path d="M9.4 5.6 15.8 12l-6.4 6.4" />);

export const IconVolumeOn = make(
  "VolumeOn",
  <path d="M4.4 9.6h3.4l4.6-4v12.8l-4.6-4H4.4zM15.6 9.1a4 4 0 0 1 0 5.8M18.1 6.6a7.6 7.6 0 0 1 0 10.8" />,
);

export const IconVolumeOff = make("VolumeOff", <path d="M4.4 9.6h3.4l4.6-4v12.8l-4.6-4H4.4zM16 9.6l4.8 4.8M20.8 9.6 16 14.4" />);

export const IconImage = make(
  "Image",
  <>
    <rect x="3.6" y="5" width="16.8" height="14" rx="1.4" />
    <circle cx="15.4" cy="9.6" r="1.7" />
    <path d="M3.8 16.2 8.6 11.6l4 4 2.4-2.3 5.2 5.1" />
  </>,
);

export const IconWarning = make("Warning", <path d="M11.1 4.6c.4-.7 1.4-.7 1.8 0l8 14c.4.7-.1 1.5-.9 1.5H4c-.8 0-1.3-.8-.9-1.5zM12 9.8v4.4M12 17.1v.1" />);

export const IconRefresh = make("Refresh", <path d="M19.4 12.2a7.4 7.4 0 1 1-2.3-5.5M19.6 4.5v4.2h-4.2" />);

export const IconEye = make(
  "Eye",
  <>
    <path d="M2.6 12.1S6 5.6 12 5.6s9.4 6.5 9.4 6.5-3.4 6.4-9.4 6.4-9.4-6.4-9.4-6.4z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

export const IconSearch = make(
  "Search",
  <>
    <circle cx="10.6" cy="10.6" r="6.2" />
    <path d="M15.2 15.3 20 20.1" />
  </>,
);

/** Every icon by name, for the style guide and dynamic use. */
export const icons = {
  Close: IconClose,
  Back: IconBack,
  Play: IconPlay,
  Pause: IconPause,
  Mic: IconMic,
  Stop: IconStop,
  Upload: IconUpload,
  Trash: IconTrash,
  Check: IconCheck,
  Link: IconLink,
  Mail: IconMail,
  Copy: IconCopy,
  Plus: IconPlus,
  External: IconExternal,
  ChevronRight: IconChevronRight,
  VolumeOn: IconVolumeOn,
  VolumeOff: IconVolumeOff,
  Image: IconImage,
  Warning: IconWarning,
  Refresh: IconRefresh,
  Eye: IconEye,
  Search: IconSearch,
} as const;

export type IconName = keyof typeof icons;
