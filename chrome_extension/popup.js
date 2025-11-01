const documents = [
  {
    name: "Sample Document",
    path: "documents/sample.txt"
  }
];

let currentIndex = [];

async function indexDocuments() {
  const indexBtn = document.getElementById("indexBtn");
  const status = document.getElementById("status");

  indexBtn.disabled = true;
  status.textContent = "Indexing documents...";

  try {
    const indexed = [];

    for (const doc of documents) {
      const url = chrome.runtime.getURL(doc.path);
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Failed to load ${doc.name}`);
      }

      const text = await response.text();
      const snippets = text
        .split(/\n+/)
        .map((chunk) => chunk.trim())
        .filter(Boolean);

      snippets.forEach((snippet, idx) => {
        indexed.push({
          doc: doc.name,
          id: `${doc.name}-${idx}`,
          snippet,
          lowerSnippet: snippet.toLowerCase()
        });
      });
    }

    currentIndex = indexed;
    await chrome.storage.local.set({ docIndex: indexed });

    status.textContent = `Indexed ${indexed.length} passages from ${documents.length} document(s).`;
  } catch (error) {
    console.error(error);
    status.textContent = `Indexing failed: ${error.message}`;
  } finally {
    indexBtn.disabled = false;
  }
}

async function restoreIndex() {
  const status = document.getElementById("status");
  const stored = await chrome.storage.local.get("docIndex");

  if (stored.docIndex && Array.isArray(stored.docIndex)) {
    currentIndex = stored.docIndex;
    status.textContent = `Loaded ${currentIndex.length} indexed passages from storage.`;
  }
}

async function openRandomBlog() {
  const status = document.getElementById("status");

  try {
    const stored = await chrome.storage.local.get("recentBlogs");
    const recentBlogs = Array.isArray(stored.recentBlogs)
      ? stored.recentBlogs
      : [];

    if (!recentBlogs.length) {
      status.textContent = "No recent blogs available yet.";
      return;
    }

    const randomEntry =
      recentBlogs[Math.floor(Math.random() * recentBlogs.length)];
    const candidateUrl =
      typeof randomEntry === "string" ? randomEntry : randomEntry?.url;

    if (!candidateUrl) {
      status.textContent = "Recent blog entry is missing a URL.";
      return;
    }

    await chrome.tabs.create({ url: candidateUrl });
    status.textContent = "Opened a recent blog in a new tab.";
  } catch (error) {
    console.error(error);
    status.textContent = `Unable to open a recent blog: ${error.message}`;
  }
}

function renderResults(results, query) {
  const container = document.getElementById("results");
  container.innerHTML = "";

  if (!results.length) {
    const empty = document.createElement("p");
    empty.textContent = "No matching passages. Try a different search.";
    container.appendChild(empty);
    return;
  }

  results.forEach((item) => {
    const result = document.createElement("article");
    result.className = "result";

    const title = document.createElement("h2");
    title.textContent = item.doc;
    result.appendChild(title);

    const snippet = document.createElement("p");
    snippet.className = "snippet";
    snippet.innerHTML = highlightQuery(item.snippet, query);
    result.appendChild(snippet);

    container.appendChild(result);
  });
}

function highlightQuery(text, query) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escaped})`, "ig");
  return text.replace(pattern, "<mark>$1</mark>");
}

function onSearch() {
  const queryInput = document.getElementById("query");
  const query = queryInput.value.trim();
  const status = document.getElementById("status");

  if (!currentIndex.length) {
    status.textContent = "Please index the documents first.";
    return;
  }

  if (!query) {
    status.textContent = "Enter text to search for.";
    return;
  }

  const lowered = query.toLowerCase();
  const results = currentIndex.filter((item) =>
    item.lowerSnippet.includes(lowered)
  );

  status.textContent = `Found ${results.length} matching passage(s).`;
  renderResults(results, query);
}

document.addEventListener("DOMContentLoaded", async () => {
  await restoreIndex();

  document.getElementById("indexBtn").addEventListener("click", indexDocuments);
  document
    .getElementById("randomBlogBtn")
    .addEventListener("click", openRandomBlog);
  document.getElementById("searchBtn").addEventListener("click", onSearch);
  document
    .getElementById("query")
    .addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        onSearch();
      }
    });
});
