// Raster coupon icons (PNG, 256×256 with transparency, hosted in
// client/public/coupons/). Replaces the line-art SVG IconCouponX
// glyphs that were previously rendered both in the inventory grid
// and in the SilverVault buy cards. Same component drives both
// surfaces so the visual identity stays consistent.

// Cache-bust query param. Bump when the coupon PNG art is replaced —
// the file paths are stable (Vite serves /public/* with long-lived
// cache headers in prod), so a new ?v= forces every browser to
// fetch the fresh art instead of showing the previous version.
const COUPON_ART_VERSION = "2";
const COUPON_SRC = {
  freeze: `/coupons/streak-freeze-coupon-2x.png?v=${COUPON_ART_VERSION}`,
  reroll: `/coupons/reroll-coupon-2x.png?v=${COUPON_ART_VERSION}`,
  pinned_reroll: `/coupons/change-habits-coupon-2x.png?v=${COUPON_ART_VERSION}`,
  xp_boost: `/coupons/xp-boost-coupon-2x.png?v=${COUPON_ART_VERSION}`,
  city_reset: `/coupons/reset-city-coupon-2x.png?v=${COUPON_ART_VERSION}`
};

export default function CouponIcon({ type, size = 36, fill = false, alt = "", style, ...rest }) {
  const src = COUPON_SRC[type];
  if (!src) return null;
  // `fill` mode lets the parent flex/grid cell decide the size — used
  // by the inventory bag slots so the raster art reaches edge-to-edge
  // regardless of screen width.
  if (fill) {
    return (
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          userSelect: "none",
          ...style
        }}
        {...rest}
      />
    );
  }
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
