import React, { useRef, useEffect } from 'react';

export default function InteractiveMapWrapper({ children, rotated = false }) {
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  const scale = useRef(1);
  const pos = useRef({ x: 0, y: 0 });

  const isDragging = useRef(false);
  const startDrag = useRef({ x: 0, y: 0 });
  const startPos = useRef({ x: 0, y: 0 });
  const startDist = useRef(0);
  const startScale = useRef(1);

  const requestRef = useRef(null);

  const updateTransform = () => {
    if (contentRef.current) {
      contentRef.current.style.transform = `translate(${pos.current.x}px, ${pos.current.y}px) scale(${scale.current})`;
    }
    if (containerRef.current) {
      containerRef.current.style.touchAction = scale.current > 1 ? 'none' : 'auto';
    }
  };

  const constrainPos = () => {
    if (!containerRef.current) return;
    const { clientWidth, clientHeight } = containerRef.current;
    
    // Bounds for translation are roughly half the off-screen width
    const maxPx = (scale.current - 1) * clientWidth / 2;
    const maxPy = (scale.current - 1) * clientHeight / 2;

    pos.current.x = Math.max(-maxPx, Math.min(maxPx, pos.current.x));
    pos.current.y = Math.max(-maxPy, Math.min(maxPy, pos.current.y));
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleTouchStart = (e) => {
      if (e.touches.length === 1) {
        isDragging.current = true;
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
        // If not zoomed in, allow native scrolling (do not prevent default)
        if (scale.current <= 1) return;
        
        e.preventDefault();
        const dx = e.touches[0].clientX - startDrag.current.x;
        const dy = e.touches[0].clientY - startDrag.current.y;

        // In fullscreen mode the city container is rotated by 90deg, so gesture axes
        // need remapping to keep pan direction intuitive for the user.
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

    // Add listeners with non-passive correctly
    const touchOptions = { passive: false };
    el.addEventListener('touchstart', handleTouchStart, touchOptions);
    el.addEventListener('touchmove', handleTouchMove, touchOptions);
    el.addEventListener('touchend', handleTouchEnd);
    el.addEventListener('touchcancel', handleTouchEnd);
    el.addEventListener('wheel', handleWheel, touchOptions);

    return () => {
      // Must match options to ensure listener removal in Safari/WebKit
      el.removeEventListener('touchstart', handleTouchStart, touchOptions);
      el.removeEventListener('touchmove', handleTouchMove, touchOptions);
      el.removeEventListener('touchend', handleTouchEnd);
      el.removeEventListener('touchcancel', handleTouchEnd);
      el.removeEventListener('wheel', handleWheel, touchOptions);
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
        touchAction: 'auto'
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
