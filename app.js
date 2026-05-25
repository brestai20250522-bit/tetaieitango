(function () {
  "use strict";

  const AUTO_NEXT_MS = 800;
  const APP_PASSWORD = "tetaitan";
  const AUTH_KEY = "brest-vocab-authenticated";
  const SELECTED_KEY = "brest-vocab-selected-ids";
  const MISSED_KEY = "brest-vocab-missed-ids";
  const APP_TITLE = "BREST　テ対英単語アプリ";
  const VOCAB = Array.isArray(window.VOCAB_DATA) ? window.VOCAB_DATA : [];

  const screens = {
    login: document.getElementById("loginScreen"),
    select: document.getElementById("selectScreen"),
    miss: document.getElementById("missScreen"),
    quiz: document.getElementById("quizScreen"),
    result: document.getElementById("resultScreen"),
  };

  const els = {
    title: document.getElementById("screenTitle"),
    titleAlert: document.getElementById("titleAlert"),
    eyebrow: document.getElementById("eyebrow"),
    back: document.getElementById("backButton"),
    loginForm: document.getElementById("loginForm"),
    passwordInput: document.getElementById("passwordInput"),
    loginMessage: document.getElementById("loginMessage"),
    wordSearch: document.getElementById("wordSearch"),
    selectedCount: document.getElementById("selectedCount"),
    visibleCount: document.getElementById("visibleCount"),
    selectMessage: document.getElementById("selectMessage"),
    wordList: document.getElementById("wordList"),
    selectVisible: document.getElementById("selectVisibleButton"),
    clearSelection: document.getElementById("clearSelectionButton"),
    startSelected: document.getElementById("startSelectedButton"),
    missListButton: document.getElementById("missListButton"),
    missCount: document.getElementById("missCount"),
    missMessage: document.getElementById("missMessage"),
    missWordList: document.getElementById("missWordList"),
    clearMiss: document.getElementById("clearMissButton"),
    startMiss: document.getElementById("startMissButton"),
    progress: document.getElementById("quizProgress"),
    promptLabel: document.getElementById("promptLabel"),
    promptText: document.getElementById("promptText"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("answerFeedback"),
    resultText: document.getElementById("resultText"),
    sessionMissList: document.getElementById("sessionMissList"),
    retry: document.getElementById("retryButton"),
    home: document.getElementById("homeButton"),
  };

  const state = {
    screen: "login",
    selectedIds: loadSet(SELECTED_KEY),
    quiz: null,
    lastSetup: null,
    visibleItems: [],
    locked: false,
    timer: 0,
  };

  function loadSet(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "[]");
      return new Set(Array.isArray(value) ? value : []);
    } catch {
      return new Set();
    }
  }

  function saveSet(key, ids) {
    try {
      localStorage.setItem(key, JSON.stringify([...ids]));
    } catch {
      // Continue without persistent storage.
    }
  }

  function isAuthenticated() {
    try {
      return localStorage.getItem(AUTH_KEY) === "true";
    } catch {
      return false;
    }
  }

  function setAuthenticated() {
    try {
      localStorage.setItem(AUTH_KEY, "true");
    } catch {
      // Continue for this session even if browser storage is unavailable.
    }
  }

  function setScreen(name) {
    Object.entries(screens).forEach(([key, screen]) => {
      screen.classList.toggle("is-active", key === name);
    });
    state.screen = name;
    els.back.hidden = name === "login" || name === "select";
    updateHeader(name);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function updateHeader(screen) {
    els.eyebrow.textContent = APP_TITLE;
    els.titleAlert.textContent = "";
    const titles = {
      login: "パスワード入力",
      select: "単語を選択",
      miss: "ミスリスト",
      quiz: "4択演習",
      result: "終了",
    };
    els.title.textContent = titles[screen];
  }

  function goBack() {
    clearPendingTimer();
    if (state.screen === "miss") {
      renderSelectList();
      setScreen("select");
    } else if (state.screen === "quiz") {
      if (state.quiz?.source === "miss") {
        renderMissList();
        setScreen("miss");
      } else {
        renderSelectList();
        setScreen("select");
      }
    } else if (state.screen === "result") {
      renderSelectList();
      setScreen("select");
    }
  }

  function handleLogin(event) {
    event.preventDefault();
    if (els.passwordInput.value === APP_PASSWORD) {
      setAuthenticated();
      els.loginMessage.textContent = "";
      els.passwordInput.value = "";
      renderSelectList();
      setScreen("select");
      return;
    }
    els.loginMessage.textContent = "パスワードが違います。";
    els.passwordInput.select();
  }

  function currentLevelFilter() {
    return document.querySelector("input[name='levelFilter']:checked")?.value || "all";
  }

  function currentDirection() {
    return document.querySelector("input[name='direction']:checked")?.value || "en-ja";
  }

  function currentQuizCount() {
    return document.querySelector("input[name='quizCount']:checked")?.value || "10";
  }

  function levelLabel(level) {
    const labels = { J1: "J1目安", J2: "J2目安", J3: "J3目安" };
    return labels[level] || level;
  }

  function matchesSearch(item, query) {
    if (!query) return true;
    const text = `${item.level} ${item.word} ${item.meaning} ${item.pos || ""}`.toLowerCase();
    return text.includes(query);
  }

  function getFilteredItems() {
    const level = currentLevelFilter();
    const query = els.wordSearch.value.trim().toLowerCase();
    return VOCAB.filter((item) => (level === "all" || item.level === level) && matchesSearch(item, query));
  }

  function renderSelectList() {
    const items = getFilteredItems();
    state.visibleItems = items;
    els.wordList.innerHTML = "";
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const label = document.createElement("label");
      label.className = "word-item";
      label.innerHTML = `
        <input type="checkbox" ${state.selectedIds.has(item.id) ? "checked" : ""}>
        <span class="level-badge">${levelLabel(item.level)}</span>
        <span class="word-main">
          <strong>${escapeHtml(item.word)}</strong>
          <small>${escapeHtml(item.meaning)}</small>
        </span>
      `;
      const checkbox = label.querySelector("input");
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.selectedIds.add(item.id);
        } else {
          state.selectedIds.delete(item.id);
        }
        saveSet(SELECTED_KEY, state.selectedIds);
        updateSelectionMeta();
      });
      fragment.append(label);
    }
    els.wordList.append(fragment);
    if (items.length === 0) {
      els.wordList.innerHTML = '<div class="empty-state">該当する単語がありません。</div>';
    }
    updateSelectionMeta();
  }

  function updateSelectionMeta() {
    els.selectedCount.textContent = `${state.selectedIds.size}語選択`;
    els.visibleCount.textContent = `${state.visibleItems.length}語表示`;
    els.startSelected.disabled = state.selectedIds.size < 4;
    els.selectMessage.textContent =
      state.selectedIds.size < 4 ? "4択演習には4語以上選択してください。" : "";
  }

  function selectVisibleItems() {
    for (const item of state.visibleItems) {
      state.selectedIds.add(item.id);
    }
    saveSet(SELECTED_KEY, state.selectedIds);
    renderSelectList();
  }

  function clearSelection() {
    state.selectedIds.clear();
    saveSet(SELECTED_KEY, state.selectedIds);
    renderSelectList();
  }

  function getItemsByIds(ids) {
    const idSet = ids instanceof Set ? ids : new Set(ids);
    return VOCAB.filter((item) => idSet.has(item.id));
  }

  function getMissedIds() {
    return loadSet(MISSED_KEY);
  }

  function addMissed(item) {
    const missed = getMissedIds();
    missed.add(item.id);
    saveSet(MISSED_KEY, missed);
  }

  function renderMissList() {
    const missed = getMissedIds();
    const items = getItemsByIds(missed);
    els.missCount.textContent = `${items.length}語`;
    els.startMiss.disabled = items.length < 4;
    els.missMessage.textContent = items.length < 4 ? "ミスリスト演習には4語以上必要です。" : "";
    els.missWordList.innerHTML = "";
    if (items.length === 0) {
      els.missWordList.innerHTML = '<div class="empty-state">まだミスした単語はありません。</div>';
      return;
    }
    const fragment = document.createDocumentFragment();
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "word-item word-item-static";
      row.innerHTML = `
        <span class="level-badge">${levelLabel(item.level)}</span>
        <span class="word-main">
          <strong>${escapeHtml(item.word)}</strong>
          <small>${escapeHtml(item.meaning)}</small>
        </span>
        <button class="remove-button" type="button" aria-label="削除">×</button>
      `;
      row.querySelector("button").addEventListener("click", () => {
        const next = getMissedIds();
        next.delete(item.id);
        saveSet(MISSED_KEY, next);
        renderMissList();
      });
      fragment.append(row);
    }
    els.missWordList.append(fragment);
  }

  function clearMissList() {
    saveSet(MISSED_KEY, new Set());
    renderMissList();
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function normalizeAnswer(item, direction) {
    return direction === "en-ja" ? item.meaning : item.word;
  }

  function buildChoices(question, pool, direction) {
    const correct = normalizeAnswer(question, direction);
    const poolAnswers = pool.map((item) => normalizeAnswer(item, direction)).filter((value) => value !== correct);
    const fallbackAnswers = VOCAB.map((item) => normalizeAnswer(item, direction)).filter((value) => value !== correct);
    const unique = [...new Set([...poolAnswers, ...fallbackAnswers])];
    return shuffle([correct, ...shuffle(unique).slice(0, 3)]);
  }

  function startQuiz(items, source) {
    if (items.length < 4) return;
    const direction = currentDirection();
    const count = currentQuizCount();
    const questionCount = count === "all" ? items.length : Math.min(Number(count), items.length);
    const questions = shuffle(items).slice(0, questionCount);
    state.lastSetup = { items, source };
    state.quiz = {
      source,
      direction,
      items,
      questions,
      index: 0,
      missed: [],
    };
    setScreen("quiz");
    renderQuestion();
  }

  function startSelectedQuiz() {
    const items = getItemsByIds(state.selectedIds);
    if (items.length < 4) {
      updateSelectionMeta();
      return;
    }
    startQuiz(items, "selected");
  }

  function startMissQuiz() {
    const items = getItemsByIds(getMissedIds());
    if (items.length < 4) {
      renderMissList();
      return;
    }
    startQuiz(items, "miss");
  }

  function renderQuestion() {
    clearPendingTimer();
    state.locked = false;
    const quiz = state.quiz;
    const question = quiz.questions[quiz.index];
    els.progress.textContent = `${quiz.index + 1} / ${quiz.questions.length}`;
    els.promptLabel.textContent = quiz.direction === "en-ja" ? "英単語" : "意味";
    els.promptText.textContent = quiz.direction === "en-ja" ? question.word : question.meaning;
    els.feedback.textContent = "";
    els.feedback.className = "answer-feedback";
    els.choices.innerHTML = "";
    for (const choice of buildChoices(question, quiz.items, quiz.direction)) {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.type = "button";
      button.textContent = choice;
      button.addEventListener("click", () => answerQuestion(button, choice));
      els.choices.append(button);
    }
  }

  function answerQuestion(button, selected) {
    if (state.locked) return;
    state.locked = true;
    const quiz = state.quiz;
    const question = quiz.questions[quiz.index];
    const correct = normalizeAnswer(question, quiz.direction);
    const isCorrect = selected === correct;
    const buttons = [...els.choices.querySelectorAll("button")];
    buttons.forEach((choiceButton) => {
      choiceButton.disabled = true;
      if (choiceButton.textContent === correct) {
        choiceButton.classList.add("is-correct");
      }
    });

    if (isCorrect) {
      els.feedback.textContent = "正解";
      els.feedback.classList.add("correct");
    } else {
      button.classList.add("is-wrong");
      quiz.missed.push(question);
      addMissed(question);
      els.feedback.textContent = `正解: ${correct}`;
      els.feedback.classList.add("wrong");
    }

    state.timer = window.setTimeout(() => {
      quiz.index += 1;
      if (quiz.index >= quiz.questions.length) {
        renderResult();
      } else {
        renderQuestion();
      }
    }, AUTO_NEXT_MS);
  }

  function renderResult() {
    clearPendingTimer();
    const missedUnique = [...new Map(state.quiz.missed.map((item) => [item.id, item])).values()];
    els.resultText.textContent =
      missedUnique.length === 0
        ? "今回ミスした単語はありません。"
        : `${missedUnique.length}語をミスリストに追加しました。`;
    els.sessionMissList.innerHTML = "";
    if (missedUnique.length === 0) {
      els.sessionMissList.innerHTML = '<div class="empty-state">なし</div>';
    } else {
      for (const item of missedUnique) {
        const div = document.createElement("div");
        div.className = "missed-item";
        div.innerHTML = `<strong>${escapeHtml(item.word)}</strong><br><span>${escapeHtml(item.meaning)}</span>`;
        els.sessionMissList.append(div);
      }
    }
    setScreen("result");
  }

  function retryLastQuiz() {
    if (state.lastSetup) {
      startQuiz(state.lastSetup.items, state.lastSetup.source);
    }
  }

  function clearPendingTimer() {
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = 0;
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bindEvents() {
    els.back.addEventListener("click", goBack);
    els.loginForm.addEventListener("submit", handleLogin);
    els.wordSearch.addEventListener("input", renderSelectList);
    document.querySelectorAll("input[name='levelFilter']").forEach((input) => {
      input.addEventListener("change", renderSelectList);
    });
    els.selectVisible.addEventListener("click", selectVisibleItems);
    els.clearSelection.addEventListener("click", clearSelection);
    els.startSelected.addEventListener("click", startSelectedQuiz);
    els.missListButton.addEventListener("click", () => {
      renderMissList();
      setScreen("miss");
    });
    els.clearMiss.addEventListener("click", clearMissList);
    els.startMiss.addEventListener("click", startMissQuiz);
    els.retry.addEventListener("click", retryLastQuiz);
    els.home.addEventListener("click", () => {
      renderSelectList();
      setScreen("select");
    });
  }

  bindEvents();
  if (isAuthenticated()) {
    renderSelectList();
    setScreen("select");
  } else {
    setScreen("login");
  }
})();
