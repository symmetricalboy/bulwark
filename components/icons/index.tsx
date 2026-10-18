'use client';

// Bulwark's icon set. Every icon the UI draws is imported from here.
// Users can choose their preferred icon pack in Appearance Settings:
// - Tabler (Default)
// - Material Symbols
// - Lucide

import React, { forwardRef } from 'react';
import type { TablerIcon, IconProps } from '@tabler/icons-react';
import { useSettingsStore } from '@/stores/settings-store';
import { getIconColor } from '@/lib/icon-colors';
import { useIconContrast } from '@/contexts/icon-contrast-context';
import { cn } from '@/lib/utils';

export type { TablerIcon as AppIcon, IconProps as AppIconProps } from '@tabler/icons-react';
export { iconForName, toStoredIconName, toTablerName, POPULAR_ICON_NAMES, loadAllIconNames, TABLER_ICON_PREFIX } from './named';
export { GoogleIcon } from './google-icon';
export { GoogleDriveIcon } from './google-drive-icon';
export { GoogleCalendarIcon } from './google-calendar-icon';
export { GoogleTasksIcon } from './google-tasks-icon';
export { GoogleContactsIcon } from './google-contacts-icon';
export { GmailIcon } from './gmail-icon';


// Tabler Icons
import {
  IconActivity,
  IconAddressBook,
  IconAdjustmentsHorizontal,
  IconAlertCircle,
  IconAlertTriangle,
  IconAlignCenter,
  IconAlignLeft,
  IconAlignRight,
  IconArchive,
  IconArrowBack,
  IconArrowBackUp,
  IconArrowBackUpDouble,
  IconArrowDown,
  IconArrowForward,
  IconArrowForwardUp,
  IconArrowLeft,
  IconArrowLeftRight,
  IconArrowRight,
  IconArrowUp,
  IconArrowsShuffle,
  IconArrowsSort,
  IconArrowsVertical,
  IconBan,
  IconBaseline,
  IconBeach,
  IconBell,
  IconBellOff,
  IconBold,
  IconBolt,
  IconBook,
  IconBook2,
  IconBookmark,
  IconBookmarkPlus,
  IconBox,
  IconBrain,
  IconBriefcase,
  IconBug,
  IconBuilding,
  IconBuildingStore,
  IconBulb,
  IconCake,
  IconCalendar,
  IconCalendarCheck,
  IconCalendarClock,
  IconCalendarMonth,
  IconCalendarUp,
  IconCalendarX,
  IconCamera,
  IconCheck,
  IconChecklist,
  IconChecks,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconChevronsLeft,
  IconChevronsRight,
  IconCircle,
  IconCircleArrowUp,
  IconCircleCheck,
  IconCircleX,
  IconClearFormatting,
  IconClipboard,
  IconClipboardCopy,
  IconClock,
  IconClockHour3,
  IconCloud,
  IconCode,
  IconColorSwatch,
  IconColumns3,
  IconCopy,
  IconCopyPlus,
  IconCornerDownLeft,
  IconDatabase,
  IconDeviceDesktop,
  IconDeviceFloppy,
  IconDeviceMobile,
  IconDots,
  IconDotsVertical,
  IconDownload,
  IconEdit,
  IconEraser,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconFile,
  IconFileCode,
  IconFileMusic,
  IconFilePlus,
  IconFileSpreadsheet,
  IconFileText,
  IconFileZip,
  IconFiles,
  IconFilter,
  IconFlag,
  IconFlask,
  IconFold,
  IconFolder,
  IconFolderDown,
  IconFolderOpen,
  IconFolderPlus,
  IconFolderSearch,
  IconFolderUp,
  IconFolderX,
  IconFolders,
  IconGitFork,
  IconGridDots,
  IconGripVertical,
  IconH1,
  IconH2,
  IconHeart,
  IconHelpCircle,
  IconHighlight,
  IconHome,
  IconInbox,
  IconInfoCircle,
  IconItalic,
  IconKey,
  IconKeyboard,
  IconLabelImportant,
  IconLanguage,
  IconLayoutDashboard,
  IconLayoutGrid,
  IconLayoutList,
  IconLayoutRows,
  IconTemplate,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarRight,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
  IconLink,
  IconList,
  IconListNumbers,
  IconLoader2,
  IconLock,
  IconLockOpen,
  IconLogin,
  IconLogout,
  IconMail,
  IconMailCheck,
  IconMailOpened,
  IconMailX,
  IconMapPin,
  IconMaximize,
  IconMenu2,
  IconMessage,
  IconMessages,
  IconMinimize,
  IconMinus,
  IconMoon,
  IconNote,
  IconNotebook,
  IconPackage,
  IconPalette,
  IconPaperclip,
  IconPencil,
  IconPhone,
  IconPhoto,
  IconPinned,
  IconPinnedOff,
  IconPlayerPlay,
  IconPlug,
  IconPlus,
  IconPower,
  IconPresentation,
  IconPrinter,
  IconPuzzle,
  IconQrcode,
  IconQuote,
  IconRefresh,
  IconRepeat,
  IconRotate,
  IconRotateClockwise,
  IconScale,
  IconScissors,
  IconSearch,
  IconSearchOff,
  IconSend,
  IconServer,
  IconServer2,
  IconSettings,
  IconShare2,
  IconShield,
  IconShieldCheck,
  IconShieldExclamation,
  IconShieldFilled,
  IconSortAZ,
  IconSparkles,
  IconSquare,
  IconSquareCheck,
  IconStack,
  IconStar,
  IconStarOff,
  IconStrikethrough,
  IconSun,
  IconTable,
  IconTag,
  IconTags,
  IconTerminal,
  IconTool,
  IconTrash,
  IconTypography,
  IconUnderline,
  IconUpload,
  IconUser,
  IconUserCircle,
  IconUserEdit,
  IconUserMinus,
  IconUserPlus,
  IconUsers,
  IconVector,
  IconVideo,
  IconVolume2,
  IconWorld,
  IconX,
  IconZoomIn,
  IconZoomOut,
} from '@tabler/icons-react';

