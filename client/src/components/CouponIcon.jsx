// Raster coupon icons (PNG, 256×256 with transparency, hosted in
// client/public/coupons/). Replaces the line-art SVG IconCouponX
// glyphs that were previously rendered both in the inventory grid
// and in the SilverVault buy cards. Same component drives both
// surfaces so the visual identity stays consistent.

const COUPON_SRC = {
  freeze: "/coupons/streak-freeze-coupon-2x.png",
  reroll: "/coupons/reroll-coupon-2x.png",
  pinned_reroll: "/coupons/change-habits-coupon-2x.png",
  xp_boost: "/coupons/xp-boost-coupon-2x.png",
  city_reset: "/coupons/reset-city-coupon-2x.png"
};

export default function CouponIcon({ type, size = 36, alt = "", style, ...rest }) {
  const src = COUPON_SRC[type];
  if (!src) return null;
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      draggable={false}
      style={{
        display: "inline-block",
        width: size,
        height: size,
        objectFit: "contain",
        userSelect: "none",
        ...style
      }}
      {...rest}
    />
  );
}

export { COUPON_SRC };
