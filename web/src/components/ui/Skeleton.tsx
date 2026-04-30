import React from 'react';

type SkeletonProps = {
  width?: string;
  height?: string;
  borderRadius?: string;
};

export function Skeleton({ width = '100%', height = '20px', borderRadius }: SkeletonProps) {
  return (
    <div
      className="skeleton"
      style={{
        width,
        height,
        borderRadius: borderRadius || 'var(--radius-sm)'
      }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="skeletonCard">
      <Skeleton width="60%" height="16px" />
      <Skeleton width="40%" height="14px" />
      <Skeleton width="80%" height="12px" />
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
