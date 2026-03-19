let API_BASE_URL = "http://localhost:8000";

chrome.storage.local.get("apiBaseUrl", (res) => {
  if (res.apiBaseUrl) API_BASE_URL = res.apiBaseUrl;
});
chrome.storage.onChanged.addListener((changes) => {
  if (changes.apiBaseUrl) API_BASE_URL = changes.apiBaseUrl.newValue;
});

function setStatus(message) {
  const status = document.getElementById("status");
  if (status) {
    status.textContent = message;
  }
}

async function callApi(path, options = {}) {
  const config = {
    method: "GET",
    headers: {},
    ...options
  };

  if (config.body && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, config);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return response.json();
}

function openTab(url) {
  if (!chrome?.tabs?.update) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const activeTab = tabs?.[0];

        if (!activeTab?.id) {
          resolve();
          return;
        }

        chrome.tabs.update(activeTab.id, { url }, () => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      reject(error);
    }
  });
}

function createTab(url) {
  if (!chrome?.tabs?.create) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.create({ url }, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

function getActiveTabUrl() {
  if (!chrome?.tabs?.query) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    try {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        const activeTab = tabs?.[0];
        resolve(activeTab?.url ?? null);
      });
    } catch (error) {
      reject(error);
    }
  });
}

async function handleIndexClick(event) {
  const button = event.currentTarget;
  button.disabled = true;
  setStatus("Sending page to be indexed...");
  renderResults([]);

  try {
    const tabUrl = await getActiveTabUrl();

    if (!tabUrl) {
      setStatus("Unable to read the active tab URL. Open a page first.");
      return;
    }

    const data = await callApi("/index", {
      method: "POST",
      body: JSON.stringify({ url: tabUrl })
    });
    const message = data.message || "Index request processed.";
    const docName = data.doc_name ? ` (${data.doc_name})` : "";
    setStatus(`${message}${docName}`);
  } catch (error) {
    console.error(error);
    setStatus(`Index request failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function handleRandomBlogClick(event) {
  const button = event.currentTarget;
  button.disabled = true;
  setStatus("Fetching a random blog...");
  renderResults([]);

  try {
    const data = await callApi("/random-blog");
    setStatus(data.message || "Random blog retrieved.");

    if (data.url) {
      function trackTab(tabId) {
        if (data.source_url && tabId) {
          chrome.runtime.sendMessage({
            action: "track_tab",
            tabId: tabId,
            sourceUrl: data.source_url
          }).catch(() => {});
        }
      }

      const openInCurrent = await chrome.storage.local.get("openBlogsInCurrent");
      const shouldOpenInCurrent =
        typeof openInCurrent.openBlogsInCurrent === "boolean"
          ? openInCurrent.openBlogsInCurrent
          : true;

      if (shouldOpenInCurrent && chrome.tabs.update) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
           if (tabs[0] && tabs[0].id) {
             chrome.tabs.update(tabs[0].id, { url: data.url }, (tab) => trackTab(tab?.id || tabs[0].id));
           }
        });
      } else if (chrome.tabs.create) {
        chrome.tabs.create({ url: data.url }, (tab) => trackTab(tab?.id));
      }
    }
  } catch (error) {
    console.error(error);
    setStatus(`Unable to fetch a random blog: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function handleListSourcesClick(event) {
  const button = event.currentTarget;
  button.disabled = true;
  setStatus("Fetching sources...");
  renderResults([]);

  try {
    const data = await callApi("/sources");
    setStatus(data.message || "Sources loaded.");
    if (data.sources) {
      renderSources(data.sources);
    }
  } catch (error) {
    console.error(error);
    setStatus(`Unable to fetch sources: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function renderResults(results = []) {
  const container = document.getElementById("results");
  if (!container) return;

  container.innerHTML = "";
  const fragment = document.createDocumentFragment();

  results.forEach((item) => {
    const result = document.createElement("article");
    result.className = "result";

    const title = document.createElement("h2");
    title.textContent = item.title || "Result";
    result.appendChild(title);

    const snippet = document.createElement("p");
    snippet.className = "snippet";
    snippet.textContent = item.snippet || item.chunk || "No snippet available for this match.";
    result.appendChild(snippet);

    const resultUrl = item.url;
    if (resultUrl) {
      const link = document.createElement("a");
      link.href = resultUrl;
      link.textContent = "Open source";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      result.appendChild(link);
    }
    fragment.appendChild(result);
  });
  
  container.appendChild(fragment);
}

function renderSources(sources = []) {
  const container = document.getElementById("results");
  if (!container) return;
  container.innerHTML = "";

  const fragment = document.createDocumentFragment();

  const addForm = document.createElement("div");
  addForm.className = "source-form";
  
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Source Name";
  nameInput.className = "source-input";
  
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "URL";
  urlInput.className = "source-input";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Source";
  addBtn.className = "btn btn-primary source-add-btn";
  
  addBtn.addEventListener("click", async () => {
    if (!nameInput.value || !urlInput.value) return;
    addBtn.disabled = true;
    try {
      await callApi("/sources", {
        method: "POST",
        body: JSON.stringify({ name: nameInput.value, url: urlInput.value })
      });
      document.getElementById("listSourcesBtn").click();
    } catch(e) {
      setStatus(e.message);
      addBtn.disabled = false;
    }
  });

  addForm.appendChild(nameInput);
  addForm.appendChild(urlInput);
  addForm.appendChild(addBtn);
  fragment.appendChild(addForm);

  sources.forEach((item) => {
    const result = document.createElement("article");
    result.className = "result result-source";

    const content = document.createElement("div");
    content.className = "source-content";
    
    const title = document.createElement("h2");
    title.textContent = item.name;
    title.className = "source-title";
    
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.url;
    link.className = "source-link";
    link.target = "_blank";

    content.appendChild(title);
    content.appendChild(link);
    result.appendChild(content);

    const metricsContainer = document.createElement("div");
    metricsContainer.className = "metrics-container";
    
    const createMetricCircle = (value, colorClass, titleText) => {
      const circle = document.createElement("div");
      circle.textContent = value;
      circle.title = titleText;
      circle.className = `metric-circle ${colorClass}`;
      return circle;
    };
    
    metricsContainer.appendChild(createMetricCircle(item.page_count || 0, "metric-pages", "Pages Extracted"));
    metricsContainer.appendChild(createMetricCircle(item.likes || 0, "metric-likes", "Thumbs Up"));
    metricsContainer.appendChild(createMetricCircle(item.dislikes || 0, "metric-dislikes", "Thumbs Down"));
    
    result.appendChild(metricsContainer);

    const removeBtn = document.createElement("button");
    removeBtn.className = "btn-icon-only btn-secondary remove-btn";
    removeBtn.title = "Remove source";
    removeBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 14px; height: 14px;"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
    
    removeBtn.addEventListener("click", async () => {
      removeBtn.disabled = true;
      try {
        await callApi("/sources/delete", {
          method: "POST",
          body: JSON.stringify({ url: item.url })
        });
        result.remove();
      } catch(e) {
        setStatus(e.message);
        removeBtn.disabled = false;
      }
    });

    result.appendChild(removeBtn);
    fragment.appendChild(result);
  });
  
  container.appendChild(fragment);
}

async function handleListTodayClick(event) {
  const button = event.currentTarget;
  button.disabled = true;
  setStatus("Fetching today's articles...");
  renderResults([]);

  try {
    const data = await callApi("/today");
    setStatus(data.message || "Today's articles loaded.");
    if (data.articles) {
      const mapped = data.articles.map((a) => ({
        title: a.title,
        snippet: `Source: ${a.source}`,
        url: a.url
      }));
      renderResults(mapped);
    }
  } catch (error) {
    console.error(error);
    setStatus(`Unable to fetch today's articles: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

async function handleRefreshDbClick(event) {
  const button = event.currentTarget;
  button.disabled = true;
  setStatus("Reloading database...");
  renderResults([]);

  try {
    const data = await callApi("/refresh", { method: "POST" });
    setStatus(data.message || "Database reloaded.");
  } catch (error) {
    console.error(error);
    setStatus(`Unable to reload database: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

function renderResults(results = []) {
  const container = document.getElementById("results");
  if (!container) {
    return;
  }

  container.innerHTML = "";

  results.forEach((item) => {
    const result = document.createElement("article");
    result.className = "result";

    const title = document.createElement("h2");
    title.textContent = item.title || item.doc_name || "Result";
    result.appendChild(title);

    const snippet = document.createElement("p");
    snippet.className = "snippet";
    snippet.textContent =
      item.snippet ||
      item.chunk ||
      "No snippet available for this match.";
    result.appendChild(snippet);

    const resultUrl = item.url || item.source_url;
    if (resultUrl) {
      const link = document.createElement("a");
      link.href = resultUrl;
      link.textContent = "Open source";
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      result.appendChild(link);
    }

    container.appendChild(result);
  });
}

async function handleSearchClick() {
  const queryInput = document.getElementById("query");
  const button = document.getElementById("searchBtn");

  if (!queryInput || !button) {
    return;
  }

  const query = queryInput.value.trim();

  if (!query) {
    setStatus("Enter text to search for.");
    return;
  }

  button.disabled = true;
  setStatus("Searching your index...");

  try {
    const data = await callApi("/search", {
      method: "POST",
      body: JSON.stringify({ query, top_k: 3 })
    });

    const count = data.results?.length ?? 0;
    setStatus(`Search completed with ${count} result${count === 1 ? "" : "s"}.`);
    renderResults(data.results || []);
  } catch (error) {
    console.error(error);
    setStatus(`Search request failed: ${error.message}`);
  } finally {
    button.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const indexBtn = document.getElementById("indexBtn");
  const randomBlogBtn = document.getElementById("randomBlogBtn");
  const listTodayBtn = document.getElementById("listTodayBtn");
  const listSourcesBtn = document.getElementById("listSourcesBtn");
  const refreshDbBtn = document.getElementById("refreshDbBtn");
  const searchBtn = document.getElementById("searchBtn");
  const queryInput = document.getElementById("query");

  indexBtn.addEventListener("click", handleIndexClick);
  randomBlogBtn.addEventListener("click", handleRandomBlogClick);
  listTodayBtn.addEventListener("click", handleListTodayClick);
  listSourcesBtn.addEventListener("click", handleListSourcesClick);
  refreshDbBtn.addEventListener("click", handleRefreshDbClick);
  searchBtn.addEventListener("click", handleSearchClick);

  let searchTimeout = null;
  queryInput.addEventListener("input", (event) => {
    if (searchTimeout) clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (queryInput.value.trim()) {
        handleSearchClick();
      } else {
        renderResults([]);
        setStatus("Ready.");
      }
    }, 300);
  });

  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      if (searchTimeout) clearTimeout(searchTimeout);
      if (queryInput.value.trim()) handleSearchClick();
    }
  });

  const settingsToggleBtn = document.getElementById("settingsToggleBtn");
  const settingsPane = document.getElementById("settingsPane");
  const saveSettingsBtn = document.getElementById("saveSettingsBtn");
  const apiHostnameInput = document.getElementById("apiHostnameInput");

  settingsToggleBtn.addEventListener("click", () => {
    const isHidden = settingsPane.style.display === "none";
    settingsPane.style.display = isHidden ? "flex" : "none";
    if (isHidden) apiHostnameInput.value = API_BASE_URL;
  });

  saveSettingsBtn.addEventListener("click", () => {
    const newUrl = apiHostnameInput.value.trim();
    if (newUrl) {
      chrome.storage.local.set({ apiBaseUrl: newUrl });
      settingsPane.style.display = "none";
      setStatus("Settings saved.");
    }
  });

  const controlsWithTooltips = [
    indexBtn,
    randomBlogBtn,
    listTodayBtn,
    listSourcesBtn,
    refreshDbBtn,
    searchBtn,
    queryInput
  ];

  controlsWithTooltips.forEach((element) => {
    element.addEventListener("mouseenter", () => {
      if (element.title) {
        setStatus(element.title);
      }
    });

    element.addEventListener("focus", () => {
      if (element.title) {
        setStatus(element.title);
      }
    });
  });

  setStatus("Ready.");
  renderResults([]);
});
