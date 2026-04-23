const state = {
  problems: [],
  filtered: [],
  activeId: null,
  viewMode: "browse",
  revealedAnswers: {},
  drafts: {},
  solveDrafts: {},
  mastery: {},
};

const heroStats = document.getElementById("hero-stats");
const categorySelect = document.getElementById("category-select");
const difficultySelect = document.getElementById("difficulty-select");
const viewModeSelect = document.getElementById("view-mode-select");
const searchInput = document.getElementById("search-input");
const problemList = document.getElementById("problem-list");
const detailPanel = document.getElementById("detail-panel");
const problemCount = document.getElementById("problem-count");

const STORAGE_KEYS = {
  drafts: "algoboard-practice-drafts",
  solveDrafts: "algoboard-solve-drafts",
  mastery: "algoboard-practice-mastery",
};

function difficultyClass(value) {
  return `difficulty-${value.toLowerCase()}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeDisplayText(value) {
  return value.replaceAll("\\n", "\n");
}

function loadStoredState() {
  try {
    state.drafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.drafts) || "{}");
    state.solveDrafts = JSON.parse(localStorage.getItem(STORAGE_KEYS.solveDrafts) || "{}");
    state.mastery = JSON.parse(localStorage.getItem(STORAGE_KEYS.mastery) || "{}");
  } catch {
    state.drafts = {};
    state.solveDrafts = {};
    state.mastery = {};
  }
}

function persistDrafts() {
  localStorage.setItem(STORAGE_KEYS.drafts, JSON.stringify(state.drafts));
}

function persistSolveDrafts() {
  localStorage.setItem(STORAGE_KEYS.solveDrafts, JSON.stringify(state.solveDrafts));
}

function persistMastery() {
  localStorage.setItem(STORAGE_KEYS.mastery, JSON.stringify(state.mastery));
}

function lineCount(value) {
  if (!value.trim()) {
    return 0;
  }
  return value.split(/\r?\n/).length;
}

function leadingWhitespace(value) {
  const match = value.match(/^\s*/);
  return match ? match[0] : "";
}

function extractVisibleScaffold(solution) {
  const lines = solution.split(/\r?\n/);
  const visible = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (visible.length && visible[visible.length - 1] !== "") {
        visible.push("");
      }
      continue;
    }

    if (trimmed.startsWith("class ")) {
      visible.push(line);
      continue;
    }

    if (trimmed.startsWith("def ")) {
      visible.push(line);
      continue;
    }

    if (trimmed.startsWith("async def ")) {
      visible.push(line);
      continue;
    }

    if (trimmed.startsWith('"""') || trimmed.startsWith("'''")) {
      break;
    }
  }

  return visible.join("\n").trimEnd();
}

function starterTemplate(problem) {
  const scaffold = extractVisibleScaffold(problem.solution);
  if (scaffold) {
    return `${scaffold}\n\n`;
  }
  return `# ${problem.id} ${problem.title}\n# まずは関数名・引数・返り値を思い出して書く\n\n`;
}

function solveTemplate(problem) {
  const scaffold = extractVisibleScaffold(problem.solution);
  if (scaffold) {
    return `${scaffold}\n    pass\n`;
  }
  return "";
}

function extractMethodSignatures(solution) {
  return solution
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("def ") || line.startsWith("async def "));
}

function hasSolvePrompt(problem) {
  return Boolean(problem.statement || problem.examples.length || problem.constraints.length);
}

function inferredStatement(problem) {
  const signatures = extractMethodSignatures(problem.solution);
  const signatureText = signatures.length
    ? `Target signature: ${signatures.join(" / ")}`
    : "Use the saved solution file as a reference for the expected function signature.";

  return [
    `${problem.title} を自力で解くモードです。`,
    `問題番号 #${problem.id}、カテゴリは ${problem.category}、主なタグは ${problem.tags.join(", ")} です。`,
    signatureText,
    "まずは入出力の形を整理して、制約を想定しながら最適なアルゴリズムを組み立ててください。",
  ].join("\n");
}

