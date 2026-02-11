function defaultShouldHandle(event) {
    const target = event?.target;
    if (!target || typeof target.closest !== 'function') {
        return true;
    }
    return !target.closest('input, textarea, select, button, a, [contenteditable="true"], [data-no-swipe="true"]');
}

export function bindHorizontalSwipe(targetEl, options = {}) {
    if (!targetEl || typeof targetEl.addEventListener !== 'function') {
        return () => { };
    }

    const {
        onSwipeLeft,
        onSwipeRight,
        minDistance = 56,
        maxVerticalDistance = 90,
        minHorizontalRatio = 1.2,
        maxDurationMs = 850,
        shouldHandle = defaultShouldHandle
    } = options;

    let startX = 0;
    let startY = 0;
    let startAt = 0;
    let tracking = false;

    const onTouchStart = (event) => {
        if (!event.touches || event.touches.length !== 1) {
            tracking = false;
            return;
        }
        if (typeof shouldHandle === 'function' && !shouldHandle(event)) {
            tracking = false;
            return;
        }

        const touch = event.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        startAt = Date.now();
        tracking = true;
    };

    const onTouchEnd = (event) => {
        if (!tracking) return;
        tracking = false;

        if (!event.changedTouches || event.changedTouches.length === 0) {
            return;
        }

        const touch = event.changedTouches[0];
        const deltaX = touch.clientX - startX;
        const deltaY = touch.clientY - startY;
        const absX = Math.abs(deltaX);
        const absY = Math.abs(deltaY);
        const duration = Date.now() - startAt;

        if (duration > maxDurationMs) return;
        if (absX < minDistance) return;
        if (absY > maxVerticalDistance) return;
        if (absX < absY * minHorizontalRatio) return;

        if (deltaX < 0) {
            if (typeof onSwipeLeft === 'function') {
                onSwipeLeft();
            }
            return;
        }

        if (typeof onSwipeRight === 'function') {
            onSwipeRight();
        }
    };

    const onTouchCancel = () => {
        tracking = false;
    };

    targetEl.addEventListener('touchstart', onTouchStart, { passive: true });
    targetEl.addEventListener('touchend', onTouchEnd, { passive: true });
    targetEl.addEventListener('touchcancel', onTouchCancel, { passive: true });

    return () => {
        targetEl.removeEventListener('touchstart', onTouchStart);
        targetEl.removeEventListener('touchend', onTouchEnd);
        targetEl.removeEventListener('touchcancel', onTouchCancel);
    };
}
