(function () {
  "use strict";

  const AUTO_NEXT_MS = 800;
  const VOCAB = Array.isArray(window.VOCAB_DATA) ? window.VOCAB_DATA : [];
  const WEAK_LISTS = [
    { id: "auto", label: "ランダム特訓ミス", type: "auto" },
    { id: "manual-1", label: "自分で選ぶリスト1", type: "manual" },
    { id: "manual-2", label: "自分で選ぶリスト2", type: "manual" },
  ];

  const screens = {
    grade: document.getElementById("gradeScreen"),
    mode: document.getElementById("modeScreen"),
    rangeSetup: document.getElementById("rangeSetupScreen"),
    weakMenu: document.getElementById("weakMenuScreen"),
    weakSetup: document.getElementById("weakSetupScreen"),
    quiz: document.getElementById("quizScreen"),
    result: document.getElementById("resultScreen"),
  };

  const els = {
    title: document.getElementById("screenTitle"),
    titleAlert: document.getElementById("titleAlert"),
    eyebrow: document.getElementById("eyebrow"),
    back: document.getElementById("backButton"),
    gradeButtons: document.getElementById("gradeButtons"),
    rangeMode: document.getElementById("rangeModeButton"),
    weakMode: document.getElementById("weakModeButton"),
    rangeForm: document.getElementById("rangeForm"),
    rangeSlots: document.getElementById("rangeSlots"),
    saveRange: document.getElementById("saveRangeButton"),
    toggleRangeList: document.getElementById("toggleRangeListButton"),
    rangeListPanel: document.getElementById("rangeListPanel"),
    rangePickStatus: document.getElementById("rangePickStatus"),
    resetRangePick: document.getElementById("resetRangePickButton"),
    rangeWordList: document.getElementById("rangeWordList"),
    startNo: document.getElementById("startNo"),
    endNo: document.getElementById("endNo"),
    rangeMessage: document.getElementById("rangeMessage"),
    weakMenuList: document.getElementById("weakMenuList"),
    weakSearch: document.getElementById("weakSearch"),
    weakList: document.getElementById("weakList"),
    weakCount: document.getElementById("weakCount"),
    weakMessage: document.getElementById("weakMessage"),
    startWeakQuiz: document.getElementById("startWeakQuizButton"),
    progress: document.getElementById("quizProgress"),
    score: document.getElementById("quizScore"),
    promptLabel: document.getElementById("promptLabel"),
    promptText: document.getElementById("promptText"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("answerFeedback"),
    resultScore: document.getElementById("resultScore"),
    resultRate: document.getElementById("resultRate"),
    missedList: document.getElementById("missedList"),
    retry: document.getElementById("retryButton"),
    home: document.getElementById("homeButton"),
  };

  const state = {
    screen: "grade",
    selectedGrade: "",
    selectedWeakList: WEAK_LISTS[0],
    lastSetup: null,
    quiz: null,
    locked: false,
    timer: 0,
    rangePickStep: "start",
  };

  const gradeOrder = ["中学1年生", "中学2年生", "中学3年生"];
  const grades = [...new Set(VOCAB.map((item) => item.grade))].sort(
    (a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b)
  );

  function weakKey(listId = state.selectedWeakList.id, grade = state.selectedGrade) {
    return `vocab-weak-ids:${grade}:${listId}`;
  }

  function rangeKey(grade = state.selectedGrade) {
    return `vocab-range-slots:${grade}`;
  }

  function getGradeItems() {
    return VOCAB.filter((item) => item.grade === state.selectedGrade);
  }

  function getWeakIds(listId = state.selectedWeakList.id) {
    try {
      const value = JSON.parse(localStorage.getItem(weakKey(listId)) || "[]");
      return new Set(Array.isArray(value) ? value : []);
    } catch {
      return new Set();
    }
  }

  function saveWeakIds(ids, listId = state.selectedWeakList.id) {
    localStorage.setItem(weakKey(listId), JSON.stringify([...ids]));
  }

  function getRangeSlots() {
    try {
      const slots = JSON.parse(localStorage.getItem(rangeKey()) || "[]");
      return Array.from({ length: 3 }, (_, index) => slots[index] || null);
    } catch {
      return [null, null, null];
    }
  }

  function saveRangeSlots(slots) {
    localStorage.setItem(rangeKey(), JSON.stringify(slots));
  }

  function setScreen(name) {
    Object.entries(screens).forEach(([key, screen]) => {
      screen.classList.toggle("is-active", key === name);
    });
    state.screen = name;
    els.back.hidden = name === "grade";
    updateHeader(name);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function updateHeader(screen) {
    const gradeText = state.selectedGrade || "BREST　テ対英単語アプリ";
    els.eyebrow.textContent =
      screen === "weakSetup" ? `${gradeText} / ${state.selectedWeakList.label}` : gradeText;
    els.titleAlert.textContent = "";
    const titles = {
      grade: "学年を選択",
      mode: "特訓メニュー",
      rangeSetup: "範囲ランダム特訓",
      weakMenu: "苦手特訓",
      weakSetup:
        state.selectedWeakList.type === "manual" ? "苦手単語を選択" : state.selectedWeakList.label,
      quiz: "4択テスト",
      result: "結果",
    };
    els.title.textContent = titles[screen];
  }

  function goBack() {
    clearPendingTimer();
    if (state.screen === "mode") {
      state.selectedGrade = "";
      setScreen("grade");
    } else if (state.screen === "rangeSetup" || state.screen === "weakMenu") {
      setScreen("mode");
    } else if (state.screen === "weakSetup") {
      renderWeakMenu();
      setScreen("weakMenu");
    } else if (state.screen === "quiz") {
      if (state.quiz?.mode === "weak") {
        renderWeakMenu();
        setScreen("weakMenu");
      } else {
        renderRangeSlots();
        setScreen("rangeSetup");
      }
    } else if (state.screen === "result") {
      setScreen("mode");
    }
  }

  function renderGrades() {
    els.gradeButtons.innerHTML = "";
    grades.forEach((grade) => {
      const count = VOCAB.filter((item) => item.grade === grade).length;
      const button = document.createElement("button");
      button.className = "grade-button";
      button.type = "button";
      button.innerHTML = `<span>${grade}</span><small>${count}語</small>`;
      button.addEventListener("click", () => {
        state.selectedGrade = grade;
        const items = getGradeItems();
        els.startNo.value = String(Math.min(...items.map((item) => item.no)));
        els.endNo.value = String(Math.max(...items.map((item) => item.no)));
        setScreen("mode");
      });
      els.gradeButtons.append(button);
    });
  }

  function renderRangeSlots() {
    const slots = getRangeSlots();
    els.rangeSlots.innerHTML = "";
    slots.forEach((slot, index) => {
      const button = document.createElement("button");
      button.className = "range-slot";
      button.type = "button";
      button.innerHTML = slot
        ? `<strong>保存${index + 1}</strong><span>${slot.start}〜${slot.end}</span>`
        : `<strong>保存${index + 1}</strong><span>未保存</span>`;
      button.disabled = !slot;
      button.addEventListener("click", () => {
        if (!slot) return;
        els.startNo.value = String(slot.start);
        els.endNo.value = String(slot.end);
        els.rangeMessage.textContent = `保存${index + 1}を呼び出しました。`;
      });
      els.rangeSlots.append(button);
    });
  }

  function renderRangeWordList() {
    const items = getGradeItems();
    els.rangeWordList.innerHTML = "";
    items.forEach((item) => {
      const button = document.createElement("button");
      button.className = "range-word-item";
      button.type = "button";
      button.dataset.no = String(item.no);
      button.innerHTML = `<span>${item.no}</span><strong>${item.word}</strong>`;
      button.addEventListener("click", () => pickRangeNo(item.no));
      els.rangeWordList.append(button);
    });
    updateRangePickStatus();
  }

  function toggleRangeList() {
    const nextHidden = !els.rangeListPanel.hidden;
    els.rangeListPanel.hidden = nextHidden;
    els.toggleRangeList.textContent = nextHidden ? "リストを表示" : "リストを閉じる";
    if (!nextHidden && els.rangeWordList.children.length === 0) {
      renderRangeWordList();
    }
  }

  function resetRangePick() {
    state.rangePickStep = "start";
    els.startNo.value = "";
    els.endNo.value = "";
    els.rangeMessage.textContent = "";
    updateRangePickStatus();
  }

  function pickRangeNo(no) {
    if (state.rangePickStep === "start") {
      els.startNo.value = String(no);
      els.endNo.value = "";
      state.rangePickStep = "end";
      els.rangeMessage.textContent = `${no}番を開始番号に入れました。`;
    } else {
      const start = Number(els.startNo.value);
      if (Number.isInteger(start) && no < start) {
        els.endNo.value = String(start);
        els.startNo.value = String(no);
        els.rangeMessage.textContent = `${no}〜${start}番を入力しました。`;
      } else {
        els.endNo.value = String(no);
        els.rangeMessage.textContent = `${els.startNo.value}〜${no}番を入力しました。`;
      }
      state.rangePickStep = "start";
    }
    updateRangePickStatus();
  }

  function updateRangePickStatus() {
    els.rangePickStatus.textContent =
      state.rangePickStep === "start" ? "開始番号を選択" : "終了番号を選択";
    const start = Number(els.startNo.value);
    const end = Number(els.endNo.value);
    [...els.rangeWordList.children].forEach((button) => {
      const no = Number(button.dataset.no);
      const isStart = Number.isInteger(start) && no === start;
      const isEnd = Number.isInteger(end) && no === end;
      button.classList.toggle("is-picked", isStart || isEnd);
      button.classList.toggle("is-in-range", Number.isInteger(start) && Number.isInteger(end) && no >= start && no <= end);
    });
  }

  function saveCurrentRange() {
    const validation = validateRange();
    if (!validation.ok) {
      els.rangeMessage.textContent = validation.message;
      return;
    }
    const form = new FormData(els.rangeForm);
    const index = Number(form.get("rangeSlot"));
    const slots = getRangeSlots();
    slots[index] = { start: validation.start, end: validation.end };
    saveRangeSlots(slots);
    renderRangeSlots();
    els.rangeMessage.textContent = `保存${index + 1}に登録しました。`;
  }

  function renderWeakMenu() {
    els.weakMenuList.innerHTML = "";
    WEAK_LISTS.forEach((list) => {
      const count = getWeakIds(list.id).size;
      const button = document.createElement("button");
      button.className = list.type === "auto" ? "mode-button mode-button-primary" : "mode-button";
      button.type = "button";
      button.innerHTML = `<span>${list.label}</span><small>${count}語</small>`;
      button.addEventListener("click", () => {
        state.selectedWeakList = list;
        els.weakSearch.value = "";
        setScreen("weakSetup");
        renderWeakList();
      });
      els.weakMenuList.append(button);
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

  function normalizeAnswer(item, direction) {
    return direction === "en-ja" ? item.meaning : item.word;
  }

  function buildChoices(question, pool, fallbackPool, direction) {
    const correct = normalizeAnswer(question, direction);
    const primaryCandidates = pool
      .map((item) => normalizeAnswer(item, direction))
      .filter((value) => value !== correct);
    const fallbackCandidates = fallbackPool
      .map((item) => normalizeAnswer(item, direction))
      .filter((value) => value !== correct);
    const uniqueCandidates = [...new Set([...primaryCandidates, ...fallbackCandidates])];
    return shuffle([correct, ...shuffle(uniqueCandidates).slice(0, 3)]);
  }

  function startQuiz(items, options) {
    if (items.length === 0) return;
    const questionCount =
      options.count === "all" ? items.length : Math.min(Number(options.count), items.length);
    const questions = shuffle(items).slice(0, questionCount);
    const gradePool = getGradeItems();
    state.lastSetup = { items, options };
    state.quiz = {
      mode: options.mode,
      direction: options.direction,
      questions,
      pool: options.pool?.length >= 4 ? options.pool : gradePool,
      fallbackPool: gradePool,
      index: 0,
      correct: 0,
      missed: [],
    };
    setScreen("quiz");
    renderQuestion();
  }

  function renderQuestion() {
    clearPendingTimer();
    state.locked = false;
    const quiz = state.quiz;
    const question = quiz.questions[quiz.index];
    const label = quiz.direction === "en-ja" ? "英単語" : "意味";
    const prompt = quiz.direction === "en-ja" ? question.word : question.meaning;
    els.progress.textContent = `${quiz.index + 1} / ${quiz.questions.length}`;
    els.score.textContent = `${quiz.correct}問正解`;
    els.promptLabel.textContent = label;
    els.promptText.textContent = prompt;
    els.feedback.textContent = "";
    els.feedback.className = "answer-feedback";
    els.choices.innerHTML = "";

    buildChoices(question, quiz.pool, quiz.fallbackPool, quiz.direction).forEach((choice) => {
      const button = document.createElement("button");
      button.className = "choice-button";
      button.type = "button";
      button.textContent = choice;
      button.addEventListener("click", () => answerQuestion(button, choice));
      els.choices.append(button);
    });
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
      quiz.correct += 1;
      els.feedback.textContent = "正解";
      els.feedback.classList.add("correct");
    } else {
      button.classList.add("is-wrong");
      quiz.missed.push({ ...question, selected, correct });
      if (quiz.mode === "range") {
        const autoIds = getWeakIds("auto");
        autoIds.add(question.id);
        saveWeakIds(autoIds, "auto");
      }
      els.feedback.textContent = `正解: ${correct}`;
      els.feedback.classList.add("wrong");
    }

    els.score.textContent = `${quiz.correct}問正解`;
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
    const quiz = state.quiz;
    const total = quiz.questions.length;
    const rate = Math.round((quiz.correct / total) * 100);
    els.resultScore.textContent = `${quiz.correct} / ${total}問`;
    els.resultRate.textContent = `正答率 ${rate}%`;
    els.missedList.innerHTML = "";

    if (quiz.missed.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "間違えた単語はありません。";
      els.missedList.append(empty);
    } else {
      quiz.missed.forEach((item) => {
        const div = document.createElement("div");
        div.className = "missed-item";
        div.innerHTML = `<strong>${item.no}. ${item.word}</strong><br><span>${item.meaning}</span>`;
        els.missedList.append(div);
      });
    }
    setScreen("result");
  }

  function clearPendingTimer() {
    if (state.timer) {
      window.clearTimeout(state.timer);
      state.timer = 0;
    }
  }

  function validateRange() {
    const start = Number(els.startNo.value);
    const end = Number(els.endNo.value);
    const items = getGradeItems();
    const min = Math.min(...items.map((item) => item.no));
    const max = Math.max(...items.map((item) => item.no));
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      return { ok: false, message: `${min}〜${max}の範囲で入力してください。` };
    }
    const pool = items.filter((item) => item.no >= start && item.no <= end);
    if (pool.length < 4) {
      return { ok: false, message: "4択を作るため、4語以上の範囲を指定してください。" };
    }
    return { ok: true, start, end, pool };
  }

  function handleRangeSubmit(event) {
    event.preventDefault();
    const validation = validateRange();
    els.rangeMessage.textContent = "";
    if (!validation.ok) {
      els.rangeMessage.textContent = validation.message;
      return;
    }

    const form = new FormData(els.rangeForm);
    startQuiz(validation.pool, {
      mode: "range",
      direction: form.get("direction"),
      count: form.get("count"),
      pool: validation.pool,
    });
  }

  function renderWeakList() {
    const items = getGradeItems();
    const saved = getWeakIds();
    const query = els.weakSearch.value.trim().toLowerCase();
    const isAuto = state.selectedWeakList.type === "auto";
    const sourceItems = isAuto ? items.filter((item) => saved.has(item.id)) : items;
    const filtered = sourceItems.filter((item) => {
      const text = `${item.no} ${item.word} ${item.meaning}`.toLowerCase();
      return text.includes(query);
    });

    els.weakList.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = isAuto
        ? "範囲ランダム特訓で間違えた単語がここに入ります。"
        : "単語を選択してください。";
      els.weakList.append(empty);
      updateWeakCount();
      return;
    }

    filtered.forEach((item) => {
      const label = document.createElement("label");
      label.className = `weak-item${isAuto ? " weak-item-readonly" : ""}`;
      label.innerHTML = `
        <input type="checkbox" ${saved.has(item.id) ? "checked" : ""} ${isAuto ? "disabled" : ""}>
        <span class="weak-no">${item.no}</span>
        <span><span class="weak-word">${item.word}</span><span class="weak-meaning">${item.meaning}</span></span>
      `;
      const checkbox = label.querySelector("input");
      if (!isAuto) {
        checkbox.addEventListener("change", () => {
          const ids = getWeakIds();
          if (checkbox.checked) {
            ids.add(item.id);
          } else {
            ids.delete(item.id);
          }
          saveWeakIds(ids);
          updateWeakCount();
        });
      }
      els.weakList.append(label);
    });
    updateWeakCount();
  }

  function updateWeakCount() {
    const count = getWeakIds().size;
    els.weakCount.textContent = `${count}語`;
    const message = count < 4 ? "4択演習には、4語以上保存してください。" : "";
    els.weakMessage.textContent = "";
    els.titleAlert.textContent = state.screen === "weakSetup" ? message : "";
    els.startWeakQuiz.disabled = count < 4;
  }

  function startWeakQuiz() {
    const ids = getWeakIds();
    const items = getGradeItems().filter((item) => ids.has(item.id));
    if (items.length < 4) {
      updateWeakCount();
      return;
    }
    startQuiz(items, {
      mode: "weak",
      direction: "en-ja",
      count: "all",
      pool: items,
    });
  }

  function retryLastQuiz() {
    if (!state.lastSetup) {
      setScreen("mode");
      return;
    }
    startQuiz(state.lastSetup.items, state.lastSetup.options);
  }

  function bindEvents() {
    els.back.addEventListener("click", goBack);
    els.rangeMode.addEventListener("click", () => {
      renderRangeSlots();
      state.rangePickStep = "start";
      els.rangeListPanel.hidden = true;
      els.toggleRangeList.textContent = "リストを表示";
      setScreen("rangeSetup");
    });
    els.weakMode.addEventListener("click", () => {
      renderWeakMenu();
      setScreen("weakMenu");
    });
    els.rangeForm.addEventListener("submit", handleRangeSubmit);
    els.saveRange.addEventListener("click", saveCurrentRange);
    els.toggleRangeList.addEventListener("click", toggleRangeList);
    els.resetRangePick.addEventListener("click", resetRangePick);
    els.startNo.addEventListener("input", updateRangePickStatus);
    els.endNo.addEventListener("input", updateRangePickStatus);
    els.weakSearch.addEventListener("input", renderWeakList);
    els.startWeakQuiz.addEventListener("click", startWeakQuiz);
    els.retry.addEventListener("click", retryLastQuiz);
    els.home.addEventListener("click", () => {
      state.selectedGrade = "";
      state.lastSetup = null;
      setScreen("grade");
    });
  }

  renderGrades();
  bindEvents();
  setScreen("grade");
})();
