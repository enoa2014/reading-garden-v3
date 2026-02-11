const MODAL_ID = 'storyModal';

function createModal() {
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content">
        <button class="modal-close" id="modalClose">✕</button>
        <div class="modal-body" id="modalBody"></div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
}

function clearPreviousModalLifecycle(modal) {
    if (typeof modal.__storyModalCleanup === 'function') {
        modal.__storyModalCleanup();
    }
    modal.__storyModalCleanup = null;
}

export function ensureStoryModal() {
    return document.getElementById(MODAL_ID) || createModal();
}

export function openStoryModal(options = {}) {
    const {
        html = '',
        classes = [],
        lockBodyScroll = false,
        closeOnBackdrop = true,
        closeOnEscape = true
    } = options;

    const modal = ensureStoryModal();
    clearPreviousModalLifecycle(modal);

    const modalBody = modal.querySelector('#modalBody');
    const closeBtn = modal.querySelector('#modalClose');
    if (!modalBody) {
        throw new Error('storyModal missing #modalBody');
    }

    modalBody.innerHTML = html;
    const classList = Array.isArray(classes) ? classes.filter(Boolean) : [];
    modal.classList.add('active', ...classList);
    if (lockBodyScroll) {
        document.body.style.overflow = 'hidden';
    }

    const cleanups = [];
    const addCleanup = (fn) => {
        if (typeof fn === 'function') cleanups.push(fn);
    };

    const cleanupAll = () => {
        modal.classList.remove('active', ...classList);
        if (lockBodyScroll) {
            document.body.style.overflow = '';
        }
        while (cleanups.length > 0) {
            const fn = cleanups.pop();
            try {
                fn();
            } catch (error) {
                console.warn('storyModal cleanup failed:', error);
            }
        }
        if (modal.__storyModalCleanup === cleanupAll) {
            modal.__storyModalCleanup = null;
        }
    };

    const close = () => cleanupAll();

    const closeBtnHandler = (event) => {
        event.preventDefault();
        close();
    };
    closeBtn?.addEventListener('click', closeBtnHandler);
    addCleanup(() => closeBtn?.removeEventListener('click', closeBtnHandler));

    if (closeOnBackdrop) {
        const backdropHandler = (event) => {
            if (event.target === modal) {
                close();
            }
        };
        modal.addEventListener('click', backdropHandler);
        addCleanup(() => modal.removeEventListener('click', backdropHandler));
    }

    if (closeOnEscape) {
        const escapeHandler = (event) => {
            if (event.key === 'Escape') {
                close();
            }
        };
        document.addEventListener('keydown', escapeHandler);
        addCleanup(() => document.removeEventListener('keydown', escapeHandler));
    }

    modal.__storyModalCleanup = cleanupAll;
    return { modal, modalBody, close, addCleanup };
}
