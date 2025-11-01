const API_BASE_URL = "http://localhost:8000";

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

  try {
    const data = await callApi("/random-blog");
    setStatus(data.message || "Random blog retrieved.");

    if (data.url) {
      const openInCurrent = await chrome.storage.local.get("openBlogsInCurrent");
      const shouldOpenInCurrent =
        typeof openInCurrent.openBlogsInCurrent === "boolean"
          ? openInCurrent.openBlogsInCurrent
          : true;

      if (shouldOpenInCurrent) {
        await openTab(data.url);
      } else {
        await createTab(data.url);
      }
    }
  } catch (error) {
    console.error(error);
    setStatus(`Unable to fetch a random blog: ${error.message}`);
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
  const searchBtn = document.getElementById("searchBtn");
  const queryInput = document.getElementById("query");

  indexBtn.addEventListener("click", handleIndexClick);
  randomBlogBtn.addEventListener("click", handleRandomBlogClick);
  searchBtn.addEventListener("click", handleSearchClick);

  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSearchClick();
    }
  });

  const controlsWithTooltips = [
    indexBtn,
    randomBlogBtn,
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

  setStatus("No results yet. Not indexed yet.");
  renderResults([]);
});
