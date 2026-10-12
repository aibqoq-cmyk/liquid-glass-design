/**
 * 没有上传头像时的默认头像：手绘小狗 / 兔子。有真头像就用 <img>，这里只是兜底。
 */

export function DogFace({ glasses = false, size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 70 70" fill="none" stroke="#8a6a6e" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 22c-7 2-10 12-6 20 2 4 6 3 7-1" />
      <path d="M51 22c7 2 10 12 6 20-2 4-6 3-7-1" />
      <path d="M20 30c0-9 7-15 15-15s15 6 15 15v8c0 9-7 15-15 15s-15-6-15-15z" fill="#ffffff" />
      {glasses ? (
        <>
          <circle cx="28" cy="35" r="5" /><circle cx="42" cy="35" r="5" /><path d="M33 35h4" />
        </>
      ) : (
        <>
          <circle cx="28" cy="34" r="2.4" fill="#5e4448" stroke="none" />
          <circle cx="42" cy="34" r="2.4" fill="#5e4448" stroke="none" />
          <path d="M32 41.5c1.5 1.4 4.5 1.4 6 0" />
        </>
      )}
      <ellipse cx="22.5" cy="40" rx="3.5" ry="2.2" fill="#ffc7d4" stroke="none" />
      <ellipse cx="47.5" cy="40" rx="3.5" ry="2.2" fill="#ffc7d4" stroke="none" />
    </svg>
  );
}

export function BunnyFace({ size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 70 70" fill="none" stroke="#7a7290" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M26 25c-2-8-1-16 3-17s5 8 5 16" />
      <path d="M44 25c2-8 1-16-3-17s-5 8-5 16" />
      <path d="M18 40c0-10 8-16 17-16s17 6 17 16-8 15-17 15-17-5-17-15z" fill="#ffffff" />
      <circle cx="28.5" cy="39" r="2.4" fill="#5e4448" stroke="none" />
      <circle cx="41.5" cy="39" r="2.4" fill="#5e4448" stroke="none" />
      <path d="M33 45l2 1.6 2-1.6" />
      <ellipse cx="23.5" cy="45" rx="3.4" ry="2.1" fill="#ffc7d4" stroke="none" />
      <ellipse cx="46.5" cy="45" rx="3.4" ry="2.1" fill="#ffc7d4" stroke="none" />
    </svg>
  );
}

/**
 * 圆头像：有 src 用图，没有就画默认脸。
 * @param {'dog'|'dog-glasses'|'bunny'} fallback
 */
export function FaceAvatar({ src, alt = '', size = 52, fallback = 'dog', bg = '#fff0f3', ring = 3, className = '' }) {
  const style = {
    width: size, height: size, borderRadius: '50%', flex: 'none',
    display: 'grid', placeItems: 'center', overflow: 'hidden', background: bg,
    boxShadow: `0 0 0 ${ring}px #fff, 0 10px 22px -12px rgba(150,100,110,.55)`,
  };
  if (src) return <img className={className} src={src} alt={alt} style={{ ...style, objectFit: 'cover' }} />;
  const inner = Math.round(size * 0.72);
  return (
    <span className={className} style={style} role={alt ? 'img' : undefined} aria-label={alt || undefined}>
      {fallback === 'bunny' ? <BunnyFace size={inner} /> : <DogFace size={inner} glasses={fallback === 'dog-glasses'} />}
    </span>
  );
}
