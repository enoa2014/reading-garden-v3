// Reading Garden — Botanical Journal Edition
document.addEventListener('DOMContentLoaded', () => {
    initNav();
    loadLibrary();
});

// Sticky nav with scroll detection
function initNav() {
    const nav = document.getElementById('gardenNav');
    if (!nav) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(() => {
                nav.classList.toggle('is-scrolled', window.scrollY > 40);
                ticking = false;
            });
            ticking = true;
        }
    }, { passive: true });
}

async function loadLibrary() {
    const entryGrid = document.getElementById('quickEntryGrid');
    const shelfBoard = document.getElementById('shelfBoard');

    if (!entryGrid || !shelfBoard) return;

    try {
        const response = await fetch('data/books.json');
        if (!response.ok) throw new Error('Network error');

        const payload = await response.json();
        const books = Array.isArray(payload?.books) ? payload.books : [];

        if (books.length === 0) {
            renderEmptyState(entryGrid, shelfBoard);
            return;
        }

        renderFeatured(entryGrid, books);
        renderShelf(shelfBoard, books);

    } catch (error) {
        console.error('Library loading failed:', error);
        renderErrorState(entryGrid, shelfBoard);
    }
}

function renderFeatured(container, books) {
    container.innerHTML = '';
    books.forEach(book => {
        container.appendChild(createFeaturedCard(book));
    });
}

function renderShelf(container, books) {
    container.innerHTML = '';
    books.forEach(book => {
        container.appendChild(createShelfBook(book));
    });
}

function createFeaturedCard(book) {
    const card = document.createElement('a');
    card.className = 'entry-card';
    const pageUrl = safeText(book.page || book.link, '#');
    card.href = pageUrl;
    const coverUrl = safeText(book.cover, `https://placehold.co/600x400?text=${book.id}`);

    card.innerHTML = `
        <div class="entry-cover">
            <span class="entry-id">${safeText(book.id, 'BOOK')}</span>
            <img src="${coverUrl}" alt="${safeText(book.title)} Cover" loading="lazy">
        </div>
        <div class="entry-body">
            <div class="entry-meta">
                <span>${safeText(book.author, '')}</span>
            </div>
            <h3 class="entry-title">${safeText(book.title, 'Untitled Book')}</h3>
            <p class="entry-desc">${safeText(book.description, 'Explore this interactive journey.')}</p>
            <div class="entry-tags">
                ${(book.tags || ['Read']).map(t => `<span class="entry-tag">${safeText(t)}</span>`).join('')}
            </div>
        </div>
    `;
    return card;
}

function createShelfBook(book) {
    const link = document.createElement('a');
    link.className = 'book';
    const pageUrl = safeText(book.page || book.link, '#');
    link.href = pageUrl;
    const coverUrl = safeText(book.cover, `https://placehold.co/100x150?text=${book.id}`);

    link.innerHTML = `
        <div class="book-spine"></div>
        <div class="book-cover-art">
            <img src="${coverUrl}" alt="${safeText(book.title)}" loading="lazy">
        </div>
    `;
    return link;
}

function renderEmptyState(grid, shelf) {
    const msg = '<div class="loading">The library is currently empty.</div>';
    grid.innerHTML = msg;
    shelf.innerHTML = msg;
}

function renderErrorState(grid, shelf) {
    const msg = '<div class="loading">Unable to access library records.</div>';
    grid.innerHTML = msg;
    shelf.innerHTML = msg;
}

function safeText(str, fallback = '') {
    return (str || fallback).toString().replace(/[<>"']/g, '');
}