// Lucide Icons
import {
  Activity as LucideActivity,
  AlertCircle as LucideAlertCircle,
  AlertTriangle as LucideAlertTriangle,
  AlignCenter as LucideAlignCenter,
  AlignLeft as LucideAlignLeft,
  AlignRight as LucideAlignRight,
  Archive as LucideArchive,
  ArrowDown as LucideArrowDown,
  ArrowDownAZ as LucideArrowDownAZ,
  ArrowLeft as LucideArrowLeft,
  ArrowLeftRight as LucideArrowLeftRight,
  ArrowRight as LucideArrowRight,
  ArrowUp as LucideArrowUp,
  ArrowUpCircle as LucideArrowUpCircle,
  ArrowUpDown as LucideArrowUpDown,
  Ban as LucideBan,
  Baseline as LucideBaseline,
  Bell as LucideBell,
  BellOff as LucideBellOff,
  Bold as LucideBold,
  Book as LucideBook,
  BookOpen as LucideBookOpen,
  BookPlus as LucideBookPlus,
  BookUser as LucideBookUser,
  Bookmark as LucideBookmark,
  BookmarkPlus as LucideBookmarkPlus,
  Box as LucideBox,
  Brain as LucideBrain,
  Briefcase as LucideBriefcase,
  Bug as LucideBug,
  Building as LucideBuilding,
  Building2 as LucideBuilding2,
  Cake as LucideCake,
  Calendar as LucideCalendar,
  CalendarArrowUp as LucideCalendarArrowUp,
  CalendarCheck as LucideCalendarCheck,
  CalendarClock as LucideCalendarClock,
  CalendarDays as LucideCalendarDays,
  CalendarX as LucideCalendarX,
  Camera as LucideCamera,
  Check as LucideCheck,
  CheckCheck as LucideCheckCheck,
  CheckCircle as LucideCheckCircle,
  CheckCircle2 as LucideCheckCircle2,
  CheckSquare as LucideCheckSquare,
  ChevronDown as LucideChevronDown,
  ChevronLeft as LucideChevronLeft,
  ChevronRight as LucideChevronRight,
  ChevronUp as LucideChevronUp,
  ChevronsLeft as LucideChevronsLeft,
  ChevronsRight as LucideChevronsRight,
  Circle as LucideCircle,
  Clipboard as LucideClipboard,
  ClipboardCopy as LucideClipboardCopy,
  Clock as LucideClock,
  Clock3 as LucideClock3,
  Cloud as LucideCloud,
  Code as LucideCode,
  Columns3 as LucideColumns3,
  Copy as LucideCopy,
  CopyPlus as LucideCopyPlus,
  CornerDownLeft as LucideCornerDownLeft,
  Database as LucideDatabase,
  Download as LucideDownload,
  EditIcon as LucideEditIcon,
  Ellipsis as LucideEllipsis,
  Eraser as LucideEraser,
  ExternalLink as LucideExternalLink,
  Eye as LucideEye,
  EyeOff as LucideEyeOff,
  File as LucideFile,
  FileArchive as LucideFileArchive,
  FileAudio as LucideFileAudio,
  FileCode as LucideFileCode,
  FileImage as LucideFileImage,
  FilePlus as LucideFilePlus,
  FileSpreadsheet as LucideFileSpreadsheet,
  FileText as LucideFileText,
  FileVideo as LucideFileVideo,
  Files as LucideFiles,
  Filter as LucideFilter,
  Flag as LucideFlag,
  FlaskConical as LucideFlaskConical,
  FoldVertical as LucideFoldVertical,
  Folder as LucideFolder,
  FolderInput as LucideFolderInput,
  FolderOpen as LucideFolderOpen,
  FolderPlus as LucideFolderPlus,
  FolderSearch as LucideFolderSearch,
  FolderSync as LucideFolderSync,
  FolderUp as LucideFolderUp,
  FolderX as LucideFolderX,
  Forward as LucideForward,
  GitFork as LucideGitFork,
  Globe as LucideGlobe,
  Grid3x3 as LucideGrid3x3,
  GripVertical as LucideGripVertical,
  HardDrive as LucideHardDrive,
  Heading1 as LucideHeading1,
  Heading2 as LucideHeading2,
  Heart as LucideHeart,
  HelpCircle as LucideHelpCircle,
  Highlighter as LucideHighlighter,
  Home as LucideHome,
  Image as LucideImage,
  ImageIcon as LucideImageIcon,
  Inbox as LucideInbox,
  Info as LucideInfo,
  Italic as LucideItalic,
  Key as LucideKey,
  KeyRound as LucideKeyRound,
  Keyboard as LucideKeyboard,
  Languages as LucideLanguages,
  Layers as LucideLayers,
  LayoutDashboard as LucideLayoutDashboard,
  LayoutGrid as LucideLayoutGrid,
  LayoutList as LucideLayoutList,
  LayoutTemplate as LucideLayoutTemplate,
  Lightbulb as LucideLightbulb,
  Link as LucideLink,
  List as LucideList,
  ListOrdered as LucideListOrdered,
  ListTodo as LucideListTodo,
  Loader2 as LucideLoader2,
  Lock as LucideLock,
  LockKeyhole as LucideLockKeyhole,
  LockOpen as LucideLockOpen,
  LogIn as LucideLogIn,
  LogOut as LucideLogOut,
  Mail as LucideMail,
  MailCheck as LucideMailCheck,
  MailOpen as LucideMailOpen,
  MailX as LucideMailX,
  Mails as LucideMails,
  MapPin as LucideMapPin,
  Maximize2 as LucideMaximize2,
  Menu as LucideMenu,
  MessageSquare as LucideMessageSquare,
  MessagesSquare as LucideMessagesSquare,
  Milestone as LucideMilestone,
  Minimize2 as LucideMinimize2,
  Minus as LucideMinus,
  Monitor as LucideMonitor,
  Moon as LucideMoon,
  MoreHorizontal as LucideMoreHorizontal,
  MoreVertical as LucideMoreVertical,
  NotebookPen as LucideNotebookPen,
  Package as LucidePackage,
  PackageCheck as LucidePackageCheck,
  Palette as LucidePalette,
  Palmtree as LucidePalmtree,
  PalmtreeIcon as LucidePalmtreeIcon,
  PanelLeftClose as LucidePanelLeftClose,
  PanelRight as LucidePanelRight,
  PanelRightClose as LucidePanelRightClose,
  PanelRightOpen as LucidePanelRightOpen,
  Paperclip as LucidePaperclip,
  PenLine as LucidePenLine,
  PenSquare as LucidePenSquare,
  PenTool as LucidePenTool,
  Pencil as LucidePencil,
  Phone as LucidePhone,
  Pin as LucidePin,
  PinOff as LucidePinOff,
  Play as LucidePlay,
  PlayCircle as LucidePlayCircle,
  Plug as LucidePlug,
  Plus as LucidePlus,
  Power as LucidePower,
  PowerOff as LucidePowerOff,
  Presentation as LucidePresentation,
  Printer as LucidePrinter,
  Puzzle as LucidePuzzle,
  QrCode as LucideQrCode,
  Quote as LucideQuote,
  Redo as LucideRedo,
  RefreshCw as LucideRefreshCw,
  RemoveFormatting as LucideRemoveFormatting,
  Repeat as LucideRepeat,
  Reply as LucideReply,
  ReplyAll as LucideReplyAll,
  RotateCcw as LucideRotateCcw,
  RotateCw as LucideRotateCw,
  Rows3 as LucideRows3,
  Save as LucideSave,
  Scale as LucideScale,
  Scissors as LucideScissors,
  ScrollText as LucideScrollText,
  Search as LucideSearch,
  SearchX as LucideSearchX,
  Send as LucideSend,
  Server as LucideServer,
  Settings as LucideSettings,
  Share2 as LucideShare2,
  Shield as LucideShield,
  ShieldAlert as LucideShieldAlert,
  ShieldCheck as LucideShieldCheck,
  Shuffle as LucideShuffle,
  SlidersHorizontal as LucideSlidersHorizontal,
  Smartphone as LucideSmartphone,
  Sparkles as LucideSparkles,
  Square as LucideSquare,
  SquarePen as LucideSquarePen,
  Star as LucideStar,
  StarOff as LucideStarOff,
  StickyNote as LucideStickyNote,
  Store as LucideStore,
  Strikethrough as LucideStrikethrough,
  Sun as LucideSun,
  SwatchBook as LucideSwatchBook,
  Table as LucideTable,
  Tag as LucideTag,
  Tags as LucideTags,
  Terminal as LucideTerminal,
  Trash as LucideTrash,
  Trash2 as LucideTrash2,
  TriangleAlert as LucideTriangleAlert,
  Type as LucideType,
  Underline as LucideUnderline,
  Undo as LucideUndo,
  UnfoldVertical as LucideUnfoldVertical,
  Unlock as LucideUnlock,
  Upload as LucideUpload,
  User as LucideUser,
  UserCircle as LucideUserCircle,
  UserMinus as LucideUserMinus,
  UserPen as LucideUserPen,
  UserPlus as LucideUserPlus,
  Users as LucideUsers,
  UsersRound as LucideUsersRound,
  Video as LucideVideo,
  Volume2 as LucideVolume2,
  Wrench as LucideWrench,
  X as LucideX,
  XCircle as LucideXCircle,
  Zap as LucideZap,
  ZoomIn as LucideZoomIn,
  ZoomOut as LucideZoomOut,
} from 'lucide-react';

