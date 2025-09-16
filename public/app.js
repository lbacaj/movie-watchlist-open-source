class MovieWatchlist {
  constructor() {
    // Core controls
    this.movieInput = document.getElementById('movieInput');
    this.addButton = document.getElementById('addButton');
    this.errorMessage = document.getElementById('errorMessage');
    this.toast = document.getElementById('toast');
    this.toWatchList = document.getElementById('toWatchList');
    this.watchedList = document.getElementById('watchedList');
    this.movieCardTemplate = document.getElementById('movieCardTemplate');
    this.providerIconTemplate = document.getElementById('providerIconTemplate');

    // Filters & sorting
    this.filterSearch = document.getElementById('filterSearch');
    this.genreFilter = document.getElementById('genreFilter');
    this.yearFilter = document.getElementById('yearFilter');
    this.ratingFilter = document.getElementById('ratingFilter');
    this.sortSelect = document.getElementById('sortSelect');

    this.filters = {
      search: '',
      genre: 'all',
      year: 'all',
      rating: 'all',
      sort: 'added_desc'
    };

    this.sortComparators = {
      added_desc: (a, b) => this.getTime(b.created_at) - this.getTime(a.created_at),
      added_asc: (a, b) => this.getTime(a.created_at) - this.getTime(b.created_at),
      rating_desc: (a, b) => (b.vote_average || 0) - (a.vote_average || 0),
      rating_asc: (a, b) => (a.vote_average || 0) - (b.vote_average || 0),
      release_desc: (a, b) => this.getTime(b.release_date) - this.getTime(a.release_date),
      release_asc: (a, b) => this.getTime(a.release_date) - this.getTime(b.release_date),
      alpha_asc: (a, b) => (a.title || '').localeCompare(b.title || '', undefined, { sensitivity: 'base' }),
      alpha_desc: (a, b) => (b.title || '').localeCompare(a.title || '', undefined, { sensitivity: 'base' })
    };

    this.filtersPanel = document.getElementById('filtersPanel');
    this.filtersToggle = document.getElementById('filtersToggle');
    this.filtersToggleLabel = document.getElementById('filtersToggleLabel');
    this.filtersOpen = this.filtersPanel ? !this.filtersPanel.classList.contains('hidden') : false;

    // Image upload controls
    this.imageInput = document.getElementById('imageInput');
    this.uploadButton = document.getElementById('uploadButton');
    this.imagePreview = document.getElementById('imagePreview');
    this.previewImg = document.getElementById('previewImg');
    this.clearImageBtn = document.getElementById('clearImage');
    this.selectedImageBase64 = null;

    // Modal controls
    this.modal = document.getElementById('movieModal');
    this.modalBackdrop = this.modal.querySelector('.modal-backdrop');
    this.modalCloseBtn = this.modal.querySelector('.modal-close');
    this.modalCloseBtn2 = document.getElementById('modalClose2');
    this.modalToggleStatusBtn = document.getElementById('modalToggleStatus');
    this.modalProviders = document.getElementById('modalProviders');
    this.modalNoProviders = document.getElementById('modalNoProviders');
    this.modalPersonalSection = document.getElementById('modalPersonalSection');
    this.modalPersonalLocked = document.getElementById('modalPersonalLocked');
    this.modalPersonalRating = document.getElementById('modalPersonalRating');
    this.modalPersonalRatingButtons = Array.from(this.modalPersonalRating?.querySelectorAll('button[data-rating-value]') || []);
    this.modalPersonalMeta = document.getElementById('modalPersonalMeta');
    this.modalPersonalNotes = document.getElementById('modalPersonalNotes');
    this.modalSavePersonal = document.getElementById('modalSavePersonal');
    this.modalClearPersonal = document.getElementById('modalClearPersonal');
    this.modalPersonalHint = document.getElementById('modalPersonalHint');
    this.modalPersonalFeedback = document.getElementById('modalPersonalFeedback');

    this.modalTrailerHero = document.getElementById('modalTrailerHero');
    this.modalTrailerEmbed = document.getElementById('modalTrailerEmbed');
    this.modalPosterHero = document.getElementById('modalPosterHero');
    this.modalTitleHero = document.getElementById('modalTitleHero');
    this.modalYearHero = document.getElementById('modalYearHero');
    this.modalRuntimeHero = document.getElementById('modalRuntimeHero');
    this.modalRatingHero = document.getElementById('modalRatingHero');
    this.modalGenresHero = document.getElementById('modalGenresHero');
    this.modalDescriptionHero = document.getElementById('modalDescriptionHero');
    this.modalDescriptionFull = document.getElementById('modalDescriptionFull');
    this.modalBackdropImg = document.querySelector('#modalBackdrop img');
    this.modalCastSection = document.getElementById('modalCastSection');
    this.modalCastContainer = document.getElementById('modalCast');

    this.personalControlsDisabledClass = 'opacity-60';
    this.initialPersonalState = { rating: null, notes: '' };
    this.modalPersonalDirty = false;
    this.personalFeedbackTimeout = null;
    this.modalSavePersonalLabel = this.modalSavePersonal ? this.modalSavePersonal.textContent : 'Save';

    // State
    this.allItems = { to_watch: [], watched: [] };
    this.isAdding = false;
    this.isSavingPersonal = false;
    this.searchDebounce = null;
    this.toastTimeout = null;

    this.currentModalItem = null;
    this.modalPersonalRatingValue = null;

    this.init();
  }

  init() {
    this.addButton.addEventListener('click', () => this.handleAdd());
    this.movieInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.handleAdd();
      }
    });

    if (this.filterSearch) {
      this.filterSearch.addEventListener('input', (e) => this.handleSearchInput(e.target.value));
    }
    if (this.genreFilter) {
      this.genreFilter.addEventListener('change', (e) => {
        this.filters.genre = e.target.value;
        this.renderFilteredLists();
        this.updateFiltersToggleState();
      });
    }
    if (this.yearFilter) {
      this.yearFilter.addEventListener('change', (e) => {
        this.filters.year = e.target.value;
        this.renderFilteredLists();
        this.updateFiltersToggleState();
      });
    }
    if (this.ratingFilter) {
      this.ratingFilter.addEventListener('change', (e) => {
        this.filters.rating = e.target.value;
        this.renderFilteredLists();
        this.updateFiltersToggleState();
      });
    }
    if (this.sortSelect) {
      this.sortSelect.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.renderFilteredLists();
        this.updateFiltersToggleState();
      });
    }

    if (this.filtersToggle) {
      this.filtersToggle.addEventListener('click', () => this.toggleFilters());
      this.filtersToggle.setAttribute('aria-expanded', this.filtersOpen ? 'true' : 'false');
    }

    this.uploadButton.addEventListener('click', (e) => {
      if (!e.target.closest('.drop-overlay')) {
        this.imageInput.click();
      }
    });
    this.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
    this.clearImageBtn.addEventListener('click', () => this.clearImage());
    this.setupDragAndDrop();

    this.modalCloseBtn.addEventListener('click', () => this.closeModal());
    this.modalCloseBtn2.addEventListener('click', () => this.closeModal());
    this.modalBackdrop.addEventListener('click', () => this.closeModal());

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.modal.classList.contains('hidden')) {
        this.closeModal();
      }
    });

    this.modalPersonalRatingButtons.forEach((button) => {
      button.addEventListener('click', () => {
        if (button.disabled) return;
        const selectedValue = Number(button.dataset.ratingValue);
        this.modalPersonalRatingValue = this.modalPersonalRatingValue === selectedValue ? null : selectedValue;
        this.refreshModalRatingDisplay();
        this.handlePersonalFieldChange();
      });
    });

    if (this.modalPersonalNotes) {
      this.modalPersonalNotes.addEventListener('input', () => {
        if (this.modalPersonalNotes.disabled) return;
        this.handlePersonalFieldChange();
      });
    }

    this.modalSavePersonal.addEventListener('click', () => this.savePersonalDetails());
    this.modalClearPersonal.addEventListener('click', () => this.clearPersonalDetails());

    this.updateFiltersToggleState();
    this.loadMovies();
  }

  getTime(value, fallback = 0) {
    if (!value) return fallback;
    const timestamp = new Date(value).getTime();
    return Number.isNaN(timestamp) ? fallback : timestamp;
  }

  getReleaseYear(item) {
    if (item.year) {
      const numeric = Number(item.year);
      return Number.isNaN(numeric) ? null : numeric;
    }
    if (item.release_date) {
      const date = new Date(item.release_date);
      const year = date.getFullYear();
      return Number.isNaN(year) ? null : year;
    }
    return null;
  }

  handleSearchInput(value) {
    clearTimeout(this.searchDebounce);
    this.searchDebounce = setTimeout(() => {
      this.filters.search = value.toLowerCase();
      this.renderFilteredLists();
      this.updateFiltersToggleState();
    }, 150);
  }

  async loadMovies() {
    try {
      const response = await fetch('/api/items');
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to load movies.');
      }

      const data = await response.json();
      this.allItems = {
        to_watch: Array.isArray(data.to_watch) ? data.to_watch : [],
        watched: Array.isArray(data.watched) ? data.watched : []
      };

      this.updateFilterOptions();
      this.renderFilteredLists();
    } catch (error) {
      console.error('Failed to load movies', error);
      this.showToast('Failed to load movies', 'error');
    }
  }

  updateFilterOptions() {
    const genres = new Set();
    const years = new Set();

    this.getAllItemsArray().forEach((item) => {
      (item.genres || []).forEach((genre) => genres.add(genre));
      const year = this.getReleaseYear(item);
      if (year) {
        years.add(year);
      }
    });

    if (this.genreFilter) {
      const currentValue = this.filters.genre;
      const sortedGenres = Array.from(genres).sort((a, b) => a.localeCompare(b));
      this.genreFilter.innerHTML = '<option value="all">All genres</option>' +
        sortedGenres.map((genre) => `<option value="${genre}">${genre}</option>`).join('');
      this.genreFilter.value = sortedGenres.includes(currentValue) ? currentValue : 'all';
      this.filters.genre = this.genreFilter.value;
    }

    if (this.yearFilter) {
      const currentValue = this.filters.year;
      const sortedYears = Array.from(years).sort((a, b) => b - a);
      this.yearFilter.innerHTML = '<option value="all">Any year</option>' +
        sortedYears.map((year) => `<option value="${year}">${year}</option>`).join('');
      this.yearFilter.value = sortedYears.map(String).includes(String(currentValue)) ? String(currentValue) : 'all';
      this.filters.year = this.yearFilter.value;
    }

    if (this.ratingFilter) {
      this.ratingFilter.value = this.filters.rating;
    }

    if (this.sortSelect) {
      this.sortSelect.value = this.filters.sort;
    }

    this.updateFiltersToggleState();
  }

  getAllItemsArray() {
    return [...this.allItems.to_watch, ...this.allItems.watched];
  }

  getActiveFilterCount() {
    let count = 0;
    if (this.filters.search && this.filters.search.trim().length > 0) count += 1;
    if (this.filters.genre !== 'all') count += 1;
    if (this.filters.year !== 'all') count += 1;
    if (this.filters.rating !== 'all') count += 1;
    if (this.filters.sort !== 'added_desc') count += 1;
    return count;
  }

  updateFiltersToggleState() {
    if (!this.filtersToggle || !this.filtersToggleLabel) {
      return;
    }

    const activeCount = this.getActiveFilterCount();
    const suffix = activeCount > 0 ? ` • ${activeCount}` : '';
    const label = this.filtersOpen ? `Hide Filters${suffix}` : `Show Filters${suffix}`;
    this.filtersToggleLabel.textContent = label;
    this.filtersToggle.classList.toggle('active', activeCount > 0);

    if (this.filtersToggle) {
      this.filtersToggle.setAttribute('aria-expanded', this.filtersOpen ? 'true' : 'false');
    }
    if (this.filtersPanel) {
      this.filtersPanel.setAttribute('aria-hidden', this.filtersOpen ? 'false' : 'true');
    }
  }

  toggleFilters(force = null) {
    if (!this.filtersPanel || !this.filtersToggle) {
      return;
    }

    const shouldOpen = force !== null ? force : !this.filtersOpen;
    this.filtersOpen = shouldOpen;
    this.filtersPanel.classList.toggle('hidden', !shouldOpen);
    this.updateFiltersToggleState();
  }

  renderFilteredLists() {
    const toWatchItems = this.applyFilters(this.allItems.to_watch, 'to_watch');
    const watchedItems = this.applyFilters(this.allItems.watched, 'watched');

    this.renderList(this.toWatchList, toWatchItems, 'to_watch');
    this.renderList(this.watchedList, watchedItems, 'watched');
  }

  applyFilters(items, status) {
    let filtered = Array.isArray(items) ? [...items] : [];
    const searchTerm = this.filters.search.trim();

    if (searchTerm) {
      filtered = filtered.filter((item) => {
        const haystack = [
          item.title,
          item.raw_input,
          item.description,
          item.overview,
          item.personal_notes,
          (item.genres || []).join(' ')
        ].join(' ').toLowerCase();
        return haystack.includes(searchTerm);
      });
    }

    if (this.filters.genre !== 'all') {
      filtered = filtered.filter((item) => (item.genres || []).includes(this.filters.genre));
    }

    if (this.filters.year !== 'all') {
      const yearFilter = Number(this.filters.year);
      filtered = filtered.filter((item) => this.getReleaseYear(item) === yearFilter);
    }

    if (this.filters.rating !== 'all') {
      const ratingThreshold = Number(this.filters.rating);
      filtered = filtered.filter((item) => (item.vote_average || 0) >= ratingThreshold);
    }

    const comparator = this.sortComparators[this.filters.sort] || this.sortComparators.added_desc;
    filtered.sort((a, b) => {
      const result = comparator(a, b);
      if (result !== 0) {
        return result;
      }
      // Stable fallback by created_at desc to avoid jitter
      return this.getTime(b.created_at) - this.getTime(a.created_at);
    });

    return filtered;
  }

  renderList(container, items, status) {
    if (!container) return;

    if (!items || items.length === 0) {
      const emptyMessage = status === 'to_watch'
        ? '<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 4v16M17 4v16M3 8h4m10 0h4M5 12h14M5 16h14"/></svg><p>Add a movie to get started</p>'
        : '<svg class="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg><p>Nothing here yet—mark items as watched</p>';
      container.innerHTML = `
        <div class="empty-state rounded-xl p-12 text-center col-span-full">
          <div class="text-gray-500">
            ${emptyMessage}
          </div>
        </div>
      `;
      return;
    }

    container.innerHTML = '';
    container.className = status === 'to_watch'
      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
      : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 opacity-90';

    items.forEach((item) => {
      const card = this.createMovieCard(item);
      container.appendChild(card);
    });
  }

  createMovieCard(item) {
    const template = this.movieCardTemplate.content.cloneNode(true);
    const card = template.querySelector('.movie-card');
    card.dataset.id = item.id;

    card.addEventListener('click', (e) => {
      if (!e.target.closest('.toggle-status') && !e.target.closest('.delete-btn')) {
        this.openModal(item);
      }
    });

    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteItem(item.id);
    });

    const poster = card.querySelector('.poster');
    const posterSkeleton = card.querySelector('.poster-skeleton');

    if (item.poster_url) {
      poster.src = item.poster_url;
      poster.alt = `${item.title} poster`;
      poster.onload = () => {
        posterSkeleton.style.display = 'none';
      };
      poster.onerror = () => {
        poster.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"%3E%3Crect fill="%23cbd5e1" width="400" height="600"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2364748b" font-family="sans-serif" font-size="24"%3ENo Poster%3C/text%3E%3C/svg%3E';
        posterSkeleton.style.display = 'none';
      };
    } else {
      poster.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 600"%3E%3Crect fill="%23cbd5e1" width="400" height="600"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2364748b" font-family="sans-serif" font-size="24"%3ENo Poster%3C/text%3E%3C/svg%3E';
      posterSkeleton.style.display = 'none';
    }

    const titleYear = card.querySelector('.title-year');
    const year = this.getReleaseYear(item);
    titleYear.textContent = year ? `${item.title} (${year})` : item.title;

    const genres = card.querySelector('.genres');
    genres.textContent = item.genres && item.genres.length > 0
      ? item.genres.join(', ')
      : 'No genres available';

    const ratingContainer = card.querySelector('.rating');
    const voteAverage = card.querySelector('.vote-average');
    const voteCount = card.querySelector('.vote-count');

    if (item.vote_average) {
      voteAverage.textContent = Number(item.vote_average).toFixed(1);
      voteCount.textContent = item.vote_count ? `(${Number(item.vote_count).toLocaleString()} votes)` : '';
      ratingContainer.style.display = 'flex';
    } else {
      ratingContainer.style.display = 'none';
    }

    const providerList = card.querySelector('.provider-list');
    providerList.innerHTML = '';
    if (item.provider_logos && item.provider_logos.length > 0) {
      const maxProviders = 6;
      const providersToShow = item.provider_logos.slice(0, maxProviders);
      providersToShow.forEach((provider) => {
        const providerEl = this.createProviderIcon(provider);
        providerList.appendChild(providerEl);
      });
      if (item.provider_logos.length > maxProviders) {
        const moreCount = item.provider_logos.length - maxProviders;
        const moreEl = document.createElement('div');
        moreEl.className = 'flex items-center justify-center w-10 h-10 bg-white/10 border border-white/20 text-sky-300 text-xs font-bold rounded-lg';
        moreEl.textContent = `+${moreCount}`;
        providerList.appendChild(moreEl);
      }
    } else {
      providerList.innerHTML = '<span class="text-xs text-gray-500">No providers available</span>';
    }

    const personalSection = card.querySelector('.personal-summary');
    const personalRatingRow = personalSection.querySelector('.personal-summary-rating');
    const personalRatingValue = personalSection.querySelector('.personal-rating-value');
    const personalNotes = personalSection.querySelector('.personal-notes');

    const hasPersonalRating = typeof item.personal_rating === 'number' && !Number.isNaN(item.personal_rating);
    const hasPersonalNotes = Boolean(item.personal_notes);

    if (hasPersonalRating) {
      personalRatingValue.textContent = `${Number(item.personal_rating).toFixed(1).replace('.0', '')} / 5`;
      personalRatingRow.classList.remove('hidden');
    } else {
      personalRatingValue.textContent = '';
      personalRatingRow.classList.add('hidden');
    }

    if (hasPersonalNotes) {
      personalNotes.textContent = item.personal_notes;
      personalNotes.classList.remove('hidden');
    } else {
      personalNotes.textContent = '';
      personalNotes.classList.add('hidden');
    }

    if (item.status === 'watched' && (hasPersonalRating || hasPersonalNotes)) {
      personalSection.classList.remove('hidden');
    } else {
      personalSection.classList.add('hidden');
    }

    const toggleButton = card.querySelector('.toggle-status');
    toggleButton.textContent = item.status === 'to_watch' ? 'Mark Watched' : 'Move back';
    toggleButton.className = item.status === 'to_watch'
      ? 'toggle-status w-full py-3 px-4 btn-watched font-semibold rounded-xl transition-all relative overflow-hidden shadow-lg hover:shadow-xl'
      : 'toggle-status w-full py-3 px-4 btn-move-back font-semibold rounded-xl transition-all relative overflow-hidden';

    toggleButton.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleStatus(item.id, item.status);
    });

    return card;
  }

  createProviderIcon(provider) {
    const template = this.providerIconTemplate.content.cloneNode(true);
    const wrapper = template.querySelector('.provider-wrapper');
    const img = wrapper.querySelector('img');
    const tooltip = wrapper.querySelector('.provider-tooltip');

    if (provider.logo_url) {
      img.src = provider.logo_url;
      img.alt = provider.name;
    } else {
      img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23cbd5e1" width="100" height="100"/%3E%3C/svg%3E';
      img.alt = provider.name;
    }

    tooltip.textContent = provider.name;
    return wrapper;
  }

  async handleImageSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      this.showError('Image must be less than 20MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      this.selectedImageBase64 = base64;
      this.previewImg.src = base64;
      this.imagePreview.classList.remove('hidden');
      this.movieInput.disabled = true;
      this.movieInput.placeholder = 'Using image to extract movie info...';
    };
    reader.readAsDataURL(file);
  }

  clearImage() {
    this.selectedImageBase64 = null;
    this.imageInput.value = '';
    this.imagePreview.classList.add('hidden');
    this.movieInput.disabled = false;
    this.movieInput.placeholder = 'Enter a movie title (e.g., Heat (1995))';
  }

  setupDragAndDrop() {
    const dropZone = this.uploadButton;
    let dragCounter = 0;

    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
      dropZone.addEventListener(eventName, preventDefaults, false);
      document.body.addEventListener(eventName, preventDefaults, false);
    });

    dropZone.addEventListener('dragenter', () => {
      dragCounter += 1;
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dragCounter -= 1;
      if (dragCounter === 0) {
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    dropZone.addEventListener('drop', (e) => {
      dragCounter = 0;
      dropZone.classList.remove('drag-over');

      const dt = e.dataTransfer;
      const files = dt.files;

      if (files.length > 0) {
        this.handleDroppedFile(files[0]);
      }
    });
  }

  handleDroppedFile(file) {
    if (!file.type.startsWith('image/')) {
      this.showError('Please drop an image file');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      this.showError('Image must be less than 20MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result;
      this.selectedImageBase64 = base64;
      this.previewImg.src = base64;
      this.imagePreview.classList.remove('hidden');
      this.movieInput.disabled = true;
      this.movieInput.placeholder = 'Processing image...';
      await this.handleAdd();
    };
    reader.readAsDataURL(file);
  }

  async handleAdd() {
    const input = this.movieInput.value.trim();

    if (!input && !this.selectedImageBase64) {
      this.showError('Please enter a movie title or select an image');
      return;
    }

    if (this.isAdding) {
      return;
    }

    this.isAdding = true;
    this.addButton.disabled = true;
    this.addButton.textContent = 'Adding...';
    this.hideError();

    try {
      const requestBody = this.selectedImageBase64
        ? { image: this.selectedImageBase64 }
        : { input };

      const response = await fetch('/api/items/intake', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409 && data.item) {
          this.showError(data.error || 'Already on your list');
          this.showToast(data.error || 'Already on your list', 'info');
          this.highlightExistingCard(data.item.id);
        } else {
          throw new Error(data.error || 'Failed to add movie');
        }
      } else {
        this.movieInput.value = '';
        this.clearImage();
        this.showToast('Movie added successfully', 'success');
        await this.loadMovies();
      }
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.isAdding = false;
      this.addButton.disabled = false;
      this.addButton.textContent = 'Add Movie';
    }
  }

  async toggleStatus(id, currentStatus) {
    const newStatus = currentStatus === 'to_watch' ? 'watched' : 'to_watch';

    try {
      const response = await fetch(`/api/items/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Failed to update status');
      }

      await this.loadMovies();
      this.showToast(`Movie ${newStatus === 'watched' ? 'marked as watched' : 'moved back to watch list'}`, 'success');
    } catch (error) {
      this.showToast('Failed to update status', 'error');
    }
  }

  async deleteItem(id) {
    if (!confirm('Are you sure you want to remove this movie from your list?')) {
      return;
    }

    try {
      const response = await fetch(`/api/items/${id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete movie');
      }

      this.showToast('Movie removed from your list', 'success');
      this.loadMovies();
    } catch (error) {
      this.showToast('Failed to remove movie', 'error');
    }
  }

  highlightExistingCard(id) {
    const card = document.querySelector(`.movie-card[data-id="${id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.boxShadow = '0 0 0 2px rgba(56, 189, 248, 0.5), 0 0 30px rgba(56, 189, 248, 0.3)';
      setTimeout(() => {
        card.style.boxShadow = '';
      }, 3000);
    }
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.classList.remove('hidden');
  }

  hideError() {
    this.errorMessage.classList.add('hidden');
  }

  showToast(message, type = 'info') {
    if (!this.toast) return;

    clearTimeout(this.toastTimeout);
    this.toast.textContent = message;
    this.toast.className = `fixed top-8 right-8 glass-card text-white px-6 py-3 rounded-xl shadow-2xl z-50 toast ${
      type === 'error' ? 'border-red-500/50' : type === 'success' ? 'border-green-500/50' : ''
    }`;
    this.toast.classList.remove('hidden');

    this.toastTimeout = setTimeout(() => {
      this.toast.classList.add('hidden');
    }, 3200);
  }

  getItemFromCache(id) {
    return this.allItems.to_watch.find((item) => item.id === id) ||
      this.allItems.watched.find((item) => item.id === id) ||
      null;
  }

  replaceItemInCache(updatedItem) {
    const statuses = ['to_watch', 'watched'];
    statuses.forEach((status) => {
      const list = this.allItems[status];
      const index = list.findIndex((item) => item.id === updatedItem.id);
      if (index !== -1) {
        if (updatedItem.status !== status) {
          list.splice(index, 1);
        } else {
          list[index] = updatedItem;
        }
      }
    });

    const targetList = this.allItems[updatedItem.status];
    if (!targetList.some((item) => item.id === updatedItem.id)) {
      targetList.unshift(updatedItem);
    }
  }

  async openModal(item) {
    const cachedItem = this.getItemFromCache(item.id) || item;
    this.currentModalItem = { ...cachedItem };

    this.modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    const posterUrl = cachedItem.poster_url || '';
    if (this.modalBackdropImg) {
      this.modalBackdropImg.src = posterUrl;
    }
    this.modalPosterHero.src = posterUrl;
    this.modalTitleHero.textContent = cachedItem.title;

    const year = this.getReleaseYear(cachedItem);
    this.modalYearHero.textContent = year ? year : '';

    if (cachedItem.vote_average) {
      this.modalRatingHero.querySelector('.text-white').textContent = `${Number(cachedItem.vote_average).toFixed(1)} (${cachedItem.vote_count ? Number(cachedItem.vote_count).toLocaleString() : 0} votes)`;
      this.modalRatingHero.style.display = 'flex';
    } else {
      this.modalRatingHero.style.display = 'none';
    }

    this.modalGenresHero.innerHTML = '';
    if (cachedItem.genres && cachedItem.genres.length > 0) {
      cachedItem.genres.forEach((genre) => {
        const badge = document.createElement('span');
        badge.className = 'genre-badge';
        badge.textContent = genre;
        this.modalGenresHero.appendChild(badge);
      });
    }

    this.modalDescriptionHero.textContent = '';
    this.modalDescriptionFull.textContent = '';

    this.renderModalProviders(cachedItem);
    this.setupModalPersonalSection(cachedItem);

    if (cachedItem.runtime) {
      const hours = Math.floor(cachedItem.runtime / 60);
      const minutes = cachedItem.runtime % 60;
      this.modalRuntimeHero.textContent = hours ? `${hours}h ${minutes}m` : `${minutes}m`;
    } else {
      this.modalRuntimeHero.textContent = '';
    }

    const isWatched = cachedItem.status === 'watched';
    this.modalToggleStatusBtn.textContent = isWatched ? 'Move back to Watch List' : 'Mark Watched';
    this.modalToggleStatusBtn.className = isWatched
      ? 'w-full py-3 px-6 btn-move-back font-semibold rounded-xl transition-all'
      : 'w-full py-3 px-6 btn-watched font-semibold rounded-xl transition-all shadow-lg hover:shadow-xl';

    this.modalToggleStatusBtn.onclick = async () => {
      await this.toggleStatus(cachedItem.id, cachedItem.status);
      this.closeModal();
    };

    try {
      const response = await fetch(`/api/items/${cachedItem.id}/details`);
      if (!response.ok) {
        throw new Error('Failed to fetch details');
      }
      const details = await response.json();
      this.currentModalItem = { ...cachedItem, ...details };

      const overviewText = details.overview || cachedItem.overview || 'No overview available.';
      this.modalDescriptionHero.textContent = overviewText;
      this.modalDescriptionFull.textContent = overviewText;

      if (details.runtime) {
        const hours = Math.floor(details.runtime / 60);
        const minutes = details.runtime % 60;
        this.modalRuntimeHero.textContent = hours ? `${hours}h ${minutes}m` : `${minutes}m`;
      }

      if (details.videos && details.videos.length > 0) {
        const trailer = details.videos[0];
        this.modalTrailerEmbed.src = `https://www.youtube.com/embed/${trailer.key}?rel=0`;
        this.modalTrailerHero.classList.remove('hidden');
      } else {
        this.modalTrailerEmbed.src = '';
        this.modalTrailerHero.classList.add('hidden');
      }

      this.renderModalProviders(details);
      this.renderModalCast(details.credits);
      this.setupModalPersonalSection({ ...cachedItem, ...details });
    } catch (error) {
      console.warn('Failed to load movie details', error);
      this.modalTrailerEmbed.src = '';
      this.modalTrailerHero.classList.add('hidden');
    }
  }

  renderModalProviders(item) {
    if (!this.modalProviders) return;

    this.modalProviders.innerHTML = '';
    if (item.provider_logos && item.provider_logos.length > 0) {
      this.modalNoProviders.classList.add('hidden');
      this.modalProviders.classList.remove('hidden');
      item.provider_logos.forEach((provider) => {
        const providerEl = this.createProviderIcon(provider);
        const img = providerEl.querySelector('.provider-icon');
        img.className = 'provider-icon w-16 h-16';
        this.modalProviders.appendChild(providerEl);
      });
    } else {
      this.modalProviders.classList.add('hidden');
      this.modalNoProviders.classList.remove('hidden');
    }
  }

  renderModalCast(cast) {
    if (!this.modalCastSection || !this.modalCastContainer) return;
    if (!cast || cast.length === 0) {
      this.modalCastSection.classList.add('hidden');
      this.modalCastContainer.innerHTML = '';
      return;
    }

    this.modalCastContainer.innerHTML = '';
    cast.forEach((person) => {
      const castCard = document.createElement('div');
      castCard.className = 'text-center';

      const imgWrapper = document.createElement('div');
      imgWrapper.className = 'mb-3';

      const img = document.createElement('img');
      img.src = person.profile_url || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23334155" width="100" height="100"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%2394a3b8" font-family="sans-serif" font-size="12"%3ENo Photo%3C/text%3E%3C/svg%3E';
      img.alt = person.name;
      img.className = 'w-24 h-24 rounded-full object-cover mx-auto border-2 border-white/10';

      const name = document.createElement('p');
      name.className = 'text-white text-sm font-semibold';
      name.textContent = person.name;

      const character = document.createElement('p');
      character.className = 'text-gray-400 text-xs mt-1';
      character.textContent = person.character;

      imgWrapper.appendChild(img);
      castCard.appendChild(imgWrapper);
      castCard.appendChild(name);
      castCard.appendChild(character);
      this.modalCastContainer.appendChild(castCard);
    });

    this.modalCastSection.classList.remove('hidden');
  }

  getCurrentPersonalState() {
    return {
      rating: this.modalPersonalRatingValue != null ? this.modalPersonalRatingValue : null,
      notes: this.modalPersonalNotes ? this.modalPersonalNotes.value.trim() : ''
    };
  }

  hasPersonalChanges() {
    const current = this.getCurrentPersonalState();
    return current.rating !== this.initialPersonalState.rating || current.notes !== this.initialPersonalState.notes;
  }

  updatePersonalHeaderMeta(sourceItem = this.currentModalItem || {}) {
    if (!this.modalPersonalMeta) return;

    if (this.modalPersonalDirty) {
      this.modalPersonalMeta.textContent = 'Draft';
      return;
    }

    if (this.modalPersonalRatingValue != null) {
      this.modalPersonalMeta.textContent = `${this.modalPersonalRatingValue} ★`;
      return;
    }

    const notesValue = sourceItem.personal_notes || this.initialPersonalState.notes;
    if (notesValue && notesValue.length > 0) {
      this.modalPersonalMeta.textContent = 'Notes saved';
      return;
    }

    this.modalPersonalMeta.textContent = '';
  }

  setPersonalFeedback(message, tone = '', { autoHide = false } = {}) {
    if (!this.modalPersonalFeedback) return;

    clearTimeout(this.personalFeedbackTimeout);

    const baseClass = 'personal-feedback';
    const toneClass = tone ? ` ${tone}` : '';
    this.modalPersonalFeedback.className = `${baseClass}${toneClass}`;
    this.modalPersonalFeedback.textContent = message || '';

    if (autoHide && message) {
      this.personalFeedbackTimeout = setTimeout(() => {
        if (!this.modalPersonalDirty) {
          this.modalPersonalFeedback.textContent = '';
          this.modalPersonalFeedback.className = baseClass;
        }
      }, 2600);
    }
  }

  updatePersonalActionState() {
    if (!this.modalSavePersonal || !this.modalClearPersonal) return;

    const isWatched = this.currentModalItem?.status === 'watched';

    if (!isWatched) {
      this.modalSavePersonal.disabled = true;
      this.modalClearPersonal.disabled = true;
      return;
    }

    this.modalSavePersonal.disabled = !this.modalPersonalDirty;

    const current = this.getCurrentPersonalState();
    const hasAnyValue = current.rating != null || current.notes.length > 0;
    const hasInitial = this.initialPersonalState.rating != null || this.initialPersonalState.notes.length > 0;
    this.modalClearPersonal.disabled = !hasAnyValue && !hasInitial;
  }

  handlePersonalFieldChange() {
    if (!this.currentModalItem || this.currentModalItem.status !== 'watched') {
      return;
    }
    this.modalPersonalDirty = this.hasPersonalChanges();
    if (this.modalPersonalDirty) {
      this.setPersonalFeedback('You have unsaved changes.', 'progress');
    } else if (this.initialPersonalState.rating != null || this.initialPersonalState.notes.length > 0) {
      this.setPersonalFeedback('Personal notes saved.', 'success', { autoHide: true });
    } else {
      this.setPersonalFeedback('', '');
    }
    this.updatePersonalHeaderMeta();
    this.updatePersonalActionState();
  }

  setupModalPersonalSection(item) {
    if (!this.modalPersonalSection) return;

    const isWatched = item.status === 'watched';
    this.modalPersonalRatingValue = typeof item.personal_rating === 'number' && !Number.isNaN(item.personal_rating)
      ? Number(item.personal_rating)
      : null;

    this.modalPersonalNotes.value = item.personal_notes || '';
    this.initialPersonalState = {
      rating: this.modalPersonalRatingValue,
      notes: this.modalPersonalNotes.value.trim()
    };
    this.modalPersonalDirty = false;

    const personalPanel = this.modalPersonalSection;
    const lockedPanel = this.modalPersonalLocked;

    if (personalPanel) {
      personalPanel.classList.toggle('hidden', !isWatched);
      personalPanel.classList.toggle(this.personalControlsDisabledClass, false);
    }
    if (lockedPanel) {
      lockedPanel.classList.toggle('hidden', isWatched);
    }

    this.modalPersonalNotes.disabled = !isWatched;
    this.modalPersonalHint.classList.toggle('hidden', isWatched);
    if (this.modalSavePersonal) {
      this.modalSavePersonal.textContent = this.modalSavePersonalLabel;
    }

    this.modalPersonalRatingButtons.forEach((button) => {
      button.disabled = !isWatched;
      button.classList.toggle('opacity-40', !isWatched);
    });

    if (!isWatched) {
      this.setPersonalFeedback('', '');
    } else if (this.initialPersonalState.rating != null || this.initialPersonalState.notes.length > 0) {
      this.setPersonalFeedback('Personal notes saved to your watchlist.', 'success', { autoHide: true });
    } else {
      this.setPersonalFeedback('', '');
    }

    this.refreshModalRatingDisplay(item);
    this.updatePersonalActionState();
  }

  refreshModalRatingDisplay(sourceItem) {
    const rating = this.modalPersonalRatingValue;
    this.modalPersonalRatingButtons.forEach((button) => {
      const value = Number(button.dataset.ratingValue);
      button.classList.toggle('active', rating != null && value <= rating);
    });
    this.updatePersonalHeaderMeta(sourceItem);
  }

  async savePersonalDetails({ clearing = false } = {}) {
    if (!this.currentModalItem) return;
    if (this.currentModalItem.status !== 'watched') {
      this.showToast('Mark the movie as watched to add your rating and notes.', 'info');
      return;
    }

    if (this.isSavingPersonal) {
      return;
    }

    if (!this.modalPersonalDirty && !clearing) {
      this.setPersonalFeedback('No changes to save.', 'info', { autoHide: true });
      return;
    }

    this.isSavingPersonal = true;
    this.setPersonalFeedback('Saving changes…', 'progress');
    if (this.modalSavePersonal) {
      this.modalSavePersonal.disabled = true;
      this.modalSavePersonal.textContent = 'Saving…';
    }

    const notesValue = this.modalPersonalNotes.value.trim();
    const payload = {
      personal_rating: this.modalPersonalRatingValue != null ? this.modalPersonalRatingValue : null,
      personal_notes: notesValue.length > 0 ? notesValue : null
    };

    let savedItem = null;

    try {
      const response = await fetch(`/api/items/${this.currentModalItem.id}/personal`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save your notes');
      }

      this.replaceItemInCache(data);
      this.currentModalItem = { ...this.currentModalItem, ...data };
      savedItem = data;
      this.initialPersonalState = {
        rating: data.personal_rating != null ? Number(data.personal_rating) : null,
        notes: data.personal_notes || ''
      };
      this.modalPersonalRatingValue = this.initialPersonalState.rating;
      this.modalPersonalNotes.value = this.initialPersonalState.notes;
      this.modalPersonalDirty = false;
      this.refreshModalRatingDisplay(data);
      this.updatePersonalActionState();
      this.renderFilteredLists();
      this.setPersonalFeedback(clearing ? 'Personal notes cleared.' : 'Saved to your watchlist.', 'success', { autoHide: true });
    } catch (error) {
      this.setPersonalFeedback(error.message || 'Failed to save your notes.', 'error');
      this.showToast(error.message || 'Failed to save your notes', 'error');
    } finally {
      this.isSavingPersonal = false;
      if (this.modalSavePersonal) {
        this.modalSavePersonal.textContent = this.modalSavePersonalLabel;
      }
      this.updatePersonalHeaderMeta(savedItem || this.currentModalItem);
      this.updatePersonalActionState();
    }
  }

  async clearPersonalDetails() {
    if (!this.currentModalItem || this.currentModalItem.status !== 'watched') {
      this.showToast('Mark the movie as watched to add your rating and notes.', 'info');
      return;
    }

    this.modalPersonalRatingValue = null;
    this.modalPersonalNotes.value = '';
    this.refreshModalRatingDisplay();
    this.handlePersonalFieldChange();
    await this.savePersonalDetails({ clearing: true });
  }

  closeModal() {
    this.modal.classList.add('hidden');
    document.body.style.overflow = '';
    this.modalTrailerEmbed.src = '';
    clearTimeout(this.personalFeedbackTimeout);
    this.setPersonalFeedback('', '');
    this.loadMovies();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new MovieWatchlist();
});