function inferredExamples(problem) {
  const signatures = extractMethodSignatures(problem.solution);
  if (!signatures.length) {
    return [
      "Input と Output を自分で仮定して、まず小さいケースを2つ作ってから実装してみましょう。",
    ];
  }

  return [
    `${signatures[0]}\nまずはこの関数シグネチャに合わせて、代表ケースを自分で 2〜3 個作って確認します。`,
  ];
}

function inferredConstraints(problem) {
  return [
    `カテゴリ: ${problem.category}`,
    `タグ: ${problem.tags.join(", ")}`,
    "まずは愚直解を考え、そのあと時間計算量と空間計算量を改善できるか確認します。",
  ];
}

function masteryLabel(problemId) {
  const status = state.mastery[problemId] || "unseen";
  const labels = {
    unseen: "未着手",
    shaky: "あやしい",
    memorized: "書けた",
  };
  return labels[status];
}

function masteryClass(problemId) {
  return `mastery-${state.mastery[problemId] || "unseen"}`;
}

function currentProblem() {
  return state.filtered.find((problem) => problem.id === state.activeId);
}

function renderStats(summary, categoryCounts) {
  const memorizedCount = Object.values(state.mastery).filter((value) => value === "memorized").length;
  const cards = [
    { label: "Problems", value: summary.problemCount },
    { label: "Categories", value: summary.categoryCount },
    { label: "Remembered", value: memorizedCount },
    { label: "Language", value: summary.language },
  ];

  heroStats.innerHTML = cards
    .map(
      (card) => `
        <div class="stat-card">
          <strong>${card.value}</strong>
          <span>${card.label}</span>
        </div>
      `,
    )
    .join("");
}

function populateCategories(categoryCounts) {
  Object.keys(categoryCounts).forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categorySelect.appendChild(option);
  });
}

function applyFilters() {
  const keyword = searchInput.value.trim().toLowerCase();
  const category = categorySelect.value;
  const difficulty = difficultySelect.value;

  state.filtered = state.problems.filter((problem) => {
    const matchesKeyword =
      !keyword ||
      problem.id.includes(keyword) ||
      problem.title.toLowerCase().includes(keyword) ||
      problem.tags.join(" ").toLowerCase().includes(keyword);
    const matchesCategory = category === "all" || problem.category === category;
    const matchesDifficulty = difficulty === "all" || problem.difficulty === difficulty;

    return matchesKeyword && matchesCategory && matchesDifficulty;
  });

  renderProblemList();

  if (!state.filtered.some((problem) => problem.id === state.activeId)) {
    state.activeId = state.filtered[0]?.id ?? null;
  }

  renderDetail();
}

function jumpToRandomProblem() {
  if (!state.filtered.length) {
    return;
  }
  const randomIndex = Math.floor(Math.random() * state.filtered.length);
  state.activeId = state.filtered[randomIndex].id;
  renderProblemList();
  renderDetail();
}

function renderProblemList() {
  problemCount.textContent = `${state.filtered.length} problems`;

  if (!state.filtered.length) {
    problemList.innerHTML = `
      <div class="problem-card">
        <h3>該当する問題がありません</h3>
        <p class="problem-path">検索条件を変えてみてください。</p>
      </div>
    `;
    return;
  }

  problemList.innerHTML = state.filtered
    .map(
      (problem) => `
        <button class="problem-card ${problem.id === state.activeId ? "active" : ""}" data-problem-id="${problem.id}">
          <div class="problem-card-header">
            <div>
              <div class="problem-id">#${problem.id}</div>
              <h3>${problem.title}</h3>
            </div>
            <span class="badge ${difficultyClass(problem.difficulty)}">${problem.difficulty}</span>
          </div>
          <div class="badge-row">
            <span class="badge">${problem.category}</span>
            <span class="badge">${problem.language}</span>
            <span class="badge ${masteryClass(problem.id)}">${masteryLabel(problem.id)}</span>
          </div>
          <div class="tag-row">
            ${problem.tags.slice(0, 3).map((tag) => `<span class="tag">${tag}</span>`).join("")}
          </div>
        </button>
      `,
    )
    .join("");

  problemList.querySelectorAll("[data-problem-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.activeId = button.dataset.problemId;
      renderProblemList();
      renderDetail();
    });
  });
}