function createDynamicIcon(
  TablerComp: React.ComponentType<any>,
  LucideComp: React.ComponentType<any>,
  materialGlyph: string,
  displayName: string,
  isFilled = false
): TablerIcon {
  const DynamicIcon = forwardRef<SVGSVGElement, IconProps>(function DynamicIcon(props, ref) {
    const iconSet = useSettingsStore((s) => s.iconSet);
    const iconColorPalette = useSettingsStore((s) => s.iconColorPalette);
    const { inheritColor } = useIconContrast();
    const { size, stroke, strokeWidth, color, className, style, ...rest } = props;
    const effectiveColor = inheritColor
      ? undefined
      : getIconColor(displayName, iconColorPalette, color, className);
    const resolvedColor = effectiveColor || color;
    const styleWithColor = effectiveColor ? { color: effectiveColor, ...style } : style;

    if (iconSet === 'lucide') {
      const sw = strokeWidth ?? stroke ?? 2;
      return (
        <LucideComp
          ref={ref}
          size={size}
          strokeWidth={sw}
          color={resolvedColor}
          className={className}
          style={styleWithColor}
          {...(isFilled ? { fill: resolvedColor || 'currentColor' } : {})}
          {...rest}
        />
      );
    }

    if (iconSet === 'material-symbols') {
      const effectiveSize = size ?? 24;
      const w = strokeWidth ?? stroke;
      const wght = w ? Math.round(Math.min(700, Math.max(100, Number(w) * 200))) : 400;
      const fillVal = isFilled ? 1 : 0;
      const finalColor = resolvedColor || 'currentColor';
      return (
        <svg
          ref={ref}
          viewBox="0 0 24 24"
          width={effectiveSize}
          height={effectiveSize}
          fill={finalColor}
          className={cn('shrink-0 select-none inline-block align-middle fill-current', className)}
          style={{ fill: finalColor, ...styleWithColor }}
          aria-hidden="true"
          {...rest}
        >
          <text
            x="12"
            y="12"
            textAnchor="middle"
            dominantBaseline="central"
            className="material-symbols-outlined"
            fill={finalColor}
            style={{
              fontFamily: '"Material Symbols Outlined"',
              fontSize: 24,
              fontVariationSettings: `'FILL' ${fillVal}, 'wght' ${wght}, 'GRAD' 0, 'opsz' 24`,
              fontFeatureSettings: '"liga" 1',
              userSelect: 'none',
              fill: finalColor,
              ...(effectiveColor ? { color: effectiveColor } : {}),
            }}
          >
            {materialGlyph}
          </text>
        </svg>
      );
    }

    // Default: Tabler
    const tablerStroke = stroke ?? strokeWidth ?? 2;
    return (
      <TablerComp
        ref={ref}
        size={size}
        stroke={tablerStroke}
        color={resolvedColor}
        className={className}
        style={styleWithColor}
        {...rest}
      />
    );
  });

  DynamicIcon.displayName = displayName;
  return DynamicIcon as unknown as TablerIcon;
}

