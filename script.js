const searchForm = document.querySelector("#search-form");
const searchInput = document.querySelector("#search-input");
const searchError = document.querySelector("#search-error");
const statusMessage = document.querySelector("#status-message");
const resultsView = document.querySelector("#results-view");
const articleView = document.querySelector("#article-view");
const articleTitle = document.querySelector("#article-title");
const articleImage = document.querySelector("#article-image");
const articleContent = document.querySelector("#article-content");
const articleLoading = document.querySelector("#article-loading");
const articleExternalLink = document.querySelector("#article-external-link");
const backButton = document.querySelector("#back-button");
const suggestionsContainer = document.querySelector("#suggestions");
const searchButton = document.querySelector("#search-button");

const state = {
  query: "",
  results: [],
  selectedArticle: null,
};

let debounceTimer = null;
let suggestionRequestToken = 0;

function clearResults() {
  resultsView.innerHTML = "";
}

function clearSuggestions() {
  suggestionsContainer.innerHTML = "";
  suggestionsContainer.classList.add("d-none");
}

function clearError() {
  searchError.textContent = "";
  searchError.classList.add("d-none");
}

function showError(message) {
  searchError.textContent = message;
  searchError.classList.remove("d-none");
}

function clearStatus() {
  statusMessage.innerHTML = "";
}

function showStatus(message) {
  statusMessage.innerHTML = `
    <div class="alert alert-info d-flex align-items-center gap-2" role="alert">
      <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>
      <div>${message}</div>
    </div>
  `;
}

function showApiError(message) {
  statusMessage.innerHTML = `
    <div class="alert alert-danger" role="alert">
      ${message}
    </div>
  `;
}

function showEmptyState(message) {
  resultsView.innerHTML = `
    <div class="alert alert-warning" role="alert">
      ${message}
    </div>
  `;
}

function showResultsView() {
  articleView.classList.add("d-none");
  resultsView.classList.remove("d-none");
}

function showArticleView() {
  resultsView.classList.add("d-none");
  articleView.classList.remove("d-none");
}

function renderResults(pages) {
  state.results = pages;

  if (!pages.length) {
    showEmptyState("No results found.");
    return;
  }

  resultsView.innerHTML = `
    <div class="row g-3">
      ${pages
        .map(
          (page) => `
            <div class="col-12 col-md-6 col-lg-4">
              <div class="card h-100 result-card" data-pageid="${page.pageid}">
                <img
                  src="${page.thumbnail?.source || "https://via.placeholder.com/640x360?text=No+Image"}"
                  class="card-img-top result-thumbnail"
                  alt="${page.title}"
                />
                <div class="card-body d-flex flex-column">
                  <h5 class="card-title">${page.title}</h5>
                  <p class="card-text result-extract">${page.extract || ""}</p>
                  <div class="mt-auto d-flex gap-2 flex-wrap">
                    <button type="button" class="btn btn-outline-primary open-article" data-pageid="${page.pageid}">
                      View article
                    </button>
                    <a href="${page.fullurl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
                      Read more
                    </a>
                  </div>
                </div>
              </div>
            </div>
          `,
        )
        .join("")}
    </div>
  `;

  clearStatus();
  showResultsView();
}

async function fetchWikipediaResults(query, limit = 20) {
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=${limit}&prop=pageimages|extracts|info&exintro=1&explaintext=1&exlimit=max&inprop=url&format=json&origin=*`,
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.info || "Wikipedia API error");
  }

  return Object.values(data.query?.pages || {});
}

async function fetchWikipediaArticle(pageid) {
  const response = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&pageids=${pageid}&prop=pageimages|extracts|info&explaintext=1&exlimit=max&inprop=url&pithumbsize=900&format=json&origin=*`,
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.info || "Wikipedia API error");
  }

  const page =
    data.query?.pages?.[pageid] || Object.values(data.query?.pages || {})[0];

  if (!page) {
    throw new Error("Article not found");
  }

  return page;
}

async function onClickSearch() {
  const query = searchInput.value.trim();

  if (query.length < 3) {
    showError("Please enter at least 3 characters.");
    clearSuggestions();
    return;
  }

  clearError();
  clearSuggestions();
  resultsView.innerHTML = "";
  showStatus("Searching articles...");

  searchButton.disabled = true;

  try {
    const pages = await fetchWikipediaResults(query, 20);
    state.query = query;
    renderResults(pages);
  } catch (error) {
    showApiError("Unable to load search results. Please try again.");
  } finally {
    searchButton.disabled = false;
  }
}

async function openArticle(pageid) {
  const selectedPage = state.results.find(
    (page) => String(page.pageid) === String(pageid),
  );

  if (!selectedPage) {
    showApiError("The selected article could not be opened.");
    return;
  }

  showArticleView();
  articleLoading.classList.remove("d-none");
  articleContent.innerHTML = "";
  articleTitle.textContent = "";
  articleImage.classList.add("d-none");
  articleImage.removeAttribute("src");
  articleExternalLink.href = selectedPage.fullurl || "#";

  try {
    const article = await fetchWikipediaArticle(pageid);

    state.selectedArticle = article;
    articleTitle.textContent = article.title || selectedPage.title;
    articleExternalLink.href = article.fullurl || selectedPage.fullurl || "#";

    if (article.thumbnail?.source) {
      articleImage.src = article.thumbnail.source;
      articleImage.alt = article.title || selectedPage.title;
      articleImage.classList.remove("d-none");
    }

    articleContent.innerHTML = `
      <p class="lead">${article.extract || "No article content available."}</p>
    `;
  } catch (error) {
    articleContent.innerHTML = `
      <div class="alert alert-danger" role="alert">
        Unable to load the article. Please try again.
      </div>
    `;
  } finally {
    articleLoading.classList.add("d-none");
  }
}

async function showSuggestions() {
  const query = searchInput.value.trim();
  const token = ++suggestionRequestToken;

  if (query.length < 3) {
    clearSuggestions();
    return;
  }

  try {
    const pages = await fetchWikipediaResults(query, 3);

    if (token !== suggestionRequestToken) {
      return;
    }

    if (!pages.length) {
      clearSuggestions();
      return;
    }

    suggestionsContainer.innerHTML = pages
      .map(
        (page) => `
          <button
            type="button"
            class="list-group-item list-group-item-action suggestion-item"
            data-title="${page.title}"
          >
            <div class="fw-semibold">${page.title}</div>
            <div class="suggestion-extract">${page.extract || "No preview available."}</div>
          </button>
        `,
      )
      .join("");

    suggestionsContainer.classList.remove("d-none");
  } catch (error) {
    clearSuggestions();
  }
}

backButton.addEventListener("click", () => {
  showResultsView();
});

searchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await onClickSearch();
});

searchInput.addEventListener("input", () => {
  clearError();
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(showSuggestions, 500);
});

suggestionsContainer.addEventListener("click", async (event) => {
  const item = event.target.closest(".suggestion-item");

  if (!item) {
    return;
  }

  searchInput.value = item.dataset.title;
  clearSuggestions();
  await onClickSearch();
});

resultsView.addEventListener("click", async (event) => {
  const card = event.target.closest(".open-article, .result-card");

  if (!card) {
    return;
  }

  const pageid = card.dataset.pageid;
  if (pageid) {
    await openArticle(pageid);
  }
});