function renderDetail() {
  const activeProblem = currentProblem();

  if (!activeProblem) {
    detailPanel.innerHTML = `
      <div class="empty-state">
        <p class="empty-kicker">No Match</p>
        <h2>表示できる問題がありません</h2>
        <p>検索条件を変更すると、ここに問題詳細が表示されます。</p>
      </div>
    `;
    return;
  }

  detailPanel.innerHTML = `
    <div class="detail-header">
      <div>
        <p class="eyebrow">Problem #${activeProblem.id}</p>
        <h2>${activeProblem.title}</h2>
        <p class="detail-meta">${activeProblem.category} · ${activeProblem.language} · ${activeProblem.path}</p>
      </div>
      <div class="detail-header-actions">
        ${activeProblem.sourceUrl ? `<a class="link-button" href="${activeProblem.sourceUrl}" target="_blank" rel="noreferrer">Open LeetCode</a>` : ""}
        <span class="badge ${difficultyClass(activeProblem.difficulty)}">${activeProblem.difficulty}</span>
      </div>
    </div>

    <section class="detail-section">
      <h3>Tags</h3>
      <div class="tag-row">
        ${activeProblem.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
      </div>
    </section>

    <section class="detail-section">
      <h3>Notes</h3>
      <p class="detail-notes">${activeProblem.notes || "必要なら problems_meta.json にメモを追記できます。"}</p>
    </section>
    ${
      state.viewMode === "practice"
        ? renderPracticePanel(activeProblem)
        : state.viewMode === "solve"
          ? renderSolvePanel(activeProblem)
          : renderBrowsePanel(activeProblem)
    }
  `;

  bindDetailEvents(activeProblem);
}

function renderBrowsePanel(problem) {
  return `
    <section class="detail-section">
      <h3>Solution</h3>
      <pre><code>${escapeHtml(problem.solution)}</code></pre>
    </section>
  `;
}

function renderPracticePanel(problem) {
  const revealed = Boolean(state.revealedAnswers[problem.id]);
  const draft = state.drafts[problem.id] || starterTemplate(problem);
  const solutionLines = lineCount(problem.solution);
  const draftLines = lineCount(draft);

  return `
    <section class="detail-section practice-panel">
      <div class="practice-header">
        <div>
          <h3>Practice</h3>
          <p class="detail-notes">答えを見ずに書いてから、最後にだけ正解を開く練習用モードです。</p>
        </div>
        <div class="practice-actions">
          <button class="action-button" data-action="random-problem">Random</button>
          <button class="action-button accent-button" data-action="toggle-answer">
            ${revealed ? "答えを隠す" : "答えを見る"}
          </button>
        </div>
      </div>

      <div class="practice-stack">
        <section class="practice-card">
          <div class="practice-card-head">
            <strong>自分で書く</strong>
            <span>${draftLines} lines</span>
          </div>
          <p class="detail-notes practice-hint"><code>class</code> と <code>def</code> だけ見える状態から、中身を手で埋める練習です。</p>
          <div class="editor-meta">
            <span>Python</span>
            <span>Tab: indent</span>
            <span>Shift+Tab: outdent</span>
          </div>
          <div class="editor-shell">
            <div id="practice-line-numbers" class="line-numbers" aria-hidden="true">${renderLineNumbers(draftLines)}</div>
            <textarea id="practice-editor" class="practice-editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${escapeHtml(draft)}</textarea>
          </div>
          <div class="practice-actions practice-actions-bottom">
            <button class="action-button" data-action="insert-template">テンプレを入れる</button>
            <button class="action-button" data-action="clear-draft">下書きを消す</button>
          </div>
        </section>

        <section class="practice-card">
          <div class="practice-card-head">
            <strong>正解コード</strong>
            <span>${solutionLines} lines</span>
          </div>
          ${
            revealed
              ? `<pre><code>${escapeHtml(problem.solution)}</code></pre>`
              : `<div class="answer-hidden">
                  <p>まだ非表示です。先に上のエディタで最後まで書いてみましょう。</p>
                  <p>書けたら「答えを見る」で下に正解を表示できます。</p>
                </div>`
          }
        </section>
      </div>

      <section class="detail-section practice-review">
        <h3>Self Check</h3>
        <p class="detail-notes">答えを見たあと、自分の状態を記録して次回の復習に使えます。</p>
        <div class="practice-actions">
          <button class="action-button mastery-button ${state.mastery[problem.id] === "shaky" ? "active" : ""}" data-action="mark-mastery" data-value="shaky">あやしい</button>
          <button class="action-button mastery-button ${state.mastery[problem.id] === "memorized" ? "active" : ""}" data-action="mark-mastery" data-value="memorized">書けた</button>
          <button class="action-button mastery-button ${state.mastery[problem.id] === "unseen" || !state.mastery[problem.id] ? "active" : ""}" data-action="mark-mastery" data-value="unseen">未着手に戻す</button>
        </div>
      </section>
    </section>
  `;
}

