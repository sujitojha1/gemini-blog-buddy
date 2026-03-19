const API_BASE_URL = "http://localhost:8000";
const STORAGE_KEY = "lastBlogInteraction";

async function submitFeedbackIfPending() {
  try {
    const data = await chrome.storage.local.get(STORAGE_KEY);
    const interaction = data[STORAGE_KEY];
    
    if (interaction && interaction.source_url) {
      const timeElapsed = Date.now() - interaction.timestamp;
      const isLike = timeElapsed > 20000;
      
      await callApi("/feedback", {
        method: "POST",
        body: JSON.stringify({ url: interaction.source_url, is_like: isLike })
      }).catch(console.error);
      
      await chrome.storage.local.remove(STORAGE_KEY);
    }
  } catch (e) {
    console.error("Feedback error", e);
  }
}


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
  
  await submitFeedbackIfPending();

  try {
    const data = await callApi("/random-blog");
    setStatus(data.message || "Random blog retrieved.");

    if (data.url) {
      if (data.source_url) {
        await chrome.storage.local.set({
          [STORAGE_KEY]: { source_url: data.source_url, timestamp: Date.now() }
        });
      }

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

function renderSources(sources = []) {
  const container = document.getElementById("results");
  if (!container) return;
  container.innerHTML = "";

  const addForm = document.createElement("div");
  addForm.style.marginBottom = "14px";
  addForm.style.display = "flex";
  addForm.style.flexDirection = "column";
  addForm.style.gap = "8px";
  
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.placeholder = "Source Name";
  nameInput.style.padding = "8px";
  nameInput.style.fontSize = "13px";
  nameInput.style.borderRadius = "6px";
  nameInput.style.border = "1px solid #cbd5e1";
  nameInput.style.boxSizing = "border-box";
  
  const urlInput = document.createElement("input");
  urlInput.type = "text";
  urlInput.placeholder = "URL";
  urlInput.style.padding = "8px";
  urlInput.style.fontSize = "13px";
  urlInput.style.borderRadius = "6px";
  urlInput.style.border = "1px solid #cbd5e1";
  urlInput.style.boxSizing = "border-box";

  const addBtn = document.createElement("button");
  addBtn.textContent = "Add Source";
  addBtn.className = "btn btn-primary";
  addBtn.style.padding = "8px 14px";
  addBtn.style.fontSize = "13px";
  addBtn.style.borderRadius = "6px";
  addBtn.style.justifyContent = "center";
  
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
  container.appendChild(addForm);

  sources.forEach((item) => {
    const result = document.createElement("article");
    result.className = "result";
    result.style.display = "flex";
    result.style.alignItems = "center";
    result.style.gap = "8px";
    result.style.padding = "10px";

    const content = document.createElement("div");
    content.style.flex = "1";
    
    const title = document.createElement("h2");
    title.textContent = `${item.name} (${item.page_count}, ${item.likes}, ${item.dislikes})`;
    title.style.margin = "0 0 4px";
    title.style.fontSize = "13px";
    
    const link = document.createElement("a");
    link.href = item.url;
    link.textContent = item.url;
    link.style.fontSize = "11px";
    link.style.display = "block";
    link.style.wordBreak = "break-all";

    content.appendChild(title);
    content.appendChild(link);
    result.appendChild(content);

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.className = "btn btn-secondary";
    removeBtn.style.flex = "none";
    removeBtn.style.padding = "6px 10px";
    removeBtn.style.fontSize = "11px";
    removeBtn.style.borderRadius = "6px";
    
    removeBtn.addEventListener("click", async () => {
      removeBtn.disabled = true;
      try {
        await callApi("/sources/delete", {
          method: "POST",
          body: JSON.stringify({ url: item.url })
        });
        document.getElementById("listSourcesBtn").click();
      } catch(e) {
        setStatus(e.message);
        removeBtn.disabled = false;
      }
    });

    result.appendChild(removeBtn);
    container.appendChild(result);
  });
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

  queryInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      handleSearchClick();
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
