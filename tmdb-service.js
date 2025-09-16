// Using native fetch (available in Node.js 18+)
const { AppError } = require('./errors');

let tmdbApiKey = null;
let watchRegion = 'US';
let imageBaseUrl = 'https://image.tmdb.org/t/p/';
let posterSize = 'w342';
let logoSize = 'w92';
let configLoaded = false;

async function initTMDb(apiKey, region = 'US') {
  tmdbApiKey = apiKey;
  watchRegion = region;

  if (!tmdbApiKey) {
    console.warn('TMDb API key not provided');
    return;
  }

  await loadConfiguration();
}

async function loadConfiguration() {
  if (!tmdbApiKey) {
    return;
  }

  const configUrl = `https://api.themoviedb.org/3/configuration?api_key=${tmdbApiKey}`;

  try {
    const response = await fetch(configUrl);

    if (!response.ok) {
      throw new AppError('Could not load TMDb configuration. Try again later.', response.status);
    }

    const data = await response.json();

    if (data.images) {
      imageBaseUrl = data.images.secure_base_url || data.images.base_url || imageBaseUrl;

      if (Array.isArray(data.images.poster_sizes) && data.images.poster_sizes.length > 0) {
        posterSize = data.images.poster_sizes.includes('w342')
          ? 'w342'
          : data.images.poster_sizes[data.images.poster_sizes.length - 1];
      }

      if (Array.isArray(data.images.logo_sizes) && data.images.logo_sizes.length > 0) {
        logoSize = data.images.logo_sizes.find(size => size.startsWith('w') && parseInt(size.slice(1), 10) >= 45) ||
          data.images.logo_sizes[data.images.logo_sizes.length - 1];
      }
    }

    configLoaded = true;
  } catch (error) {
    console.error('TMDb configuration error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to initialize TMDb. Check your network connection and API key.', 502);
  }
}