function renderExamples(problem) {
  const examples = problem.examples.length ? problem.examples : inferredExamples(problem);

  return examples
    .map(
      (example, index) => `
        <div class="prompt-card">
          <strong>Example ${index + 1}</strong>
          <pre><code>${escapeHtml(normalizeDisplayText(example))}</code></pre>
        </div>
      `,
    )
    .join("");
}

function renderConstraints(problem) {
  const constraints = problem.constraints.length ? problem.constraints : inferredConstraints(problem);

  return `
    <ul class="constraint-list">
      ${constraints.map((constraint) => `<li>${escapeHtml(constraint)}</li>`).join("")}
    </ul>
  `;
}

function renderSolvePanel(problem) {
  const revealed = Boolean(state.revealedAnswers[problem.id]);
  const draft = state.solveDrafts[problem.id] || solveTemplate(problem);
  const draftLines = lineCount(draft);
  const statementText = problem.statement ? normalizeDisplayText(problem.statement) : inferredStatement(problem);
  const statement = problem.statementHtml
    ? `<div class="leetcode-statement">${problem.statementHtml}</div>`
    : `<p class="detail-notes">${escapeHtml(statementText).replaceAll("\n", "<br />")}</p>`;
  const showDerivedSections = !problem.statementHtml;

  return `
    <section class="detail-section solve-panel">
      <div class="practice-header">
        <div>
          <h3>Solve</h3>
          <p class="detail-notes">
            問題文を見ながら、上から下へ流れる形で本番のつもりで解くモードです。
            ${hasSolvePrompt(problem) ? "" : "この問題は自動生成プロンプトで解けるようにしています。"}
          </p>
        </div>
        <div class="practice-actions">
          <button class="action-button" data-action="random-problem">Random</button>
          <button class="action-button accent-button" data-action="toggle-answer">
            ${revealed ? "解答を隠す" : "解答を見る"}
          </button>
        </div>
      </div>

      <section class="detail-section">
        <h3>Problem</h3>
        ${statement}
      </section>

      ${
        showDerivedSections
          ? `
      <section class="detail-section">
        <h3>Examples</h3>
        <div class="prompt-grid">
          ${renderExamples(problem)}
        </div>
      </section>

      <section class="detail-section">
        <h3>Constraints</h3>
        ${renderConstraints(problem)}
      </section>
      `
          : ""
      }

      <section class="detail-section practice-card">
        <div class="practice-card-head">
          <strong>解答を書く</strong>
          <span>${draftLines} lines</span>
        </div>
        <div class="editor-meta">
          <span>Python</span>
          <span>Tab: indent</span>
          <span>Shift+Tab: outdent</span>
        </div>
        <div class="editor-shell">
          <div id="solve-line-numbers" class="line-numbers" aria-hidden="true">${renderLineNumbers(draftLines)}</div>
          <textarea id="solve-editor" class="practice-editor" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off">${escapeHtml(draft)}</textarea>
        </div>
        <div class="practice-actions practice-actions-bottom">
          <button class="action-button" data-action="insert-solve-template">シグネチャを入れる</button>
          <button class="action-button" data-action="clear-solve-draft">解答を消す</button>
        </div>
      </section>

      <section class="detail-section practice-card">
        <div class="practice-card-head">
          <strong>参考解答</strong>
          <span>${lineCount(problem.solution)} lines</span>
        </div>
        ${
          revealed
            ? `<pre><code>${escapeHtml(problem.solution)}</code></pre>`
            : `<div class="answer-hidden">
                <p>まずは自分で解き切ってから、最後に参考解答を確認しましょう。</p>
                <p>必要なときだけ「解答を見る」で開けます。</p>
              </div>`
        }
      </section>
    </section>
  `;
}

