import React, { useRef, useEffect } from 'react';

export default function InteractiveMapWrapper({ children, rotated = false, background = "transparent" }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  const scale = useRef(1);
  const pos = useRef({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const didMove = useRef(false);
  const startDrag = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const startDist = useRef(0);
  const startScale = useRef(1);

  const requestRef = useRef(null);
  const DRAG_THRESHOLD = 6; // px — above this, treat as pan and suppress child click

  const updateTransform = () => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) scale(${scale.current})`;
    }
  };

  const constrainPos = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;

    // At scale=1 content is already meant to fit, but in fullscreen (rotated)
    // mode we give the user a small slack so they can drag to see anything
    // that landed near the edge after letterboxing. At higher zooms the
    // allowed range is exactly the off-screen portion of the scaled content.
    const slack = rotated ? 0.35 : 0;
    const maxPx = Math.max(0, ((scale.current - 1) + slack) * clientWidth / 2);
    const maxPy = Math.max(0, ((scale.current - 1) + slack) * clientHeight / 2);

    pos.current.x = Math.max(-maxPx, Math.min(maxPx, pos.current.x));
    pos.current.y = Math.max(-maxPy, Math.min(maxPy, pos.current.y));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
        didMove.current = false;
        startDrag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        startPos.current = { ...pos.current };
      } else if (e.touches.length === 2) {
        isDragging.current = false;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        startDist.current = Math.hypot(dx, dy);
        startScale.current = scale.current;
      }
    };

    const handleTouchMove = (e) => {
      if (e.touches.length === 1 && isDragging.current) {
        e.preventDefault();
        const dx = e.touches[0].clientX - startDrag.current.x;
        const dy = e.touches[0].clientY - startDrag.current.y;
        if ((scale.current > 1 || rotated) && Math.hypot(dx, dy) > DRAG_THRESHOLD) didMove.current = true;

        const adjustedDx = rotated ? dy : dx;
        const adjustedDy = rotated ? -dx : dy;

        pos.current.x = startPos.current.x + adjustedDx;
        pos.current.y = startPos.current.y + adjustedDy;

        constrainPos();
      } else if (e.touches.length === 2) {
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        
        scale.current = Math.max(1, Math.min(5, startScale.current * (dist / startDist.current)));
        if (scale.current === 1) {
          pos.current = { x: 0, y: 0 };
        } else {
          constrainPos();
        }
      }
      
      if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(() => {
          updateTransform();
          requestRef.current = null;
        });
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length < 2) {
        constrainPos();
        updateTransform();
      }
      if (e.touches.length === 0) {
        isDragging.current = false;
      } else if (e.touches.length === 1) {
        // If we lifted one finger of a pinch, start dragging again to avoid jump
        isDragging.current = true;
        startDrag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        startPos.current = { ...pos.current };
      }
    };

    const handleWheel = (e) => {
      e.preventDefault();
      if (e.ctrlKey) {
        scale.current = Math.max(1, Math.min(5, scale.current - e.deltaY * 0.01));
      } else {
        const adjustedDx = rotated ? e.deltaY : e.deltaX;
        const adjustedDy = rotated ? -e.deltaX : e.deltaY;
        pos.current.x -= adjustedDx;
        pos.current.y -= adjustedDy;
      }
      if (scale.current === 1) {
        pos.current = { x: 0, y: 0 };
      } else {
        constrainPos();
      }
      
      if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(() => {
          updateTransform();
          requestRef.current = null;
        });
      }
    };

    // Mouse drag for desktop
    const handleMouseDown = (e) => {
      if (e.button !== 0) return;
      isDragging.current = true;
      didMove.current = false;
      startDrag.current = { x: e.clientX, y: e.clientY };
      startPos.current = { ...pos.current };
      el.style.cursor = 'grabbing';
    };
    const handleMouseMove = (e) => {
      if (!isDragging.current) return;
      const dx = e.clientX - startDrag.current.x;
      const dy = e.clientY - startDrag.current.y;
      if ((scale.current > 1 || rotated) && Math.hypot(dx, dy) > DRAG_THRESHOLD) didMove.current = true;
      const adjustedDx = rotated ? dy : dx;
      const adjustedDy = rotated ? -dx : dy;
      pos.current.x = startPos.current.x + adjustedDx;
      pos.current.y = startPos.current.y + adjustedDy;
      constrainPos();
      if (!requestRef.current) {
        requestRef.current = requestAnimationFrame(() => {
          updateTransform();
          requestRef.current = null;
        });
      }
    };
    const handleMouseUp = () => {
      if (!isDragging.current) return;
      isDragging.current = false;
      el.style.cursor = 'grab';
      constrainPos();
      updateTransform();
    };

    // Add listeners with non-passive correctly
    const touchOptions = { passive: false };
    el.addEventListener('touchstart', handleTouchStart, touchOptions);
    el.addEventListener('touchmove', handleTouchMove, touchOptions);
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);
    el.addEventListener('wheel', handleWheel, touchOptions);
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    el.style.cursor = 'grab';

    // Suppress child click (e.g. district plot onClick) when user panned.
    // Works for both touch (tap→click) and mouse.
    const handleClickCapture = (e) => {
      if (didMove.current) {
        e.stopPropagation();
        e.preventDefault();
      }
      didMove.current = false;
    };
    el.addEventListener('click', handleClickCapture, true);

    return () => {
      // Must match options to ensure listener removal in Safari/WebKit
      el.removeEventListener('touchstart', handleTouchStart, touchOptions);
      el.removeEventListener('touchmove', handleTouchMove, touchOptions);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('wheel', handleWheel, touchOptions);
      el.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      el.removeEventListener('click', handleClickCapture, true);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [rotated]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        position: 'relative',
        touchAction: 'none',
        background
      }}
    >
      <div
        ref={contentRef}
        style={{
          width: '100%',
          height: '100%',
          transformOrigin: 'center center'
        }}
      >
        {children}
      </div>
    </div>
  );
}
