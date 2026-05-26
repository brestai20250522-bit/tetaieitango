(function () {
  "use strict";

  const WORDS = Array.isArray(window.KYOKUTAN_WORDS) ? window.KYOKUTAN_WORDS : [];
  const STEP_COUNT = 116;
  const APP_PASSWORD = "bretan";
  const AUTH_KEY = "kyokutan_auth_v1";
  const PROGRESS_KEY = "kyokutan_progress_v1";
  const COUNT_CHOICES = ["10", "20", "all"];
  const view = document.getElementById("view");
  const title = document.getElementById("screenTitle");
  const backButton = document.getElementById("backButton");

  const state = {
    screen: "login",
    navStack: [],
    stepIdx: 1,
    mode: null,
    source: null,
    rangeStart: 1,
    rangeEnd: 1,
    pickOpenStep: 1,
    pickedIds: new Set(),
    trainingSource: null,
    trainingWords: [],
    trainingCount: "10",
    quiz: null,
    answered: null,
    spell: null,
    lastSetup: null
  };

  function loadProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveProgress(progress) {
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
    } catch {
      // The app remains usable for the current session.
    }
  }

  function isLoggedIn() {
    try {
      return localStorage.getItem(AUTH_KEY) === "true";
    } catch {
      return false;
    }
  }

  function setLoggedIn() {
    try {
      localStorage.setItem(AUTH_KEY, "true");
    } catch {
      // Continue without persistent login if storage is unavailable.
    }
  }

  function navigate(screen, options = {}) {
    if (!options.replace && state.screen && state.screen !== screen) {
      state.navStack.push(state.screen);
    }
    state.screen = screen;
    render();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function goBack() {
    if (state.screen === "quiz" && !window.confirm("途中で終わりますか？進捗は保存されません。")) {
      return;
    }
    const previous = state.navStack.pop();
    if (previous) {
      state.screen = previous;
      render();
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }
    navigate("home", { replace: true });
  }

  function screenTitle() {
    const map = {
      login: "ログイン",
      home: "ホーム",
      lessons: "STEP選択",
      modeSelect: `STEP ${state.stepIdx}`,
      trainMenu: "特訓モード",
      trainAuto: "自動特訓",
      trainRange: "範囲特訓",
      trainPick: "個別ピック",
      trainSetup: "特訓設定",
      quiz: state.mode === "spell" ? "スペル構築" : "意味を選ぶ",
      result: "結果"
    };
    return map[state.screen] || "キョクタン英単語";
  }

  function render() {
    title.textContent = screenTitle();
    backButton.hidden = state.screen === "login" || state.screen === "home";
    const renderers = {
      login: renderLogin,
      home: renderHome,
      lessons: renderLessons,
      modeSelect: renderModeSelect,
      trainMenu: renderTrainMenu,
      trainAuto: renderTrainAuto,
      trainRange: renderTrainRange,
      trainPick: renderTrainPick,
      trainSetup: renderTrainSetup,
      quiz: renderQuiz,
      result: renderResult
    };
    renderers[state.screen]();
  }

  function renderLogin() {
    view.innerHTML = `
      <form class="login-form" id="loginForm">
        <label>
          パスワード
          <input id="passwordInput" type="password" autocomplete="current-password" required>
        </label>
        <p class="message" id="loginMessage"></p>
        <button class="primary-button" type="submit">入室</button>
      </form>
    `;
    document.getElementById("loginForm").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("passwordInput");
      const message = document.getElementById("loginMessage");
      if (input.value === APP_PASSWORD) {
        setLoggedIn();
        state.navStack = [];
        navigate("home", { replace: true });
        return;
      }
      message.textContent = "パスワードが違います。";
      input.select();
    });
  }

  function renderHome() {
    const stats = getStats();
    view.innerHTML = `
      <div class="stats-grid">
        <div class="stat"><strong>${stats.learned}</strong><span>学習した単語</span></div>
        <div class="stat"><strong>${stats.mastered}</strong><span>マスター済み</span></div>
        <div class="stat"><strong>${stats.completedSteps}</strong><span>完了STEP</span></div>
      </div>
      <div class="menu-grid">
        <button class="menu-button" id="lessonButton" type="button">
          <strong>通常STEP</strong>
          <span>教材のSTEP単位で進める</span>
        </button>
        <button class="menu-button" id="trainingButton" type="button">
          <strong>特訓モード</strong>
          <span>間違えた単語や選んだ単語を復習</span>
        </button>
      </div>
    `;
    document.getElementById("lessonButton").addEventListener("click", () => navigate("lessons"));
    document.getElementById("trainingButton").addEventListener("click", () => navigate("trainMenu"));
  }

  function getStats() {
    const progress = loadProgress();
    const learned = WORDS.filter((word) => {
      const row = progress[word.id];
      return row && ((row.m || 0) + (row.mw || 0) + (row.s || 0) + (row.sw || 0) > 0);
    }).length;
    const mastered = WORDS.filter((word) => isMastered(progress[word.id])).length;
    let completedSteps = 0;
    for (let step = 1; step <= STEP_COUNT; step += 1) {
      if (getStepWords(step).every((word) => isMastered(progress[word.id]))) completedSteps += 1;
    }
    return { learned, mastered, completedSteps };
  }

  function isMastered(row) {
    return Boolean(row && row.m > 0 && row.s > 0);
  }

  function getStepRange(step) {
    if (step <= 100) {
      return {
        start: (step - 1) * 12 + 1,
        end: step * 12
      };
    }
    return {
      start: 1200 + (step - 101) * 25 + 1,
      end: 1200 + (step - 100) * 25
    };
  }

  function getStepWords(step) {
    const { start, end } = getStepRange(step);
    return WORDS.filter((word) => word.id >= start && word.id <= end);
  }

  function renderLessons() {
    const progress = loadProgress();
    const lessons = [];
    for (let step = 1; step <= STEP_COUNT; step += 1) {
      const words = getStepWords(step);
      const { start, end } = getStepRange(step);
      const started = words.some((word) => progress[word.id]);
      const mastered = words.length > 0 && words.every((word) => isMastered(progress[word.id]));
      lessons.push(`
        <button class="lesson-button ${mastered ? "is-mastered" : started ? "is-started" : ""}" data-step="${step}" type="button">
          <strong>${step}</strong>
          <span>${start}-${end}</span>
          <small>${mastered ? "マスター済み" : started ? "進行中" : "未着手"}</small>
        </button>
      `);
    }
    view.innerHTML = `<div class="lesson-grid">${lessons.join("")}</div>`;
    view.querySelectorAll("[data-step]").forEach((button) => {
      button.addEventListener("click", () => {
        state.stepIdx = Number(button.dataset.step);
        navigate("modeSelect");
      });
    });
  }

  function renderModeSelect() {
    const { start, end } = getStepRange(state.stepIdx);
    view.innerHTML = `
      <div class="toolbar"><span class="pill">STEP ${state.stepIdx}</span><span class="pill">${start}-${end}</span></div>
      <div class="mode-grid">
        <button class="mode-button" data-mode="meaning" type="button">
          <strong>意味を選ぶ</strong>
          <span>英単語を見て和訳を選ぶ</span>
        </button>
        <button class="mode-button" data-mode="spell" type="button">
          <strong>スペルを組み立てる</strong>
          <span>和訳を見て英単語を作る</span>
        </button>
      </div>
    `;
    view.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        startQuiz(getStepWords(state.stepIdx), "lesson", button.dataset.mode);
      });
    });
  }

  function renderTrainMenu() {
    view.innerHTML = `
      <div class="menu-grid">
        <button class="menu-button" id="autoTraining" type="button"><strong>自動特訓</strong><span>間違い回数が多い順</span></button>
        <button class="menu-button" id="rangeTraining" type="button"><strong>STEP範囲特訓</strong><span>指定範囲の間違いだけ</span></button>
        <button class="menu-button" id="pickTraining" type="button"><strong>個別単語ピック</strong><span>自分で単語を選ぶ</span></button>
      </div>
    `;
    document.getElementById("autoTraining").addEventListener("click", () => navigate("trainAuto"));
    document.getElementById("rangeTraining").addEventListener("click", () => navigate("trainRange"));
    document.getElementById("pickTraining").addEventListener("click", () => navigate("trainPick"));
  }

  function renderTrainAuto() {
    const words = getAutoTrainingWords();
    view.innerHTML = `
      <div class="panel">
        <span class="pill">対象 ${words.length}語</span>
        ${words.length === 0 ? '<div class="empty-state">まだ間違えた問題がありません。</div>' : ""}
        <button class="primary-button" id="autoStart" type="button" ${words.length === 0 ? "disabled" : ""}>特訓を始める</button>
      </div>
    `;
    document.getElementById("autoStart").addEventListener("click", () => openTrainingSetup("auto", words));
  }

  function getAutoTrainingWords() {
    const progress = loadProgress();
    return WORDS
      .filter((word) => {
        const row = progress[word.id];
        return row && ((row.mw || 0) > 0 || (row.sw || 0) > 0);
      })
      .map((word) => ({ word, wrongCount: (progress[word.id].mw || 0) + (progress[word.id].sw || 0) }))
      .sort((a, b) => b.wrongCount - a.wrongCount || a.word.id - b.word.id)
      .map((item) => item.word);
  }

  function renderTrainRange() {
    const words = getRangeTrainingWords(state.rangeStart, state.rangeEnd);
    view.innerHTML = `
      <div class="panel">
        <div class="form-grid">
          <label class="range-label">開始<select id="rangeStart">${stepOptions(state.rangeStart)}</select></label>
          <label class="range-label">終了<select id="rangeEnd">${stepOptions(state.rangeEnd)}</select></label>
        </div>
        <span class="pill" id="rangeCount">対象 ${words.length}語</span>
        <div id="rangeEmpty">${words.length === 0 ? '<div class="empty-state">この範囲には間違いがありません。</div>' : ""}</div>
        <button class="primary-button" id="rangeStartButton" type="button" ${words.length === 0 ? "disabled" : ""}>この範囲で特訓</button>
      </div>
    `;
    const startSelect = document.getElementById("rangeStart");
    const endSelect = document.getElementById("rangeEnd");
    const rerender = () => {
      state.rangeStart = Number(startSelect.value);
      state.rangeEnd = Number(endSelect.value);
      if (state.rangeStart > state.rangeEnd) state.rangeEnd = state.rangeStart;
      renderTrainRange();
    };
    startSelect.addEventListener("change", rerender);
    endSelect.addEventListener("change", rerender);
    document.getElementById("rangeStartButton").addEventListener("click", () => {
      openTrainingSetup("range", getRangeTrainingWords(state.rangeStart, state.rangeEnd));
    });
  }

  function stepOptions(selected) {
    return Array.from({ length: STEP_COUNT }, (_, index) => {
      const value = index + 1;
      const { start, end } = getStepRange(value);
      return `<option value="${value}" ${value === selected ? "selected" : ""}>STEP ${value} (${start}-${end})</option>`;
    }).join("");
  }

  function getRangeTrainingWords(startStep, endStep) {
    const progress = loadProgress();
    const startId = getStepRange(startStep).start;
    const endId = getStepRange(endStep).end;
    return WORDS.filter((word) => {
      const row = progress[word.id];
      return word.id >= startId && word.id <= endId && row && ((row.mw || 0) > 0 || (row.sw || 0) > 0);
    });
  }

  function renderTrainPick() {
    const selectedWords = getWordsByIds(state.pickedIds);
    const stepWords = getStepWords(state.pickOpenStep);
    view.innerHTML = `
      <div class="picker-bar">
        <span class="pill">選択中 ${selectedWords.length}語</span>
        <button class="primary-button" id="pickedStart" type="button" ${selectedWords.length === 0 ? "disabled" : ""}>選んだ問題で特訓</button>
      </div>
      <div class="accordion">
        ${Array.from({ length: STEP_COUNT }, (_, i) => i + 1).map((step) => {
          const count = getStepWords(step).filter((word) => state.pickedIds.has(word.id)).length;
          const { start, end } = getStepRange(step);
          return `
            <button class="accordion-button" data-open="${step}" type="button">
              <strong>STEP ${step}</strong>
              <span>${start}-${end}${count ? ` / ${count}語選択` : ""}</span>
            </button>
            ${step === state.pickOpenStep ? renderPickLessonWords(stepWords) : ""}
          `;
        }).join("")}
      </div>
    `;
    view.querySelectorAll("[data-open]").forEach((button) => {
      button.addEventListener("click", () => {
        state.pickOpenStep = Number(button.dataset.open);
        renderTrainPick();
      });
    });
    view.querySelectorAll("[data-pick]").forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        const id = Number(checkbox.dataset.pick);
        if (checkbox.checked) state.pickedIds.add(id);
        else state.pickedIds.delete(id);
        renderTrainPick();
      });
    });
    document.getElementById("pickedStart").addEventListener("click", () => {
      openTrainingSetup("pick", getWordsByIds(state.pickedIds));
    });
  }

  function renderPickLessonWords(words) {
    return `<div class="stack-tight">${words.map((word) => `
      <label class="word-check">
        <input type="checkbox" data-pick="${word.id}" ${state.pickedIds.has(word.id) ? "checked" : ""}>
        <span><strong>${escapeHtml(word.w)}</strong><span>${escapeHtml(word.t)}</span></span>
      </label>
    `).join("")}</div>`;
  }

  function getWordsByIds(ids) {
    const set = ids instanceof Set ? ids : new Set(ids);
    return WORDS.filter((word) => set.has(word.id));
  }

  function openTrainingSetup(source, words) {
    state.trainingSource = source;
    state.trainingWords = [...words];
    state.trainingCount = "10";
    navigate("trainSetup");
  }

  function renderTrainSetup() {
    const total = state.trainingWords.length;
    view.innerHTML = `
      <div class="panel">
        <span class="pill">対象 ${total}語</span>
        <div class="stack-tight">
          <div class="range-label">出題数</div>
          <div class="segmented">
            ${COUNT_CHOICES.map((choice) => `
              <label>
                <input type="radio" name="trainingCount" value="${choice}" ${state.trainingCount === choice ? "checked" : ""}>
                <span>${choice === "all" ? "全部" : `${choice}語`}</span>
              </label>
            `).join("")}
          </div>
        </div>
        <div class="mode-grid">
          <button class="mode-button" data-mode="meaning" type="button"><strong>意味を選ぶ</strong><span>4択で復習</span></button>
          <button class="mode-button" data-mode="spell" type="button"><strong>スペルを組み立てる</strong><span>例文も確認</span></button>
        </div>
      </div>
    `;
    view.querySelectorAll("input[name='trainingCount']").forEach((radio) => {
      radio.addEventListener("change", () => {
        state.trainingCount = radio.value;
      });
    });
    view.querySelectorAll("[data-mode]").forEach((button) => {
      button.addEventListener("click", () => {
        const queue = limitTrainingWords(state.trainingWords, state.trainingCount);
        startQuiz(queue, state.trainingSource, button.dataset.mode);
      });
    });
  }

  function limitTrainingWords(words, count) {
    if (count === "all") return [...words];
    return words.slice(0, Math.min(Number(count), words.length));
  }

  function startQuiz(words, source, mode) {
    state.source = source;
    state.mode = mode;
    state.quiz = {
      words: [...words],
      index: 0,
      score: 0,
      wrongList: []
    };
    state.answered = null;
    state.spell = null;
    state.lastSetup = { words: [...words], source, mode };
    navigate("quiz");
  }

  function currentQuestion() {
    return state.quiz.words[state.quiz.index];
  }

  function renderQuiz() {
    const quiz = state.quiz;
    if (!quiz || quiz.words.length === 0) {
      view.innerHTML = '<div class="empty-state">出題できる単語がありません。</div>';
      return;
    }
    const word = currentQuestion();
    view.innerHTML = `
      <div class="quiz-meta"><span>${quiz.index + 1} / ${quiz.words.length}</span><span>${state.mode === "spell" ? "日→英" : "英→日"}</span></div>
      <div class="prompt-card">
        <span class="pos-tag">${escapeHtml(word.p || "品詞")}</span>
        <div class="prompt-text ${state.mode === "spell" ? "is-ja" : ""}">${escapeHtml(state.mode === "spell" ? word.t : word.w)}</div>
      </div>
      ${state.mode === "spell" ? renderSpellQuestion(word) : renderMeaningQuestion(word)}
      ${state.answered?.done ? renderFeedback(word) : ""}
    `;
    bindQuizEvents();
  }

  function renderMeaningQuestion(word) {
    const choices = state.answered?.choices || generateMeaningChoices(word);
    if (!state.answered) state.answered = { pending: true, choices };
    return `<div class="choice-list">${choices.map((choice) => `
      <button class="choice-button ${choice.id === state.answered.correctId ? "is-correct" : ""} ${choice.id === state.answered.wrongId ? "is-wrong" : ""}" data-choice="${choice.id}" type="button" ${state.answered.done ? "disabled" : ""}>
        ${escapeHtml(choice.t)}
      </button>
    `).join("")}</div>`;
  }

  function generateMeaningChoices(correctWord) {
    const samePos = WORDS.filter((word) => word.p === correctWord.p && word.id !== correctWord.id);
    let distractors = shuffle(samePos).slice(0, 3);
    if (distractors.length < 3) {
      const others = WORDS.filter((word) => word.p !== correctWord.p && word.id !== correctWord.id);
      distractors = distractors.concat(shuffle(others).slice(0, 3 - distractors.length));
    }
    return shuffle([correctWord, ...distractors]);
  }

  function renderSpellQuestion(word) {
    ensureSpellState(word);
    const selectedChars = state.spell.selected.map((id) => state.spell.pool.find((item) => item.id === id)?.ch || "");
    const slots = state.spell.hint ? Array.from({ length: Array.from(word.w).length }, (_, i) => selectedChars[i] || "") : selectedChars;
    return `
      <div class="spell-answer" aria-label="解答欄">
        ${slots.length === 0 ? '<button class="answer-slot is-empty" type="button" disabled>?</button>' : slots.map((ch, index) => {
          const status = state.answered?.slotStatus?.[index] || "";
          return `<button class="answer-slot ${ch ? "" : "is-empty"} ${status}" data-remove="${index}" type="button" ${state.answered?.done || !ch ? "disabled" : ""}>${escapeHtml(displayChar(ch))}</button>`;
        }).join("")}
      </div>
      <div class="letter-pool">
        ${state.spell.pool.map((item) => `
          <button class="letter-button" data-letter="${item.id}" type="button" ${state.spell.selected.includes(item.id) || state.answered?.done ? "disabled" : ""}>${escapeHtml(displayChar(item.ch))}</button>
        `).join("")}
      </div>
      <div class="quiz-actions">
        <button class="ghost-button" id="hintButton" type="button" ${state.spell.hint || state.answered?.done ? "disabled" : ""}>ヒント</button>
        <button class="ghost-button" id="clearButton" type="button" ${state.answered?.done ? "disabled" : ""}>クリア</button>
        <button class="primary-button" id="answerButton" type="button" ${canSubmitSpell(word) && !state.answered?.done ? "" : "disabled"}>こたえる</button>
      </div>
    `;
  }

  function ensureSpellState(word) {
    if (state.spell?.wordId === word.id) return;
    state.spell = {
      wordId: word.id,
      pool: generateLetterPool(word.w),
      selected: [],
      hint: false
    };
    state.answered = null;
  }

  function generateLetterPool(word) {
    const letters = Array.from(word).map((ch, index) => ({ id: `c${index}`, ch }));
    const used = new Set(Array.from(word.toLowerCase()));
    const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");
    const dummies = shuffle(alphabet.filter((ch) => !used.has(ch))).slice(0, 3).map((ch, index) => ({ id: `d${index}`, ch }));
    return shuffle([...letters, ...dummies]);
  }

  function displayChar(ch) {
    if (ch === " ") return "空白";
    return ch || "";
  }

  function canSubmitSpell(word) {
    if (!state.spell) return false;
    const selectedLength = state.spell.selected.length;
    if (state.spell.hint) return selectedLength === Array.from(word.w).length;
    return selectedLength > 0;
  }

  function bindQuizEvents() {
    if (state.mode === "meaning") {
      view.querySelectorAll("[data-choice]").forEach((button) => {
        button.addEventListener("click", () => answerMeaning(Number(button.dataset.choice)));
      });
    } else {
      view.querySelectorAll("[data-letter]").forEach((button) => {
        button.addEventListener("click", () => {
          state.spell.selected.push(button.dataset.letter);
          renderQuiz();
        });
      });
      view.querySelectorAll("[data-remove]").forEach((button) => {
        button.addEventListener("click", () => {
          state.spell.selected.splice(Number(button.dataset.remove), 1);
          renderQuiz();
        });
      });
      document.getElementById("hintButton")?.addEventListener("click", () => {
        state.spell.hint = true;
        renderQuiz();
      });
      document.getElementById("clearButton")?.addEventListener("click", () => {
        state.spell.selected = [];
        renderQuiz();
      });
      document.getElementById("answerButton")?.addEventListener("click", answerSpell);
    }
    document.getElementById("nextButton")?.addEventListener("click", nextQuestion);
  }

  function answerMeaning(choiceId) {
    const word = currentQuestion();
    const isCorrect = choiceId === word.id;
    finishAnswer(word, isCorrect, {
      correctId: word.id,
      wrongId: isCorrect ? null : choiceId,
      choices: state.answered.choices
    });
  }

  function answerSpell() {
    const word = currentQuestion();
    const answer = state.spell.selected.map((id) => state.spell.pool.find((item) => item.id === id)?.ch || "").join("");
    const correctLetters = Array.from(word.w);
    const answerLetters = Array.from(answer);
    const slotStatus = correctLetters.map((ch, index) => answerLetters[index] === ch ? "is-correct" : "is-wrong");
    finishAnswer(word, answer === word.w, { slotStatus, answer });
  }

  function finishAnswer(word, isCorrect, extra) {
    recordResult(word.id, state.mode, isCorrect);
    if (isCorrect) {
      state.quiz.score += 1;
    } else {
      state.quiz.wrongList.push(word);
    }
    state.answered = {
      ...state.answered,
      ...extra,
      done: true,
      isCorrect
    };
    renderQuiz();
  }

  function recordResult(wordId, mode, correct) {
    const progress = loadProgress();
    if (!progress[wordId]) progress[wordId] = { m: 0, mw: 0, s: 0, sw: 0 };
    const row = progress[wordId];
    if (mode === "meaning") {
      if (correct) {
        row.m = (row.m || 0) + 1;
        if (state.source !== "lesson") row.mw = 0;
      } else {
        row.mw = (row.mw || 0) + 1;
      }
    } else if (correct) {
      row.s = (row.s || 0) + 1;
      if (state.source !== "lesson") row.sw = 0;
    } else {
      row.sw = (row.sw || 0) + 1;
    }
    saveProgress(progress);
  }

  function renderFeedback(word) {
    const correctClass = state.answered.isCorrect ? "correct" : "wrong";
    const nextText = state.quiz.index + 1 >= state.quiz.words.length ? "結果を見る →" : "次の問題 →";
    const examples = state.mode === "spell" && word.examples?.length ? `
      <div class="example-list">
        ${word.examples.map((example) => `
          <div class="example-item">
            <p class="example-en">${highlightExample(example.en)}</p>
            ${example.ja ? `<p class="example-ja">${highlightExample(example.ja)}</p>` : ""}
          </div>
        `).join("")}
      </div>
    ` : "";
    return `
      <div class="feedback-card ${correctClass}">
        <p class="feedback-title ${correctClass}">${state.answered.isCorrect ? "◯ せいかい" : "× ふせいかい"}</p>
        <p class="answer-line"><strong>${escapeHtml(word.w)}</strong><br>${escapeHtml(word.t)}</p>
        ${examples}
        <button class="primary-button" id="nextButton" type="button">${nextText}</button>
      </div>
    `;
  }

  function nextQuestion() {
    state.quiz.index += 1;
    state.answered = null;
    state.spell = null;
    if (state.quiz.index >= state.quiz.words.length) {
      navigate("result");
      return;
    }
    renderQuiz();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function renderResult() {
    const quiz = state.quiz;
    const percent = Math.round((quiz.score / quiz.words.length) * 100);
    const message = percent === 100 ? "完璧です" : percent >= 80 ? "よくできました" : percent >= 60 ? "もう少し" : "もう一度復習しよう";
    const missed = [...new Map(quiz.wrongList.map((word) => [word.id, word])).values()];
    view.innerHTML = `
      <div class="result-card">
        <p class="score">${quiz.score}/${quiz.words.length}</p>
        <p class="result-message">${message}</p>
        <span class="pill">正答率 ${percent}%</span>
      </div>
      <div class="stack" style="margin-top:14px">
        <h2 class="range-label">間違えた単語</h2>
        <div class="missed-list">
          ${missed.length ? missed.map((word) => `<div class="missed-item"><strong>${escapeHtml(word.w)}</strong><span>${escapeHtml(word.t)}</span></div>`).join("") : '<div class="empty-state">なし</div>'}
        </div>
      </div>
      <div class="result-actions">
        <button class="secondary-button" id="retryButton" type="button">もう一度</button>
        <button class="primary-button" id="homeButton" type="button">メニューへ</button>
      </div>
    `;
    document.getElementById("retryButton").addEventListener("click", () => {
      startQuiz(state.lastSetup.words, state.lastSetup.source, state.lastSetup.mode);
    });
    document.getElementById("homeButton").addEventListener("click", () => {
      state.navStack = [];
      navigate(state.source === "lesson" ? "lessons" : "home", { replace: true });
    });
  }

  function shuffle(items) {
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function highlightExample(value) {
    return escapeHtml(value).replace(/＜([^＜＞]+)＞/g, '<span class="example-mark">$1</span>');
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    });
  }

  backButton.addEventListener("click", goBack);
  registerServiceWorker();
  navigate(isLoggedIn() ? "home" : "login", { replace: true });
})();