function renderLineNumbers(totalLines) {
  return Array.from({ length: Math.max(totalLines, 1) }, (_, index) => `<span>${index + 1}</span>`).join("");
}

function updateEditorLineNumbers(editor, gutter) {
  if (!editor || !gutter) {
    return;
  }
  gutter.innerHTML = renderLineNumbers(lineCount(editor.value));
  gutter.scrollTop = editor.scrollTop;
}

function replaceSelection(editor, replacement, selectionStart, selectionEnd) {
  editor.setRangeText(replacement, selectionStart, selectionEnd, "end");
}

function indentSelectedLines(editor, outdent = false) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = value.indexOf("\n", end);
  const safeLineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
  const selectedBlock = value.slice(lineStart, safeLineEnd);
  const lines = selectedBlock.split("\n");

  const updatedLines = lines.map((line) => {
    if (!outdent) {
      return `    ${line}`;
    }
    if (line.startsWith("    ")) {
      return line.slice(4);
    }
    if (line.startsWith("\t")) {
      return line.slice(1);
    }
    return line.replace(/^ {1,3}/, "");
  });

  const replacement = updatedLines.join("\n");
  editor.setSelectionRange(lineStart, safeLineEnd);
  replaceSelection(editor, replacement, lineStart, safeLineEnd);

  const updatedEnd = lineStart + replacement.length;
  const updatedStart = outdent ? Math.max(lineStart, start - 4) : start + 4;
  editor.setSelectionRange(updatedStart, updatedEnd);
}

