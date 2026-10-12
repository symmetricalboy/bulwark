import { Video, GoogleMeetIcon, TeamsIcon, ZoomIcon, JitsiIcon, NextcloudIcon } from "@/components/icons";
import type { VideoMeetingProviderId } from "@/lib/video-meetings";

export function MeetingProviderIcon({
  providerId,
  className,
}: {
  providerId: VideoMeetingProviderId;
  className?: string;
}) {
  switch (providerId) {
    case "google-meet":
      return <GoogleMeetIcon className={className} />;
    case "teams":
      return <TeamsIcon className={className} />;
    case "zoom":
      return <ZoomIcon className={className} />;
    case "jitsi":
      return <JitsiIcon className={className} />;
    case "nextcloud":
      return <NextcloudIcon className={className} />;
    default:
      return <Video className={className} />;
  }
}
