'use client';

interface YouTubePlayerProps {
  videoId: string;
}

export default function YouTubePlayer({ videoId }: YouTubePlayerProps) {
  const src = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0&modestbranding=1&color=white`;

  return (
    <div className="yt-player-wrap">
      <iframe
        src={src}
        title="Exercise tutorial"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    </div>
  );
}