function handleEditorKeydown(event) {
  const editor = event.target;

  if (event.key === "Tab") {
    event.preventDefault();

    if (editor.selectionStart !== editor.selectionEnd) {
      indentSelectedLines(editor, event.shiftKey);
    } else if (event.shiftKey) {
      const lineStart = editor.value.lastIndexOf("\n", editor.selectionStart - 1) + 1;
      const currentLine = editor.value.slice(lineStart, editor.selectionStart);
      const removable = currentLine.startsWith("    ")
        ? 4
        : currentLine.startsWith("\t")
          ? 1
          : (currentLine.match(/^ {1,3}/) || [""])[0].length;

      if (removable > 0) {
        replaceSelection(editor, "", lineStart, lineStart + removable);
        const nextPosition = Math.max(lineStart, editor.selectionStart - removable);
        editor.setSelectionRange(nextPosition, nextPosition);
      }
    } else {
      replaceSelection(editor, "    ", editor.selectionStart, editor.selectionEnd);
    }

    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const start = editor.selectionStart;
    const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
    const currentLine = editor.value.slice(lineStart, start);
    const indent = leadingWhitespace(currentLine);
    const shouldIncreaseIndent = /:\s*$/.test(currentLine.trimEnd());
    const nextIndent = shouldIncreaseIndent ? `${indent}    ` : indent;

    replaceSelection(editor, `\n${nextIndent}`, editor.selectionStart, editor.selectionEnd);
    editor.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function bindDetailEvents(problem) {
  const practiceEditor = document.getElementById("practice-editor");
  const practiceLineNumbers = document.getElementById("practice-line-numbers");
  const solveEditor = document.getElementById("solve-editor");
  const solveLineNumbers = document.getElementById("solve-line-numbers");

  if (practiceEditor) {
    practiceEditor.addEventListener("input", (event) => {
      state.drafts[problem.id] = event.target.value;
      persistDrafts();
      updateEditorLineNumbers(practiceEditor, practiceLineNumbers);
    });
    practiceEditor.addEventListener("scroll", () => {
      updateEditorLineNumbers(practiceEditor, practiceLineNumbers);
    });
    practiceEditor.addEventListener("keydown", handleEditorKeydown);
    updateEditorLineNumbers(practiceEditor, practiceLineNumbers);
  }

  if (solveEditor) {
    solveEditor.addEventListener("input", (event) => {
      state.solveDrafts[problem.id] = event.target.value;
      persistSolveDrafts();
      updateEditorLineNumbers(solveEditor, solveLineNumbers);
    });
    solveEditor.addEventListener("scroll", () => {
      updateEditorLineNumbers(solveEditor, solveLineNumbers);
    });
    solveEditor.addEventListener("keydown", handleEditorKeydown);
    updateEditorLineNumbers(solveEditor, solveLineNumbers);
  }

  detailPanel.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", () => {
      const { action, value } = element.dataset;

      if (action === "toggle-answer") {
        state.revealedAnswers[problem.id] = !state.revealedAnswers[problem.id];
        renderDetail();
      }

      if (action === "random-problem") {
        jumpToRandomProblem();
      }

      if (action === "insert-template") {
        state.drafts[problem.id] = starterTemplate(problem);
        persistDrafts();
        renderDetail();
      }

      if (action === "clear-draft") {
        state.drafts[problem.id] = "";
        persistDrafts();
        renderDetail();
      }

      if (action === "insert-solve-template") {
        state.solveDrafts[problem.id] = solveTemplate(problem);
        persistSolveDrafts();
        renderDetail();
      }

      if (action === "clear-solve-draft") {
        state.solveDrafts[problem.id] = "";
        persistSolveDrafts();
        renderDetail();
      }

      if (action === "mark-mastery" && value) {
        state.mastery[problem.id] = value;
        persistMastery();
        renderStats(
          { problemCount: state.problems.length, categoryCount: new Set(state.problems.map((item) => item.category)).size, language: "Python" },
          state.problems.reduce((acc, item) => {
            acc[item.category] = (acc[item.category] || 0) + 1;
            return acc;
          }, {}),
        );
        renderProblemList();
        renderDetail();
      }
    });
  });
}

async function init() {
  const response = await fetch("./data/problems.json");
  const payload = await response.json();

  loadStoredState();
  state.problems = payload.problems;
  state.filtered = payload.problems;
  state.activeId = payload.problems[0]?.id ?? null;

  renderStats(payload.summary, payload.categoryCounts);
  populateCategories(payload.categoryCounts);
  renderProblemList();
  renderDetail();

  searchInput.addEventListener("input", applyFilters);
  categorySelect.addEventListener("change", applyFilters);
  difficultySelect.addEventListener("change", applyFilters);
  viewModeSelect.addEventListener("change", (event) => {
    state.viewMode = event.target.value;
    renderDetail();
  });
}

init().catch(() => {
  detailPanel.innerHTML = `
    <div class="empty-state">
      <p class="empty-kicker">Setup</p>
      <h2>データを読み込めませんでした</h2>
      <p><code>python generate_site.py</code> を実行してから、HTTP サーバー経由で開いてください。</p>
    </div>
  `;
});
