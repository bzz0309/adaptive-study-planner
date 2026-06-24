import type { ReactNode, SyntheticEvent } from "react";

export type RewardVideoSources = {
  desktop?: string;
  mobile?: string;
};

type RewardVideoLayerProps = {
  active: boolean;
  className?: string;
  fallback?: ReactNode;
  label: string;
  reduceMotion?: boolean;
  sources: RewardVideoSources;
  onEnded?: () => void;
  onError?: (event: SyntheticEvent<HTMLVideoElement, Event>) => void;
  onLoadedData?: () => void;
};

export function RewardVideoLayer({
  active,
  className,
  fallback,
  label,
  reduceMotion,
  sources,
  onEnded,
  onError,
  onLoadedData,
}: RewardVideoLayerProps) {
  const hasVideo = Boolean(sources.desktop || sources.mobile);

  return (
    <div className={className} aria-label={label} aria-hidden="true">
      {hasVideo && !reduceMotion ? (
        <video
          key={`${sources.desktop ?? ""}-${sources.mobile ?? ""}-${active ? "active" : "idle"}`}
          className="reward-video"
          autoPlay={active}
          muted
          playsInline
          preload="auto"
          onEnded={onEnded}
          onError={onError}
          onLoadedData={onLoadedData}
        >
          {sources.mobile ? <source src={sources.mobile} media="(max-width: 760px), (orientation: portrait)" type="video/mp4" /> : null}
          {sources.desktop ? <source src={sources.desktop} type="video/mp4" /> : null}
        </video>
      ) : null}
      {!hasVideo || reduceMotion ? fallback : null}
    </div>
  );
}
