const API_BASE = import.meta.env.VITE_API_BASE ?? "http://localhost:8000";

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    },
    ...options
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  return response.json();
}

export function searchMovies(query, genres = [], limit = 12) {
  const params = new URLSearchParams({ query, limit: String(limit) });
  genres.forEach((genre) => params.append("genres", genre));
  return request(`/movies/search?${params.toString()}`);
}

export function fetchGenres() {
  return request("/genres");
}

export function fetchRecommendations(payload) {
  return request("/recommend", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function sendFeedback(payload) {
  return request("/feedback", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export function fetchMetrics() {
  return request("/metrics");
}
