export default function PortalPreloader({ title = "", caption = "", fullscreen = false }) {
  return (
    <div
      className={[
        "portal-preloader-shell",
        fullscreen ? "portal-preloader-shell--fullscreen" : ""
      ].filter(Boolean).join(" ")}
    >
      <div className="portal-preloader" aria-live="polite" aria-busy="true">
        <div className="portal-preloader__scene">
          <div className="portal-preloader__aurora portal-preloader__aurora--left" />
          <div className="portal-preloader__aurora portal-preloader__aurora--right" />
          <div className="portal-preloader__stars" />
          <div className="portal-preloader__cityline">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
          <div className="portal-preloader__platform" />
          <div className="portal-preloader__beam" />
          <div className="portal-preloader__ring portal-preloader__ring--outer" />
          <div className="portal-preloader__ring portal-preloader__ring--middle" />
          <div className="portal-preloader__ring portal-preloader__ring--inner" />
          <div className="portal-preloader__core">
            <div className="portal-preloader__core-glow" />
            <div className="portal-preloader__sigil" />
          </div>
          <div className="portal-preloader__orbit portal-preloader__orbit--a" />
          <div className="portal-preloader__orbit portal-preloader__orbit--b" />
          <div className="portal-preloader__orbit portal-preloader__orbit--c" />
        </div>
        {title ? <p className="portal-preloader__title">{title}</p> : null}
        {caption ? <p className="portal-preloader__caption">{caption}</p> : null}
      </div>
    </div>
  );
}