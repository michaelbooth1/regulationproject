import type { CSSProperties } from "react";
import { HOST_PROFILES, type HostId } from "./quiz-data";


type HostBadgeProps = {
  host: HostId;
};

/** Shared host label used by the game, results, and spoiler-filled quote bank. */
export function HostBadge({ host }: HostBadgeProps) {
  const profile = HOST_PROFILES[host];

  return (
    <span
      className="wsi-host-badge"
      style={{ "--host-color": profile.color } as CSSProperties}
    >
      <b>{profile.name.slice(0, 1)}</b>
      {profile.name}
    </span>
  );
}