function normalizeTitle(value) {
  return (value || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function selectBestCandidate(candidates, targetYear = null) {
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const sorted = candidates.slice().sort((a, b) => {
    if (targetYear) {
      const diffA = a.releaseYear != null ? Math.abs(a.releaseYear - targetYear) : Number.MAX_SAFE_INTEGER;
      const diffB = b.releaseYear != null ? Math.abs(b.releaseYear - targetYear) : Number.MAX_SAFE_INTEGER;
      if (diffA !== diffB) {
        return diffA - diffB;
      }
    }

    const voteA = a.vote_count || 0;
    const voteB = b.vote_count || 0;
    if (voteA !== voteB) {
      return voteB - voteA;
    }

    const popularityA = a.popularity || 0;
    const popularityB = b.popularity || 0;
    return popularityB - popularityA;
  });

  return sorted[0];
}

async function searchMovie(title, year = null) {
  if (!tmdbApiKey) {
    throw new AppError('TMDb API key not configured', 500);
  }

  const searchUrl = new URL('https://api.themoviedb.org/3/search/movie');
  searchUrl.searchParams.append('api_key', tmdbApiKey);
  searchUrl.searchParams.append('query', title);
  searchUrl.searchParams.append('include_adult', 'false');
  if (year) {
    searchUrl.searchParams.append('year', year);
  }

  try {
    const response = await fetch(searchUrl);

    if (!response.ok) {
      throw new AppError('TMDb search failed. Please try again.', response.status);
    }

    const data = await response.json();
    const results = Array.isArray(data.results) ? data.results : [];

    if (results.length === 0) {
      throw new AppError('We couldn’t find that movie. Try adding the release year or a more specific title.', 404);
    }

    const parsedYear = typeof year === 'number' ? year : parseInt(year, 10);
    const normalizedInput = normalizeTitle(title);

    const processedResults = results.map(result => ({
      ...result,
      releaseYear: result.release_date ? new Date(result.release_date).getFullYear() : null,
      normalizedTitle: normalizeTitle(result.title),
      normalizedOriginalTitle: normalizeTitle(result.original_title)
    }));

    let candidate = null;

    const exactMatches = processedResults.filter(result => {
      return normalizedInput && (
        result.normalizedTitle === normalizedInput ||
        result.normalizedOriginalTitle === normalizedInput
      );
    });

    if (exactMatches.length > 0) {
      candidate = selectBestCandidate(exactMatches, isNaN(parsedYear) ? null : parsedYear);
    }

    if (!candidate && !isNaN(parsedYear)) {
      const yearMatches = processedResults.filter(result => result.releaseYear === parsedYear);
      if (yearMatches.length > 0) {
        candidate = selectBestCandidate(yearMatches, parsedYear);
      }
    }

    if (!candidate) {
      candidate = processedResults.slice().sort((a, b) => (b.popularity || 0) - (a.popularity || 0))[0];
    }

    return candidate;
  } catch (error) {
    console.error('TMDb search error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to search movie. Check your network connection and try again.', 502);
  }
}

async function getMovieDetails(movieId) {
  if (!tmdbApiKey) {
    throw new AppError('TMDb API key not configured', 500);
  }

  const detailsUrl = `https://api.themoviedb.org/3/movie/${movieId}?api_key=${tmdbApiKey}`;

  try {
    const response = await fetch(detailsUrl);

    if (!response.ok) {
      throw new AppError('Failed to fetch movie details from TMDb.', response.status);
    }

    const data = await response.json();

    return {
      tmdb_id: data.id,
      poster_path: data.poster_path,
      release_date: data.release_date,
      genres: data.genres ? data.genres.map(g => g.name) : [],
      vote_average: data.vote_average,
      vote_count: data.vote_count,
      overview: data.overview,
      runtime: data.runtime
    };
  } catch (error) {
    console.error('TMDb details error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError('Failed to get movie details. Try again later.', 502);
  }
}

async function getWatchProviders(movieId) {
  if (!tmdbApiKey) {
    throw new AppError('TMDb API key not configured', 500);
  }

  const providersUrl = `https://api.themoviedb.org/3/movie/${movieId}/watch/providers?api_key=${tmdbApiKey}`;

  try {
    const response = await fetch(providersUrl);

    if (!response.ok) {
      console.error('TMDb providers error: non-OK response', response.status);
      return [];
    }

    const data = await response.json();

    if (!data.results || !data.results[watchRegion]) {
      return [];
    }

    const regionData = data.results[watchRegion];
    const providers = [];
    const seenProviders = new Set();

    const addProviders = (providerList, type) => {
      if (providerList && Array.isArray(providerList)) {
        for (const provider of providerList) {
          if (!seenProviders.has(provider.provider_name)) {
            seenProviders.add(provider.provider_name);
            providers.push({
              name: provider.provider_name,
              logo_path: provider.logo_path,
              type: type,
              display_priority: provider.display_priority || 999
            });
          }
        }
      }
    };

    addProviders(regionData.flatrate, 'flatrate');
    addProviders(regionData.rent, 'rent');
    addProviders(regionData.buy, 'buy');

    providers.sort((a, b) => {
      const typeOrder = { flatrate: 0, rent: 1, buy: 2 };
      const typeCompare = typeOrder[a.type] - typeOrder[b.type];
      if (typeCompare !== 0) return typeCompare;
      return a.display_priority - b.display_priority;
    });

    return providers;
  } catch (error) {
    console.error('TMDb providers error:', error);
    if (error instanceof AppError) {
      throw error;
    }
    return [];
  }
}

async function getMovieVideos(movieId) {
  if (!tmdbApiKey) {
    throw new AppError('TMDb API key not configured', 500);
  }

  const videosUrl = `https://api.themoviedb.org/3/movie/${movieId}/videos?api_key=${tmdbApiKey}`;

  try {
    const response = await fetch(videosUrl);

    if (!response.ok) {
      throw new AppError('Failed to fetch videos from TMDb.', response.status);
    }

    const data = await response.json();

    if (!data.results) return [];

    // Prioritize trailers, then teasers, then other videos
    const videos = data.results.filter(v => v.site === 'YouTube');
    const trailer = videos.find(v => v.type === 'Trailer' && v.official) ||
                    videos.find(v => v.type === 'Trailer') ||
                    videos.find(v => v.type === 'Teaser') ||
                    videos[0];

    return trailer ? [trailer] : [];
  } catch (error) {
    console.error('TMDb videos error:', error);
    return [];
  }
}

async function getMovieCredits(movieId) {
  if (!tmdbApiKey) {
    throw new AppError('TMDb API key not configured', 500);
  }

  const creditsUrl = `https://api.themoviedb.org/3/movie/${movieId}/credits?api_key=${tmdbApiKey}`;

  try {
    const response = await fetch(creditsUrl);

    if (!response.ok) {
      throw new AppError('Failed to fetch credits from TMDb.', response.status);
    }

    const data = await response.json();

    if (!data.cast) return [];

    // Get top 10 cast members
    return data.cast.slice(0, 10).map(person => ({
      name: person.name,
      character: person.character,
      profile_path: person.profile_path
    }));
  } catch (error) {
    console.error('TMDb credits error:', error);
    return [];
  }
}

async function enrichMovieData(parsedInput) {
  if (!configLoaded) {
    await loadConfiguration();
  }

  const searchResult = await searchMovie(parsedInput.title, parsedInput.year);
  const details = await getMovieDetails(searchResult.id);
  const providers = await getWatchProviders(searchResult.id);

  return {
    ...parsedInput,
    tmdb_id: details.tmdb_id,
    poster_path: details.poster_path,
    release_date: details.release_date,
    genres_json: JSON.stringify(details.genres),
    vote_average: details.vote_average,
    vote_count: details.vote_count,
    providers_json: JSON.stringify(providers),
    overview: details.overview,
    runtime: details.runtime
  };
}

function getImageUrl(path, size = 'w342') {
  if (!path) return null;
  return `${imageBaseUrl}${size}${path}`;
}

function getProxyImageUrl(path, size = 'original') {
  if (!path) return null;
  const sanitizedSize = size || 'original';
  const trimmed = path.startsWith('/') ? path.slice(1) : path;
  return `/tmdb/images/${sanitizedSize}/${trimmed}`;
}

function getPosterUrl(posterPath) {
  return getProxyImageUrl(posterPath, posterSize);
}

function getProviderLogoUrl(logoPath) {
  return getProxyImageUrl(logoPath, logoSize);
}

module.exports = {
  initTMDb,
  searchMovie,
  getMovieDetails,
  getWatchProviders,
  getMovieVideos,
  getMovieCredits,
  enrichMovieData,
  getPosterUrl,
  getProviderLogoUrl,
  getImageUrl,
  getProxyImageUrl
};