export const Activity = createDynamicIcon(IconActivity, LucideActivity, 'vital_signs', 'Activity', false);
export const AlertCircle = createDynamicIcon(IconAlertCircle, LucideAlertCircle, 'error', 'AlertCircle', false);
export const AlertTriangle = createDynamicIcon(IconAlertTriangle, LucideAlertTriangle, 'warning', 'AlertTriangle', false);
export const AlignCenter = createDynamicIcon(IconAlignCenter, LucideAlignCenter, 'format_align_center', 'AlignCenter', false);
export const AlignLeft = createDynamicIcon(IconAlignLeft, LucideAlignLeft, 'format_align_left', 'AlignLeft', false);
export const AlignRight = createDynamicIcon(IconAlignRight, LucideAlignRight, 'format_align_right', 'AlignRight', false);
export const Archive = createDynamicIcon(IconArchive, LucideArchive, 'archive', 'Archive', false);
export const ArrowDown = createDynamicIcon(IconArrowDown, LucideArrowDown, 'arrow_downward', 'ArrowDown', false);
export const ArrowDownAZ = createDynamicIcon(IconSortAZ, LucideArrowDownAZ, 'sort_by_alpha', 'ArrowDownAZ', false);
export const ArrowLeft = createDynamicIcon(IconArrowLeft, LucideArrowLeft, 'arrow_back', 'ArrowLeft', false);
export const ArrowLeftRight = createDynamicIcon(IconArrowLeftRight, LucideArrowLeftRight, 'swap_horiz', 'ArrowLeftRight', false);
export const ArrowRight = createDynamicIcon(IconArrowRight, LucideArrowRight, 'arrow_forward', 'ArrowRight', false);
export const ArrowUp = createDynamicIcon(IconArrowUp, LucideArrowUp, 'arrow_upward', 'ArrowUp', false);
export const ArrowUpCircle = createDynamicIcon(IconCircleArrowUp, LucideArrowUpCircle, 'arrow_circle_up', 'ArrowUpCircle', false);
export const ArrowUpDown = createDynamicIcon(IconArrowsSort, LucideArrowUpDown, 'swap_vert', 'ArrowUpDown', false);
export const Ban = createDynamicIcon(IconBan, LucideBan, 'block', 'Ban', false);
export const Baseline = createDynamicIcon(IconBaseline, LucideBaseline, 'format_color_text', 'Baseline', false);
export const Bell = createDynamicIcon(IconBell, LucideBell, 'notifications', 'Bell', false);
export const BellOff = createDynamicIcon(IconBellOff, LucideBellOff, 'notifications_off', 'BellOff', false);
export const Bold = createDynamicIcon(IconBold, LucideBold, 'format_bold', 'Bold', false);
export const Book = createDynamicIcon(IconBook2, LucideBook, 'menu_book', 'Book', false);
export const BookOpen = createDynamicIcon(IconBook, LucideBookOpen, 'auto_stories', 'BookOpen', false);
export const BookPlus = createDynamicIcon(IconBook2, LucideBookPlus, 'library_add', 'BookPlus', false);
export const BookUser = createDynamicIcon(IconAddressBook, LucideBookUser, 'contact_page', 'BookUser', false);
export const Bookmark = createDynamicIcon(IconBookmark, LucideBookmark, 'bookmark', 'Bookmark', false);
export const BookmarkPlus = createDynamicIcon(IconBookmarkPlus, LucideBookmarkPlus, 'bookmark_add', 'BookmarkPlus', false);
export const Box = createDynamicIcon(IconBox, LucideBox, 'package_2', 'Box', false);
export const Brain = createDynamicIcon(IconBrain, LucideBrain, 'psychology', 'Brain', false);
export const Briefcase = createDynamicIcon(IconBriefcase, LucideBriefcase, 'work', 'Briefcase', false);
export const Bug = createDynamicIcon(IconBug, LucideBug, 'bug_report', 'Bug', false);
export const Building = createDynamicIcon(IconBuilding, LucideBuilding, 'apartment', 'Building', false);
export const Building2 = createDynamicIcon(IconBuilding, LucideBuilding2, 'domain', 'Building2', false);
export const Cake = createDynamicIcon(IconCake, LucideCake, 'cake', 'Cake', false);
export const Calendar = createDynamicIcon(IconCalendar, LucideCalendar, 'calendar_today', 'Calendar', false);
export const CalendarArrowUp = createDynamicIcon(IconCalendarUp, LucideCalendarArrowUp, 'event_upcoming', 'CalendarArrowUp', false);
export const CalendarCheck = createDynamicIcon(IconCalendarCheck, LucideCalendarCheck, 'event_available', 'CalendarCheck', false);
export const CalendarClock = createDynamicIcon(IconCalendarClock, LucideCalendarClock, 'pending_actions', 'CalendarClock', false);
export const CalendarDays = createDynamicIcon(IconCalendarMonth, LucideCalendarDays, 'calendar_month', 'CalendarDays', false);
export const CalendarX = createDynamicIcon(IconCalendarX, LucideCalendarX, 'event_busy', 'CalendarX', false);
export const Camera = createDynamicIcon(IconCamera, LucideCamera, 'photo_camera', 'Camera', false);
export const Check = createDynamicIcon(IconCheck, LucideCheck, 'check', 'Check', false);
export const CheckCheck = createDynamicIcon(IconChecks, LucideCheckCheck, 'done_all', 'CheckCheck', false);
export const CheckCircle = createDynamicIcon(IconCircleCheck, LucideCheckCircle, 'check_circle', 'CheckCircle', false);
export const CheckCircle2 = createDynamicIcon(IconCircleCheck, LucideCheckCircle2, 'check_circle', 'CheckCircle2', false);
export const CheckSquare = createDynamicIcon(IconSquareCheck, LucideCheckSquare, 'check_box', 'CheckSquare', false);
export const ChevronDown = createDynamicIcon(IconChevronDown, LucideChevronDown, 'keyboard_arrow_down', 'ChevronDown', false);
export const ChevronLeft = createDynamicIcon(IconChevronLeft, LucideChevronLeft, 'keyboard_arrow_left', 'ChevronLeft', false);
export const ChevronRight = createDynamicIcon(IconChevronRight, LucideChevronRight, 'keyboard_arrow_right', 'ChevronRight', false);
export const ChevronUp = createDynamicIcon(IconChevronUp, LucideChevronUp, 'keyboard_arrow_up', 'ChevronUp', false);
export const ChevronsLeft = createDynamicIcon(IconChevronsLeft, LucideChevronsLeft, 'keyboard_double_arrow_left', 'ChevronsLeft', false);
export const ChevronsRight = createDynamicIcon(IconChevronsRight, LucideChevronsRight, 'keyboard_double_arrow_right', 'ChevronsRight', false);
export const Circle = createDynamicIcon(IconCircle, LucideCircle, 'circle', 'Circle', false);
export const Clipboard = createDynamicIcon(IconClipboard, LucideClipboard, 'content_paste', 'Clipboard', false);
export const ClipboardCopy = createDynamicIcon(IconClipboardCopy, LucideClipboardCopy, 'content_copy', 'ClipboardCopy', false);
export const Clock = createDynamicIcon(IconClock, LucideClock, 'schedule', 'Clock', false);
export const Clock3 = createDynamicIcon(IconClockHour3, LucideClock3, 'schedule', 'Clock3', false);
export const Cloud = createDynamicIcon(IconCloud, LucideCloud, 'cloud', 'Cloud', false);
export const Code = createDynamicIcon(IconCode, LucideCode, 'code', 'Code', false);
export const Columns3 = createDynamicIcon(IconColumns3, LucideColumns3, 'view_column', 'Columns3', false);
export const Copy = createDynamicIcon(IconCopy, LucideCopy, 'content_copy', 'Copy', false);
export const CopyPlus = createDynamicIcon(IconCopyPlus, LucideCopyPlus, 'post_add', 'CopyPlus', false);
export const CornerDownLeft = createDynamicIcon(IconCornerDownLeft, LucideCornerDownLeft, 'keyboard_return', 'CornerDownLeft', false);
export const Database = createDynamicIcon(IconDatabase, LucideDatabase, 'database', 'Database', false);
export const Download = createDynamicIcon(IconDownload, LucideDownload, 'download', 'Download', false);
export const EditIcon = createDynamicIcon(IconEdit, LucideEditIcon, 'edit', 'EditIcon', false);
export const Ellipsis = createDynamicIcon(IconDots, LucideEllipsis, 'more_horiz', 'Ellipsis', false);
export const Eraser = createDynamicIcon(IconEraser, LucideEraser, 'ink_eraser', 'Eraser', false);
export const ExternalLink = createDynamicIcon(IconExternalLink, LucideExternalLink, 'open_in_new', 'ExternalLink', false);
export const Eye = createDynamicIcon(IconEye, LucideEye, 'visibility', 'Eye', false);
export const EyeOff = createDynamicIcon(IconEyeOff, LucideEyeOff, 'visibility_off', 'EyeOff', false);
export const File = createDynamicIcon(IconFile, LucideFile, 'description', 'File', false);
export const FileArchive = createDynamicIcon(IconFileZip, LucideFileArchive, 'folder_zip', 'FileArchive', false);
export const FileAudio = createDynamicIcon(IconFileMusic, LucideFileAudio, 'audio_file', 'FileAudio', false);
export const FileCode = createDynamicIcon(IconFileCode, LucideFileCode, 'code_blocks', 'FileCode', false);
export const FileImage = createDynamicIcon(IconPhoto, LucideFileImage, 'image', 'FileImage', false);
export const FilePlus = createDynamicIcon(IconFilePlus, LucideFilePlus, 'note_add', 'FilePlus', false);
export const FileSpreadsheet = createDynamicIcon(IconFileSpreadsheet, LucideFileSpreadsheet, 'table_view', 'FileSpreadsheet', false);
export const FileText = createDynamicIcon(IconFileText, LucideFileText, 'article', 'FileText', false);
export const FileVideo = createDynamicIcon(IconVideo, LucideFileVideo, 'video_file', 'FileVideo', false);
export const Files = createDynamicIcon(IconFiles, LucideFiles, 'file_copy', 'Files', false);
export const Filter = createDynamicIcon(IconFilter, LucideFilter, 'filter_alt', 'Filter', false);
export const Flag = createDynamicIcon(IconFlag, LucideFlag, 'flag', 'Flag', false);
export const FlaskConical = createDynamicIcon(IconFlask, LucideFlaskConical, 'science', 'FlaskConical', false);
export const FoldVertical = createDynamicIcon(IconFold, LucideFoldVertical, 'unfold_less', 'FoldVertical', false);
export const Folder = createDynamicIcon(IconFolder, LucideFolder, 'folder', 'Folder', false);
export const FolderInput = createDynamicIcon(IconFolderDown, LucideFolderInput, 'drive_file_move', 'FolderInput', false);
export const FolderOpen = createDynamicIcon(IconFolderOpen, LucideFolderOpen, 'folder_open', 'FolderOpen', false);
export const FolderPlus = createDynamicIcon(IconFolderPlus, LucideFolderPlus, 'create_new_folder', 'FolderPlus', false);
export const FolderSearch = createDynamicIcon(IconFolderSearch, LucideFolderSearch, 'folder_shared', 'FolderSearch', false);
export const FolderSync = createDynamicIcon(IconFolders, LucideFolderSync, 'folder_managed', 'FolderSync', false);
export const FolderUp = createDynamicIcon(IconFolderUp, LucideFolderUp, 'drive_folder_upload', 'FolderUp', false);
export const FolderX = createDynamicIcon(IconFolderX, LucideFolderX, 'folder_delete', 'FolderX', false);
export const Forward = createDynamicIcon(IconArrowForwardUp, LucideForward, 'forward', 'Forward', false);
export const Globe = createDynamicIcon(IconWorld, LucideGlobe, 'language', 'Globe', false);
export const Grid3x3 = createDynamicIcon(IconGridDots, LucideGrid3x3, 'apps', 'Grid3x3', false);
export const GripVertical = createDynamicIcon(IconGripVertical, LucideGripVertical, 'drag_indicator', 'GripVertical', false);
export const HardDrive = createDynamicIcon(IconServer2, LucideHardDrive, 'hard_drive', 'HardDrive', false);
export const Heading1 = createDynamicIcon(IconH1, LucideHeading1, 'format_h1', 'Heading1', false);
export const Heading2 = createDynamicIcon(IconH2, LucideHeading2, 'format_h2', 'Heading2', false);
export const Heart = createDynamicIcon(IconHeart, LucideHeart, 'favorite', 'Heart', false);
export const HelpCircle = createDynamicIcon(IconHelpCircle, LucideHelpCircle, 'help', 'HelpCircle', false);
export const Highlighter = createDynamicIcon(IconHighlight, LucideHighlighter, 'ink_highlighter', 'Highlighter', false);
export const Home = createDynamicIcon(IconHome, LucideHome, 'home', 'Home', false);
export const Image = createDynamicIcon(IconPhoto, LucideImage, 'image', 'Image', false);
export const ImageIcon = createDynamicIcon(IconPhoto, LucideImageIcon, 'image', 'ImageIcon', false);
export const Inbox = createDynamicIcon(IconInbox, LucideInbox, 'inbox', 'Inbox', false);
export const Info = createDynamicIcon(IconInfoCircle, LucideInfo, 'info', 'Info', false);
export const Italic = createDynamicIcon(IconItalic, LucideItalic, 'format_italic', 'Italic', false);
export const Key = createDynamicIcon(IconKey, LucideKey, 'key', 'Key', false);
export const KeyRound = createDynamicIcon(IconKey, LucideKeyRound, 'key', 'KeyRound', false);
export const Keyboard = createDynamicIcon(IconKeyboard, LucideKeyboard, 'keyboard', 'Keyboard', false);
export const Languages = createDynamicIcon(IconLanguage, LucideLanguages, 'translate', 'Languages', false);
export const Layers = createDynamicIcon(IconStack, LucideLayers, 'layers', 'Layers', false);
export const LayoutDashboard = createDynamicIcon(IconLayoutDashboard, LucideLayoutDashboard, 'dashboard', 'LayoutDashboard', false);
export const LayoutGrid = createDynamicIcon(IconLayoutGrid, LucideLayoutGrid, 'grid_view', 'LayoutGrid', false);
export const LayoutList = createDynamicIcon(IconLayoutList, LucideLayoutList, 'view_list', 'LayoutList', false);
export const LayoutTemplate = createDynamicIcon(IconTemplate, LucideLayoutTemplate, 'dashboard_customize', 'LayoutTemplate', false);
export const Lightbulb = createDynamicIcon(IconBulb, LucideLightbulb, 'lightbulb', 'Lightbulb', false);
export const Link = createDynamicIcon(IconLink, LucideLink, 'link', 'Link', false);
export const List = createDynamicIcon(IconList, LucideList, 'list', 'List', false);
export const ListOrdered = createDynamicIcon(IconListNumbers, LucideListOrdered, 'format_list_numbered', 'ListOrdered', false);
export const ListTodo = createDynamicIcon(IconChecklist, LucideListTodo, 'checklist', 'ListTodo', false);
export const Loader2 = createDynamicIcon(IconLoader2, LucideLoader2, 'progress_activity', 'Loader2', false);
export const Lock = createDynamicIcon(IconLock, LucideLock, 'lock', 'Lock', false);
export const LockKeyhole = createDynamicIcon(IconLock, LucideLockKeyhole, 'lock', 'LockKeyhole', false);
export const LockOpen = createDynamicIcon(IconLockOpen, LucideLockOpen, 'lock_open', 'LockOpen', false);
export const LogIn = createDynamicIcon(IconLogin, LucideLogIn, 'login', 'LogIn', false);
export const LogOut = createDynamicIcon(IconLogout, LucideLogOut, 'logout', 'LogOut', false);
export const Mail = createDynamicIcon(IconMail, LucideMail, 'mail', 'Mail', false);
export const MailCheck = createDynamicIcon(IconMailCheck, LucideMailCheck, 'mark_email_read', 'MailCheck', false);
export const MailOpen = createDynamicIcon(IconMailOpened, LucideMailOpen, 'drafts', 'MailOpen', false);
export const MailX = createDynamicIcon(IconMailX, LucideMailX, 'unsubscribe', 'MailX', false);
export const Mails = createDynamicIcon(IconInbox, LucideMails, 'all_inbox', 'Mails', false);
export const MapPin = createDynamicIcon(IconMapPin, LucideMapPin, 'location_on', 'MapPin', false);
export const Maximize2 = createDynamicIcon(IconMaximize, LucideMaximize2, 'fullscreen', 'Maximize2', false);
export const Menu = createDynamicIcon(IconMenu2, LucideMenu, 'menu', 'Menu', false);
export const MessageSquare = createDynamicIcon(IconMessage, LucideMessageSquare, 'chat_bubble', 'MessageSquare', false);
export const MessagesSquare = createDynamicIcon(IconMessages, LucideMessagesSquare, 'forum', 'MessagesSquare', false);
export const Minimize2 = createDynamicIcon(IconMinimize, LucideMinimize2, 'fullscreen_exit', 'Minimize2', false);
export const Minus = createDynamicIcon(IconMinus, LucideMinus, 'remove', 'Minus', false);
export const Monitor = createDynamicIcon(IconDeviceDesktop, LucideMonitor, 'desktop_windows', 'Monitor', false);
export const Moon = createDynamicIcon(IconMoon, LucideMoon, 'dark_mode', 'Moon', false);
export const MoreHorizontal = createDynamicIcon(IconDots, LucideMoreHorizontal, 'more_horiz', 'MoreHorizontal', false);
export const MoreVertical = createDynamicIcon(IconDotsVertical, LucideMoreVertical, 'more_vert', 'MoreVertical', false);
export const NotebookPen = createDynamicIcon(IconNotebook, LucideNotebookPen, 'note_alt', 'NotebookPen', false);
export const Package = createDynamicIcon(IconPackage, LucidePackage, 'package_2', 'Package', false);
export const PackageCheck = createDynamicIcon(IconPackage, LucidePackageCheck, 'inventory_2', 'PackageCheck', false);
export const Palette = createDynamicIcon(IconPalette, LucidePalette, 'palette', 'Palette', false);
export const Palmtree = createDynamicIcon(IconBeach, LucidePalmtree, 'nature', 'Palmtree', false);
export const PalmtreeIcon = createDynamicIcon(IconBeach, LucidePalmtreeIcon, 'nature', 'PalmtreeIcon', false);
export const PanelLeftClose = createDynamicIcon(IconLayoutSidebarLeftCollapse, LucidePanelLeftClose, 'left_panel_close', 'PanelLeftClose', false);
export const PanelRight = createDynamicIcon(IconLayoutSidebarRight, LucidePanelRight, 'dock_to_left', 'PanelRight', false);
export const PanelRightClose = createDynamicIcon(IconLayoutSidebarRightCollapse, LucidePanelRightClose, 'right_panel_close', 'PanelRightClose', false);
export const PanelRightOpen = createDynamicIcon(IconLayoutSidebarRightExpand, LucidePanelRightOpen, 'right_panel_open', 'PanelRightOpen', false);
export const Paperclip = createDynamicIcon(IconPaperclip, LucidePaperclip, 'attach_file', 'Paperclip', false);
export const PenLine = createDynamicIcon(IconPencil, LucidePenLine, 'edit_note', 'PenLine', false);
export const PenSquare = createDynamicIcon(IconEdit, LucidePenSquare, 'edit_square', 'PenSquare', false);
export const PenTool = createDynamicIcon(IconVector, LucidePenTool, 'stylus', 'PenTool', false);
export const Pencil = createDynamicIcon(IconPencil, LucidePencil, 'edit', 'Pencil', false);
export const Phone = createDynamicIcon(IconPhone, LucidePhone, 'call', 'Phone', false);
export const Pin = createDynamicIcon(IconPinned, LucidePin, 'pin', 'Pin', false);
export const PinOff = createDynamicIcon(IconPinnedOff, LucidePinOff, 'keep_off', 'PinOff', false);
export const Play = createDynamicIcon(IconPlayerPlay, LucidePlay, 'play_arrow', 'Play', false);
export const PlayCircle = createDynamicIcon(IconPlayerPlay, LucidePlayCircle, 'play_circle', 'PlayCircle', false);
export const Plus = createDynamicIcon(IconPlus, LucidePlus, 'add', 'Plus', false);
export const Power = createDynamicIcon(IconPower, LucidePower, 'power_settings_new', 'Power', false);
export const PowerOff = createDynamicIcon(IconPower, LucidePowerOff, 'power_off', 'PowerOff', false);
export const Presentation = createDynamicIcon(IconPresentation, LucidePresentation, 'present_to_all', 'Presentation', false);
export const Printer = createDynamicIcon(IconPrinter, LucidePrinter, 'print', 'Printer', false);
export const Puzzle = createDynamicIcon(IconPuzzle, LucidePuzzle, 'extension', 'Puzzle', false);
export const QrCode = createDynamicIcon(IconQrcode, LucideQrCode, 'qr_code', 'QrCode', false);
export const Quote = createDynamicIcon(IconQuote, LucideQuote, 'format_quote', 'Quote', false);
export const Redo = createDynamicIcon(IconArrowForward, LucideRedo, 'redo', 'Redo', false);
export const RefreshCw = createDynamicIcon(IconRefresh, LucideRefreshCw, 'refresh', 'RefreshCw', false);
export const RemoveFormatting = createDynamicIcon(IconClearFormatting, LucideRemoveFormatting, 'format_clear', 'RemoveFormatting', false);
export const Repeat = createDynamicIcon(IconRepeat, LucideRepeat, 'repeat', 'Repeat', false);
export const Reply = createDynamicIcon(IconArrowBackUp, LucideReply, 'reply', 'Reply', false);
export const ReplyAll = createDynamicIcon(IconArrowBackUpDouble, LucideReplyAll, 'reply_all', 'ReplyAll', false);
export const RotateCcw = createDynamicIcon(IconRotate, LucideRotateCcw, 'undo', 'RotateCcw', false);
export const RotateCw = createDynamicIcon(IconRotateClockwise, LucideRotateCw, 'redo', 'RotateCw', false);
export const Rows3 = createDynamicIcon(IconLayoutRows, LucideRows3, 'table_rows', 'Rows3', false);
export const Save = createDynamicIcon(IconDeviceFloppy, LucideSave, 'save', 'Save', false);
export const Scale = createDynamicIcon(IconScale, LucideScale, 'scale', 'Scale', false);
export const Scissors = createDynamicIcon(IconScissors, LucideScissors, 'content_cut', 'Scissors', false);
export const ScrollText = createDynamicIcon(IconFileText, LucideScrollText, 'history_edu', 'ScrollText', false);
export const Search = createDynamicIcon(IconSearch, LucideSearch, 'search', 'Search', false);
export const SearchX = createDynamicIcon(IconSearchOff, LucideSearchX, 'search_off', 'SearchX', false);
export const Send = createDynamicIcon(IconSend, LucideSend, 'send', 'Send', false);
export const Server = createDynamicIcon(IconServer, LucideServer, 'dns', 'Server', false);
export const Settings = createDynamicIcon(IconSettings, LucideSettings, 'settings', 'Settings', false);
export const Share2 = createDynamicIcon(IconShare2, LucideShare2, 'share', 'Share2', false);
export const Shield = createDynamicIcon(IconShield, LucideShield, 'shield', 'Shield', false);
export const ShieldAlert = createDynamicIcon(IconShieldExclamation, LucideShieldAlert, 'gpp_maybe', 'ShieldAlert', false);
export const ShieldCheck = createDynamicIcon(IconShieldCheck, LucideShieldCheck, 'verified_user', 'ShieldCheck', false);
export const ShieldFilled = createDynamicIcon(IconShieldFilled, LucideShield, 'shield', 'ShieldFilled', true);
export const Shuffle = createDynamicIcon(IconArrowsShuffle, LucideShuffle, 'shuffle', 'Shuffle', false);
export const SlidersHorizontal = createDynamicIcon(IconAdjustmentsHorizontal, LucideSlidersHorizontal, 'tune', 'SlidersHorizontal', false);
export const Smartphone = createDynamicIcon(IconDeviceMobile, LucideSmartphone, 'mobile', 'Smartphone', false);
export const Sparkles = createDynamicIcon(IconSparkles, LucideSparkles, 'star_shine', 'Sparkles', false);
export const Square = createDynamicIcon(IconSquare, LucideSquare, 'crop_square', 'Square', false);
export const SquarePen = createDynamicIcon(IconEdit, LucideSquarePen, 'edit_square', 'SquarePen', false);
export const Star = createDynamicIcon(IconStar, LucideStar, 'star', 'Star', false);
export const StarOff = createDynamicIcon(IconStarOff, LucideStarOff, 'star_rate', 'StarOff', false);
export const StickyNote = createDynamicIcon(IconNote, LucideStickyNote, 'sticky_note_2', 'StickyNote', false);
export const Store = createDynamicIcon(IconBuildingStore, LucideStore, 'storefront', 'Store', false);
export const Strikethrough = createDynamicIcon(IconStrikethrough, LucideStrikethrough, 'format_strikethrough', 'Strikethrough', false);
export const Sun = createDynamicIcon(IconSun, LucideSun, 'light_mode', 'Sun', false);
export const SwatchBook = createDynamicIcon(IconColorSwatch, LucideSwatchBook, 'palette', 'SwatchBook', false);
export const Table = createDynamicIcon(IconTable, LucideTable, 'table_chart', 'Table', false);
export const Tag = createDynamicIcon(IconTag, LucideTag, 'label', 'Tag', false);
export const Tags = createDynamicIcon(IconTags, LucideTags, 'style', 'Tags', false);
export const Terminal = createDynamicIcon(IconTerminal, LucideTerminal, 'terminal', 'Terminal', false);
export const Wrench = createDynamicIcon(IconTool, LucideWrench, 'build', 'Wrench', false);
export const Plug = createDynamicIcon(IconPlug, LucidePlug, 'power', 'Plug', false);
export const GitFork = createDynamicIcon(IconGitFork, LucideGitFork, 'fork_right', 'GitFork', false);
export const Trash = createDynamicIcon(IconTrash, LucideTrash, 'delete', 'Trash', false);
export const Trash2 = createDynamicIcon(IconTrash, LucideTrash2, 'delete', 'Trash2', false);
export const TriangleAlert = createDynamicIcon(IconAlertTriangle, LucideTriangleAlert, 'warning', 'TriangleAlert', false);
export const Type = createDynamicIcon(IconTypography, LucideType, 'text_fields', 'Type', false);
export const Underline = createDynamicIcon(IconUnderline, LucideUnderline, 'format_underlined', 'Underline', false);
export const Undo = createDynamicIcon(IconArrowBack, LucideUndo, 'undo', 'Undo', false);
export const UnfoldVertical = createDynamicIcon(IconArrowsVertical, LucideUnfoldVertical, 'unfold_more', 'UnfoldVertical', false);
export const Unlock = createDynamicIcon(IconLockOpen, LucideUnlock, 'lock_open', 'Unlock', false);
export const Upload = createDynamicIcon(IconUpload, LucideUpload, 'upload', 'Upload', false);
export const User = createDynamicIcon(IconUser, LucideUser, 'person', 'User', false);
export const UserCircle = createDynamicIcon(IconUserCircle, LucideUserCircle, 'account_circle', 'UserCircle', false);
export const UserMinus = createDynamicIcon(IconUserMinus, LucideUserMinus, 'person_remove', 'UserMinus', false);
export const UserPen = createDynamicIcon(IconUserEdit, LucideUserPen, 'person_edit', 'UserPen', false);
export const UserPlus = createDynamicIcon(IconUserPlus, LucideUserPlus, 'person_add', 'UserPlus', false);
export const Users = createDynamicIcon(IconUsers, LucideUsers, 'group', 'Users', false);
export const UsersRound = createDynamicIcon(IconUsers, LucideUsersRound, 'groups', 'UsersRound', false);
export const Video = createDynamicIcon(IconVideo, LucideVideo, 'videocam', 'Video', false);
export const Volume2 = createDynamicIcon(IconVolume2, LucideVolume2, 'volume_up', 'Volume2', false);
export const X = createDynamicIcon(IconX, LucideX, 'close', 'X', false);
export const XCircle = createDynamicIcon(IconCircleX, LucideXCircle, 'cancel', 'XCircle', false);
export const Zap = createDynamicIcon(IconBolt, LucideZap, 'bolt', 'Zap', false);
export const ZoomIn = createDynamicIcon(IconZoomIn, LucideZoomIn, 'zoom_in', 'ZoomIn', false);
export const ZoomOut = createDynamicIcon(IconZoomOut, LucideZoomOut, 'zoom_out', 'ZoomOut', false);
export const LabelImportant = createDynamicIcon(IconLabelImportant, LucideMilestone, 'label_important', 'LabelImportant', false);
export const DoubleExclamation = LabelImportant;
