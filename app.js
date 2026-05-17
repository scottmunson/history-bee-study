var APP_VERSION = '1.1.0';
var ALL_QUESTIONS = ALL_QUESTIONS_1.concat(ALL_QUESTIONS_2);

// ===== STORAGE =====
function loadData(key, fallback) {
  try {
    const v = localStorage.getItem('hb_' + key);
    return v ? JSON.parse(v) : fallback;
  } catch(e) { return fallback; }
}
function saveData(key, val) {
  try { localStorage.setItem('hb_' + key, JSON.stringify(val)); } catch(e) {}
}

// ===== STATE =====
var topicMastery = loadData('topicMastery', {});
var buzzerHistory = loadData('buzzerHistory', []);
var quizHistory = loadData('quizHistory', []);
var studyStreak = loadData('studyStreak', { last: '', count: 0 });

function recordStudy() {
  var today = new Date().toISOString().slice(0, 10);
  if (studyStreak.last === today) return;
  var yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (studyStreak.last === yesterday) {
    studyStreak.count++;
  } else {
    studyStreak.count = 1;
  }
  studyStreak.last = today;
  saveData('studyStreak', studyStreak);
}

// ===== ENCOURAGEMENT =====
var ENCOURAGE_CORRECT = [
  "Nice job!", "You nailed it!", "Awesome!", "Great work!",
  "You're on fire!", "Keep it up!", "Brilliant!", "Way to go!",
  "History pro!", "Impressive!", "You got this!", "Excellent!"
];
var ENCOURAGE_STREAK = [
  "3 in a row! You're rolling!",
  "4 straight! Unstoppable!",
  "5 in a row! History champion!",
  "Wow, 6 straight! You're a genius!",
  "7 in a row! Can anyone stop you?!",
  "8 straight! Legendary!",
  "9 in a row! This is unbelievable!",
  "10 in a row! PERFECT! You're ready for Nationals!"
];
function getEncouragement(streak) {
  if (streak >= 3 && streak <= 10) return ENCOURAGE_STREAK[streak - 3];
  if (streak > 10) return streak + " in a row! You're unstoppable!";
  return ENCOURAGE_CORRECT[Math.floor(Math.random() * ENCOURAGE_CORRECT.length)];
}
var ENCOURAGE_WRONG = [
  "Good try! Now you'll remember it!",
  "That's how you learn! You'll get it next time.",
  "Don't worry, keep going!",
  "Almost! You're getting closer.",
  "Now you know! That's what studying is for."
];
function getWrongEncouragement() {
  return ENCOURAGE_WRONG[Math.floor(Math.random() * ENCOURAGE_WRONG.length)];
}

// ===== THEME =====
function initTheme() {
  var saved = loadData('theme', 'light');
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}
function updateThemeBtn(theme) {
  var btn = document.getElementById('themeToggle');
  btn.innerHTML = theme === 'dark' ? '&#9728;&#65039; Light' : '&#127769; Dark';
}
document.getElementById('themeToggle').addEventListener('click', function() {
  var current = document.documentElement.getAttribute('data-theme');
  var next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  saveData('theme', next);
  updateThemeBtn(next);
});

// ===== TABS =====
document.getElementById('mainNav').addEventListener('click', function(e) {
  var btn = e.target.closest('.nav-btn');
  if (!btn) return;
  var tab = btn.getAttribute('data-tab');
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('active'); });
  btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'flashcards') loadFlashcards();
  if (tab === 'reading') renderReading();
  if (tab === 'dashboard') renderDashboard();
});

// ===== CATEGORY HELPERS =====
var CAT_NAMES = { african: 'African', asian: 'Asian', ancient: 'Ancient', european: 'European', latin: 'Latin American', us: 'U.S.', other: 'Other' };
var CAT_ICONS = { african: '&#127757;', asian: '&#127759;', ancient: '&#127963;', european: '&#127758;', latin: '&#127758;', us: '&#127482;&#127480;', other: '&#127760;' };

// ===== TOPIC LOOKUP (shared by buzzer, flashcards, quiz) =====
var answerToTopic = {};
ALL_TOPICS.forEach(function(t) { answerToTopic[t.name.toLowerCase().trim()] = t; });

function getTopicForAnswer(answer) {
  var norm = answer.toLowerCase().trim();
  if (answerToTopic[norm]) return answerToTopic[norm];
  for (var key in answerToTopic) {
    if (key.includes(norm) || norm.includes(key)) return answerToTopic[key];
  }
  return null;
}

function getQuestionCat(q) {
  var t = getTopicForAnswer(q.a);
  return t ? t.cat : 'other';
}

// ===== TEACHABLE MOMENT =====
function findTeachableMoment(answerText) {
  var norm = function(s) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(); };
  var aNorm = norm(answerText);
  for (var key in TOPIC_DESCS) {
    if (norm(key) === aNorm) return { topic: key, info: TOPIC_DESCS[key] };
  }
  for (var key2 in TOPIC_DESCS) {
    var kNorm = norm(key2);
    if (kNorm.includes(aNorm) || aNorm.includes(kNorm)) return { topic: key2, info: TOPIC_DESCS[key2] };
  }
  var parts = aNorm.split(' ');
  if (parts.length >= 2) {
    var last = parts[parts.length - 1];
    for (var key3 in TOPIC_DESCS) {
      if (norm(key3).includes(last) && last.length >= 4) return { topic: key3, info: TOPIC_DESCS[key3] };
    }
  }
  return null;
}

function renderTeachableMoment(answerText) {
  var teachable = findTeachableMoment(answerText);
  if (!teachable || !teachable.info) return '';
  var html = '<div class="learn-more-section">';
  html += '<div class="learn-more-header">Quick Facts</div>';
  html += '<div class="learn-more-desc">' + escHtml(teachable.info.desc) + '</div>';
  if (teachable.info.facts && teachable.info.facts.length > 0) {
    html += '<ul class="learn-more-facts">';
    teachable.info.facts.forEach(function(f) {
      html += '<li>' + escHtml(f) + '</li>';
    });
    html += '</ul>';
  }
  html += '</div>';
  return html;
}

// ===== BUZZER PRACTICE =====
(function() {
  var years = [], rounds = [], seenY = {}, seenR = {};
  ALL_QUESTIONS.forEach(function(q) {
    if (q.y && !seenY[q.y]) { seenY[q.y] = true; years.push(q.y); }
    if (q.r && !seenR[q.r]) { seenR[q.r] = true; rounds.push(q.r); }
  });
  years.sort(); rounds.sort();
  var yearSel = document.getElementById('buzzerYear');
  var roundSel = document.getElementById('buzzerRound');
  years.forEach(function(y) { var o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o); });
  rounds.forEach(function(r) { var o = document.createElement('option'); o.value = r; o.textContent = r; roundSel.appendChild(o); });
})();

var buzzerState = {
  active: false,
  questions: [],
  qIndex: 0,
  score: 0,
  streak: 0,
  correct: 0,
  total: 0,
  words: [],
  wordIndex: 0,
  timer: null,
  startTime: 0,
  buzzed: false,
  answered: false,
  timerInterval: null
};

function getFilteredQuestions() {
  var y = document.getElementById('buzzerYear').value;
  var r = document.getElementById('buzzerRound').value;
  return ALL_QUESTIONS.filter(function(q) { return (!y || q.y === y) && (!r || q.r === r); });
}

function shuffle(arr) {
  var a = arr.slice();
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

document.getElementById('startRoundBtn').addEventListener('click', function() {
  var filtered = getFilteredQuestions();
  if (filtered.length === 0) { alert('No questions match your filters. Try different options.'); return; }
  buzzerState.questions = shuffle(filtered).slice(0, 10);
  buzzerState.qIndex = 0;
  buzzerState.score = 0;
  buzzerState.streak = 0;
  buzzerState.correct = 0;
  buzzerState.total = 0;
  buzzerState.active = true;
  updateBuzzerStats();
  showBuzzerQuestion();
  recordStudy();
});

function formatSentences(sentences, el) {
  el.innerHTML = '';
  sentences.forEach(function(s) {
    var p = document.createElement('p');
    p.style.margin = '0 0 10px 0';
    p.textContent = s.trim();
    el.appendChild(p);
  });
}

function updateBuzzerStats() {
  document.getElementById('bScore').textContent = buzzerState.score;
  document.getElementById('bQNum').textContent = (buzzerState.qIndex + 1) + '/' + buzzerState.questions.length;
  document.getElementById('bStreak').textContent = buzzerState.streak;
  var acc = buzzerState.total > 0 ? Math.round(buzzerState.correct / buzzerState.total * 100) + '%' : '-';
  document.getElementById('bAccuracy').textContent = acc;
}

function showBuzzerQuestion() {
  if (buzzerState.qIndex >= buzzerState.questions.length) {
    showBuzzerSummary();
    return;
  }
  var q = buzzerState.questions[buzzerState.qIndex];
  buzzerState.sentences = q.q.split(/(?<=[a-z\)\"]{2}\.)\s+(?=[A-Z])|(?=For the point,)|(?=For ten points,)/);
  buzzerState.sentenceIndex = 0;
  buzzerState.totalSentences = buzzerState.sentences.length;
  buzzerState.words = q.q.split(/\s+/);
  buzzerState.wordIndex = 0;
  buzzerState.buzzed = false;
  buzzerState.answered = false;
  buzzerState.startTime = Date.now();
  updateBuzzerStats();

  var area = document.getElementById('buzzerArea');
  area.innerHTML = '<div class="question-display" id="qDisplay"></div>' +
    '<div class="timer-bar-container"><div class="timer-bar" id="timerBar"></div></div>' +
    '<div class="clue-counter" id="clueCounter"></div>' +
    '<button class="buzz-btn" id="buzzBtn">BUZZ!</button>';

  document.getElementById('buzzBtn').addEventListener('click', handleBuzz);

  var display = document.getElementById('qDisplay');
  display.textContent = '';
  function revealNextSentence() {
    if (buzzerState.sentenceIndex < buzzerState.sentences.length) {
      var shown = buzzerState.sentences.slice(0, buzzerState.sentenceIndex + 1);
      buzzerState.wordIndex = shown.join(' ').split(/\s+/).length;
      formatSentences(shown, display);
      var counter = document.getElementById('clueCounter');
      if (counter) counter.textContent = 'Clue ' + (buzzerState.sentenceIndex + 1) + ' of ' + buzzerState.totalSentences;
      buzzerState.sentenceIndex++;
    } else {
      clearInterval(buzzerState.timer);
    }
    updateTimerBar();
  }
  revealNextSentence();
  buzzerState.timer = setInterval(revealNextSentence, 8000);

  var totalTime = buzzerState.totalSentences * 8000 + 5000;
  buzzerState.totalTime = totalTime;
  buzzerState.timerInterval = setTimeout(function() {
    if (!buzzerState.buzzed) {
      clearInterval(buzzerState.timer);
      timeUp();
    }
  }, totalTime);
}

function updateTimerBar() {
  var elapsed = Date.now() - buzzerState.startTime;
  var totalTime = buzzerState.totalTime || 15000;
  var pct = Math.max(0, 100 - (elapsed / totalTime) * 100);
  var bar = document.getElementById('timerBar');
  if (bar) {
    bar.style.width = pct + '%';
    bar.className = 'timer-bar' + (pct < 20 ? ' danger' : pct < 40 ? ' warning' : '');
  }
}

function handleBuzz() {
  if (buzzerState.buzzed) return;
  buzzerState.buzzed = true;
  clearInterval(buzzerState.timer);
  clearTimeout(buzzerState.timerInterval);

  var display = document.getElementById('qDisplay');
  formatSentences(buzzerState.sentences, display);

  var area = document.getElementById('buzzerArea');
  var buzzBtn = document.getElementById('buzzBtn');
  buzzBtn.style.display = 'none';

  var inputArea = document.createElement('div');
  inputArea.className = 'answer-input-area';
  inputArea.innerHTML = '<input type="text" id="answerInput" placeholder="Type your answer..." autofocus>' +
    '<button class="next-btn" id="submitAnswer">Submit</button>';
  area.appendChild(inputArea);

  var input = document.getElementById('answerInput');
  input.focus();
  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') checkBuzzerAnswer(); });
  document.getElementById('submitAnswer').addEventListener('click', checkBuzzerAnswer);
}

function levenshtein(a, b) {
  var m = a.length, n = b.length, d = [];
  if (!m) return n;
  if (!n) return m;
  for (var i = 0; i <= m; i++) d[i] = [i];
  for (var j = 0; j <= n; j++) d[0][j] = j;
  for (i = 1; i <= m; i++) {
    for (j = 1; j <= n; j++) {
      d[i][j] = a[i-1] === b[j-1] ? d[i-1][j-1] : Math.min(d[i-1][j-1]+1, d[i][j-1]+1, d[i-1][j]+1);
    }
  }
  return d[m][n];
}

function fuzzyMatch(userAns, correctAns) {
  var normalize = function(s) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\b(the|a|an|of)\b/g, '').replace(/\s+/g, ' ').trim(); };
  var u = normalize(userAns);
  var c = normalize(correctAns);
  if (!u) return false;
  if (u === c) return true;
  if (c.includes(u) && u.length >= 3) return true;
  if (u.includes(c) && c.length >= 3) return true;
  var cParts = c.split(' ');
  if (cParts.length >= 2) {
    var lastName = cParts[cParts.length - 1];
    if (lastName.length >= 3 && (u === lastName || levenshtein(u, lastName) <= 1)) return true;
  }
  var maxDist = c.length <= 5 ? 1 : c.length <= 10 ? 2 : 3;
  if (levenshtein(u, c) <= maxDist) return true;
  var cWords = c.split(' ').filter(function(w) { return w.length > 2; });
  var uWords = u.split(' ').filter(function(w) { return w.length > 2; });
  if (cWords.length > 0) {
    var matchCount = cWords.filter(function(w) {
      return uWords.some(function(uw) { return uw === w || levenshtein(uw, w) <= 1; });
    }).length;
    if (matchCount >= Math.ceil(cWords.length * 0.5) && matchCount >= 1) return true;
  }
  var parenMatch = correctAns.match(/\((?:accept|or)\s+(.+?)\)/i);
  if (parenMatch) {
    var alt = normalize(parenMatch[1]);
    if (alt && (u === alt || alt.includes(u) || u.includes(alt) || levenshtein(u, alt) <= 2)) return true;
  }
  return false;
}

function checkBuzzerAnswer() {
  if (buzzerState.answered) return;
  buzzerState.answered = true;
  var q = buzzerState.questions[buzzerState.qIndex];
  var userAns = document.getElementById('answerInput').value;

  var isCorrect = fuzzyMatch(userAns, q.a) || fuzzyMatch(userAns, q.af);

  var cluesShown = buzzerState.sentenceIndex || 1;
  var totalClues = buzzerState.totalSentences || 1;
  var earlyBuzz = cluesShown / totalClues < 0.6;

  var points = 0;
  if (isCorrect) {
    points = earlyBuzz ? 10 : 5;
    buzzerState.correct++;
    buzzerState.streak++;
  } else {
    points = 0;
    buzzerState.streak = 0;
  }
  buzzerState.score += points;
  buzzerState.total++;
  updateBuzzerStats();

  buzzerHistory.push({ q: q.q, a: q.a, userAns: userAns, correct: isCorrect, points: points, date: new Date().toISOString() });
  saveData('buzzerHistory', buzzerHistory);

  var area = document.getElementById('buzzerArea');
  var result = document.createElement('div');
  result.className = 'result-display ' + (isCorrect ? 'correct' : 'wrong');
  if (isCorrect) {
    var msg = earlyBuzz ? '+10 (early buzz!)' : '+5';
    var encourage = getEncouragement(buzzerState.streak);
    result.innerHTML = '<span class="result-icon correct-icon">&#10004;</span> ' + encourage + ' ' + msg;
  } else {
    result.innerHTML = '<span class="result-icon wrong-icon">&#10008;</span> ' + getWrongEncouragement();
  }
  area.appendChild(result);

  var correctDiv = document.createElement('div');
  correctDiv.className = 'correct-answer-display';
  correctDiv.innerHTML = '<strong>Answer:</strong> ' + escHtml(q.af);
  if (!isCorrect && userAns) correctDiv.innerHTML += '<br><span style="color:var(--text3);font-size:13px">You said: ' + escHtml(userAns) + '</span>';
  area.appendChild(correctDiv);

  // Teachable moment — show facts to help learn
  var learnHTML = renderTeachableMoment(q.a);
  if (learnHTML) {
    var learnDiv = document.createElement('div');
    learnDiv.innerHTML = learnHTML;
    area.appendChild(learnDiv.firstChild);
  }

  var nextBtn = document.createElement('button');
  nextBtn.className = 'next-btn';
  nextBtn.textContent = buzzerState.qIndex < buzzerState.questions.length - 1 ? 'Next Question' : 'See Results';
  nextBtn.addEventListener('click', function() {
    buzzerState.qIndex++;
    showBuzzerQuestion();
  });
  area.appendChild(nextBtn);
}

function timeUp() {
  buzzerState.buzzed = true;
  buzzerState.total++;
  updateBuzzerStats();

  var q = buzzerState.questions[buzzerState.qIndex];
  var area = document.getElementById('buzzerArea');
  var display = document.getElementById('qDisplay');
  formatSentences(buzzerState.sentences, display);

  var buzzBtn = document.getElementById('buzzBtn');
  if (buzzBtn) buzzBtn.style.display = 'none';

  var prompt = document.createElement('div');
  prompt.className = 'result-display time-up-prompt';
  prompt.innerHTML = "&#9200; Time is up! Take your best guess:";
  area.appendChild(prompt);

  var inputArea = document.createElement('div');
  inputArea.className = 'answer-input-area';
  inputArea.innerHTML = '<input type="text" id="answerInput" placeholder="Type your guess..." autofocus>' +
    '<button class="next-btn" id="submitAnswer">Submit</button>' +
    '<button class="next-btn skip-btn" id="skipGuess">Show Answer</button>';
  area.appendChild(inputArea);

  var input = document.getElementById('answerInput');
  input.focus();

  function revealTimeUpAnswer(userAns) {
    if (buzzerState.answered) return;
    buzzerState.answered = true;
    inputArea.remove();
    prompt.remove();

    var isCorrect = userAns && (fuzzyMatch(userAns, q.a) || fuzzyMatch(userAns, q.af));

    if (isCorrect) {
      buzzerState.correct++;
      buzzerState.score += 2;
      updateBuzzerStats();
    }
    buzzerState.streak = 0;
    updateBuzzerStats();

    var result = document.createElement('div');
    result.className = 'result-display ' + (isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      result.innerHTML = '<span class="result-icon correct-icon">&#10004;</span> You knew it! +2 (buzz faster next time!)';
    } else if (userAns) {
      result.innerHTML = '<span class="result-icon wrong-icon">&#10008;</span> ' + getWrongEncouragement();
    } else {
      result.innerHTML = '&#9200; No guess — check the answer below.';
    }
    area.appendChild(result);

    var correctDiv = document.createElement('div');
    correctDiv.className = 'correct-answer-display';
    correctDiv.innerHTML = '<strong>Answer:</strong> ' + escHtml(q.af);
    if (!isCorrect && userAns) correctDiv.innerHTML += '<br><span style="color:var(--text3);font-size:13px">You said: ' + escHtml(userAns) + '</span>';
    area.appendChild(correctDiv);

    // Teachable moment
    var learnHTML = renderTeachableMoment(q.a);
    if (learnHTML) {
      var learnDiv = document.createElement('div');
      learnDiv.innerHTML = learnHTML;
      area.appendChild(learnDiv.firstChild);
    }

    buzzerHistory.push({ q: q.q, a: q.a, userAns: userAns || '', correct: isCorrect, points: isCorrect ? 2 : 0, date: new Date().toISOString() });
    saveData('buzzerHistory', buzzerHistory);

    var nextBtn = document.createElement('button');
    nextBtn.className = 'next-btn';
    nextBtn.textContent = buzzerState.qIndex < buzzerState.questions.length - 1 ? 'Next Question' : 'See Results';
    nextBtn.addEventListener('click', function() {
      buzzerState.qIndex++;
      showBuzzerQuestion();
    });
    area.appendChild(nextBtn);
  }

  input.addEventListener('keydown', function(e) { if (e.key === 'Enter') revealTimeUpAnswer(input.value); });
  document.getElementById('submitAnswer').addEventListener('click', function() { revealTimeUpAnswer(input.value); });
  document.getElementById('skipGuess').addEventListener('click', function() { revealTimeUpAnswer(''); });
}

function showBuzzerSummary() {
  buzzerState.active = false;
  var pct = buzzerState.total > 0 ? Math.round(buzzerState.correct / buzzerState.total * 100) : 0;
  var grade = pct >= 90 ? 'Amazing!' : pct >= 70 ? 'Great job!' : pct >= 50 ? 'Good effort!' : 'Keep practicing!';
  var area = document.getElementById('buzzerArea');
  area.innerHTML = '<div style="text-align:center">' +
    '<h2>Round Complete!</h2>' +
    '<div class="quiz-score-display">' + buzzerState.score + ' pts</div>' +
    '<p style="font-size:18px;margin-bottom:8px">' + buzzerState.correct + '/' + buzzerState.total + ' correct</p>' +
    '<p style="font-size:16px;color:var(--accent);margin-bottom:20px;font-weight:600">' + grade + '</p>' +
    '<button class="next-btn" id="newRoundBtn">Start New Round</button></div>';
  document.getElementById('newRoundBtn').addEventListener('click', function() {
    document.getElementById('startRoundBtn').click();
  });
}

// Space bar to buzz
document.addEventListener('keydown', function(e) {
  if (e.code === 'Space' && buzzerState.active && !buzzerState.buzzed && document.getElementById('tab-buzzer').classList.contains('active')) {
    e.preventDefault();
    handleBuzz();
  }
});

// ===== FLASHCARDS =====
var fcState = { cards: [], index: 0, revealed: false };
var fcMastery = loadData('fcMastery') || {};

// Populate flashcard round filter dynamically from actual data
(function() {
  var rounds = [], seen = {};
  ALL_QUESTIONS.forEach(function(q) {
    if (q.r && !seen[q.r]) { seen[q.r] = true; rounds.push(q.r); }
  });
  rounds.sort();
  var sel = document.getElementById('fcRound');
  sel.innerHTML = '<option value="">All Rounds</option>';
  rounds.forEach(function(r) {
    var o = document.createElement('option');
    o.value = r; o.textContent = r;
    sel.appendChild(o);
  });
})();

function loadFlashcards() {
  var cat = document.getElementById('fcCat').value;
  var round = document.getElementById('fcRound').value;
  var mastery = document.getElementById('fcMastery').value;

  fcState.cards = ALL_QUESTIONS.filter(function(q) {
    if (cat && getQuestionCat(q) !== cat) return false;
    if (round && q.r !== round) return false;
    var m = fcMastery[q.n] || 'unseen';
    if (mastery && m !== mastery) return false;
    return true;
  }).slice();
  shuffleArray(fcState.cards);
  fcState.index = 0;
  fcState.revealed = false;
  showFlashcard();
  recordStudy();
}

function showFlashcard() {
  var area = document.getElementById('fcStudyArea');
  var progress = document.getElementById('fcProgress');

  if (fcState.cards.length === 0) {
    progress.textContent = '';
    area.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text3)">' +
      '<p style="font-size:18px;margin-bottom:12px">No cards match your filters.</p>' +
      '<p>Try changing the category, round, or status filters above.</p></div>';
    return;
  }

  var q = fcState.cards[fcState.index];
  var gotItCount = fcState.cards.filter(function(c) { return fcMastery[c.n] === 'mastered'; }).length;
  var learningCount = fcState.cards.filter(function(c) { return fcMastery[c.n] === 'learning'; }).length;

  progress.innerHTML = 'Card ' + (fcState.index + 1) + ' of ' + fcState.cards.length +
    ' &nbsp;&middot;&nbsp; <span style="color:var(--success)">' + gotItCount + ' got it</span>' +
    ' &nbsp;&middot;&nbsp; <span style="color:var(--warning)">' + learningCount + ' learning</span>';

  fcState.revealed = false;

  area.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'fc-card-single';

  var clueText = q.q;
  var promptHTML = '<div class="fc-prompt-label">Read the clues. Who or what is this?</div>' +
    '<div class="fc-prompt">' + escHtml(clueText) + '</div>' +
    '<div class="fc-tap-hint">Tap card or press Space to reveal the answer</div>';

  card.innerHTML = promptHTML;
  card.addEventListener('click', function() { revealFlashcardAnswer(q); });
  area.appendChild(card);
}

function revealFlashcardAnswer(q) {
  if (fcState.revealed) return;
  fcState.revealed = true;

  var card = document.querySelector('.fc-card-single');
  var hint = card.querySelector('.fc-tap-hint');
  if (hint) hint.remove();

  var topic = getTopicForAnswer(q.a);

  var answerDiv = document.createElement('div');
  answerDiv.className = 'fc-answer-area';
  var metaHTML = '';
  if (topic) {
    metaHTML = '<div class="fc-answer-meta">' +
      '<span class="cat-dot cat-' + topic.cat + '" style="display:inline-block;vertical-align:middle"></span> ' +
      '<span>' + (CAT_NAMES[topic.cat] || '') + '</span>' +
      (q.r ? ' &middot; ' + q.r : '') +
      (q.y ? ' (' + q.y + ')' : '') +
    '</div>';
  } else {
    metaHTML = '<div class="fc-answer-meta">' +
      (q.r ? q.r : '') + (q.y ? ' (' + q.y + ')' : '') +
    '</div>';
  }
  answerDiv.innerHTML = '<div class="fc-answer-label">ANSWER</div>' +
    '<div class="fc-answer-name">' + escHtml(q.a) + '</div>' + metaHTML;
  card.appendChild(answerDiv);

  // Teachable moment — show facts to help learn
  var learnHTML = renderTeachableMoment(q.a);
  if (learnHTML) {
    var learnDiv = document.createElement('div');
    learnDiv.innerHTML = learnHTML;
    card.appendChild(learnDiv.firstChild);
  }

  // Action buttons
  var actions = document.createElement('div');
  actions.className = 'fc-actions';
  actions.innerHTML = '<button class="fc-btn-mastered" title="I got it right">Got it!</button>' +
    '<button class="fc-btn-learning" title="Need more practice">Still learning</button>' +
    '<button class="fc-btn-next" title="Skip without rating">Skip</button>';
  card.appendChild(actions);

  actions.querySelector('.fc-btn-mastered').addEventListener('click', function(e) {
    e.stopPropagation();
    fcMastery[q.n] = 'mastered';
    saveData('fcMastery', fcMastery);
    advanceFlashcard();
  });
  actions.querySelector('.fc-btn-learning').addEventListener('click', function(e) {
    e.stopPropagation();
    fcMastery[q.n] = 'learning';
    saveData('fcMastery', fcMastery);
    advanceFlashcard();
  });
  actions.querySelector('.fc-btn-next').addEventListener('click', function(e) {
    e.stopPropagation();
    advanceFlashcard();
  });
}

function advanceFlashcard() {
  fcState.index++;
  if (fcState.index >= fcState.cards.length) {
    var area = document.getElementById('fcStudyArea');
    var gotItCount = fcState.cards.filter(function(c) { return fcMastery[c.n] === 'mastered'; }).length;
    var pct = fcState.cards.length > 0 ? Math.round(gotItCount / fcState.cards.length * 100) : 0;
    var grade = pct >= 80 ? "Amazing! You really know your stuff!" : pct >= 50 ? "Great progress! Keep studying!" : "Good start! Try again to learn more.";
    area.innerHTML = '<div style="text-align:center;padding:40px">' +
      '<h2 style="margin-bottom:12px">Deck complete!</h2>' +
      '<p style="font-size:18px;color:var(--text2);margin-bottom:8px">You got ' + gotItCount + ' of ' + fcState.cards.length + ' cards right.</p>' +
      '<p style="font-size:16px;color:var(--accent);font-weight:600;margin-bottom:8px">' + grade + '</p>' +
      '<p style="color:var(--text3);margin-bottom:20px">Change filters or shuffle to study again.</p>' +
      '<div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">' +
      '<button id="fcRestartBtn" class="next-btn">Start Over</button>' +
      (fcState.cards.length - gotItCount > 0 ? '<button id="fcReviewBtn" class="next-btn" style="background:var(--warning)">Review Missed (' + (fcState.cards.length - gotItCount) + ')</button>' : '') +
      '</div></div>';
    document.getElementById('fcRestartBtn').addEventListener('click', loadFlashcards);
    var reviewBtn = document.getElementById('fcReviewBtn');
    if (reviewBtn) {
      reviewBtn.addEventListener('click', function() {
        fcState.cards = fcState.cards.filter(function(c) { return fcMastery[c.n] !== 'mastered'; });
        shuffleArray(fcState.cards);
        fcState.index = 0;
        fcState.revealed = false;
        showFlashcard();
      });
    }
    document.getElementById('fcProgress').textContent = '';
  } else {
    showFlashcard();
  }
}

// Keyboard: Space to reveal, right arrow to advance
document.addEventListener('keydown', function(e) {
  if (!document.getElementById('tab-flashcards').classList.contains('active')) return;
  if (e.code === 'Space' && !fcState.revealed && fcState.cards.length > 0) {
    e.preventDefault();
    revealFlashcardAnswer(fcState.cards[fcState.index]);
  }
  if (e.code === 'ArrowRight' && fcState.revealed) {
    e.preventDefault();
    advanceFlashcard();
  }
});

['fcCat', 'fcRound', 'fcMastery'].forEach(function(id) {
  document.getElementById(id).addEventListener('change', loadFlashcards);
});
document.getElementById('fcShuffle').addEventListener('click', loadFlashcards);

// ===== QUIZ MODE =====
var quizState = {
  active: false,
  questions: [],
  qIndex: 0,
  score: 0,
  answers: [],
  selectedAnswer: null
};

// Pre-build keyword index for smart quiz distractors
var STOP_WORDS = {the:1,a:1,an:1,of:1,in:1,to:1,was:1,is:1,are:1,were:1,this:1,that:1,these:1,those:1,for:1,and:1,but:1,not:1,with:1,from:1,has:1,had:1,have:1,been:1,its:1,his:1,her:1,their:1,who:1,which:1,what:1,when:1,where:1,how:1,one:1,also:1,known:1,called:1,after:1,before:1,during:1,more:1,than:1,only:1,both:1,each:1,they:1,them:1,would:1,could:1,did:1,does:1,made:1,took:1,gave:1,come:1,came:1,went:1,said:1,name:1,point:1,points:1,used:1,many:1,some:1,most:1,other:1,into:1,over:1,under:1,about:1,between:1,being:1,such:1,same:1,will:1,shall:1,may:1,might:1,can:1,ten:1,two:1,three:1,first:1,last:1,upon:1,like:1,well:1};
function getKeywords(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g,'').split(/\s+/).filter(function(w) {
    return w.length >= 4 && !STOP_WORDS[w];
  });
}
var keywordIndex = {};
ALL_QUESTIONS.forEach(function(q, i) {
  getKeywords(q.q).forEach(function(kw) {
    if (!keywordIndex[kw]) keywordIndex[kw] = [];
    keywordIndex[kw].push(i);
  });
});
function findSimilarAnswers(q, count) {
  var kws = getKeywords(q.q);
  var scores = {};
  kws.forEach(function(kw) {
    var matches = keywordIndex[kw] || [];
    matches.forEach(function(idx) {
      if (ALL_QUESTIONS[idx].a !== q.a) {
        scores[idx] = (scores[idx] || 0) + 1;
      }
    });
  });
  var sorted = Object.keys(scores).sort(function(a, b) { return scores[b] - scores[a]; });
  var answers = [];
  var seen = {};
  for (var i = 0; i < sorted.length && answers.length < count; i++) {
    var ans = ALL_QUESTIONS[sorted[i]].a;
    if (!seen[ans]) {
      seen[ans] = true;
      answers.push(ans);
    }
  }
  return answers;
}
// Also keep category pools as fallback
var catAnswerPools = {};
ALL_QUESTIONS.forEach(function(q) {
  var cat = getQuestionCat(q);
  if (!catAnswerPools[cat]) catAnswerPools[cat] = [];
  if (q.a && catAnswerPools[cat].indexOf(q.a) === -1) catAnswerPools[cat].push(q.a);
});

document.getElementById('startQuizBtn').addEventListener('click', function() {
  var cat = document.getElementById('quizCat').value;
  var pool = ALL_QUESTIONS.filter(function(q) { return q.a && q.a.length > 0; });
  if (cat) {
    var catTopics = ALL_TOPICS.filter(function(t) { return t.cat === cat; }).map(function(t) { return t.name.toLowerCase(); });
    var filtered = pool.filter(function(q) {
      var qa = q.a.toLowerCase();
      var qq = q.q.toLowerCase();
      return catTopics.some(function(t) { return qa.includes(t) || qq.includes(t); });
    });
    if (filtered.length >= 10) pool = filtered;
  }

  quizState.questions = shuffle(pool).slice(0, 10);
  quizState.qIndex = 0;
  quizState.score = 0;
  quizState.answers = [];
  quizState.active = true;
  showQuizQuestion();
  recordStudy();
});

function showQuizQuestion() {
  if (quizState.qIndex >= quizState.questions.length) {
    showQuizResults();
    return;
  }
  var q = quizState.questions[quizState.qIndex];
  quizState.selectedAnswer = null;

  // Smart distractors: use keyword similarity to find topically related wrong answers
  var similar = findSimilarAnswers(q, 6);
  var wrongAnswers = shuffle(similar).slice(0, 3);

  // Fallback: if not enough similar, fill from same category
  if (wrongAnswers.length < 3) {
    var qCat = getQuestionCat(q);
    var sameCat = shuffle((catAnswerPools[qCat] || []).filter(function(a) {
      return a !== q.a && wrongAnswers.indexOf(a) === -1;
    }));
    wrongAnswers = wrongAnswers.concat(sameCat.slice(0, 3 - wrongAnswers.length));
  }
  // Last resort: fill from any pool
  if (wrongAnswers.length < 3) {
    var allAnswers = ALL_QUESTIONS.map(function(qq) { return qq.a; }).filter(function(a) {
      return a !== q.a && wrongAnswers.indexOf(a) === -1;
    });
    wrongAnswers = wrongAnswers.concat(shuffle(allAnswers).slice(0, 3 - wrongAnswers.length));
  }

  var options = shuffle([q.a].concat(wrongAnswers.slice(0, 3)));

  var area = document.getElementById('quizArea');
  area.innerHTML = '<div class="quiz-area">' +
    '<div class="quiz-progress">Question ' + (quizState.qIndex + 1) + ' of ' + quizState.questions.length + ' | Score: ' + quizState.score + '/10</div>' +
    '<div class="quiz-question">' + escHtml(q.q) + '</div>' +
    '<div class="quiz-options" id="quizOptions"></div>' +
    '<button class="next-btn" id="quizNextBtn" style="display:none;margin-top:16px;">Next Question</button>' +
  '</div>';

  var optionsDiv = document.getElementById('quizOptions');
  options.forEach(function(opt) {
    var btn = document.createElement('div');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.addEventListener('click', function() { selectQuizAnswer(btn, opt, q); });
    optionsDiv.appendChild(btn);
  });

  document.getElementById('quizNextBtn').addEventListener('click', function() {
    quizState.qIndex++;
    showQuizQuestion();
  });
}

function selectQuizAnswer(btn, selected, q) {
  if (quizState.selectedAnswer !== null) return;
  quizState.selectedAnswer = selected;
  var correct = q.a;
  var isCorrect = selected === correct;
  if (isCorrect) quizState.score++;

  quizState.answers.push({
    q: q.q,
    a: q.a,
    correct: correct,
    selected: selected,
    isCorrect: isCorrect
  });

  document.querySelectorAll('.quiz-option').forEach(function(opt) {
    opt.style.cursor = 'default';
    if (opt.textContent === correct) opt.classList.add('correct');
    if (opt.textContent === selected && !isCorrect) opt.classList.add('wrong');
  });

  // Show encouragement
  var quizArea = btn.closest('.quiz-area');
  var feedback = document.createElement('div');
  feedback.className = 'quiz-feedback ' + (isCorrect ? 'correct' : 'wrong');
  if (isCorrect) {
    feedback.innerHTML = '<span class="result-icon correct-icon">&#10004;</span> ' +
      ENCOURAGE_CORRECT[Math.floor(Math.random() * ENCOURAGE_CORRECT.length)];
  } else {
    feedback.innerHTML = '<span class="result-icon wrong-icon">&#10008;</span> ' + getWrongEncouragement();
  }
  quizArea.insertBefore(feedback, document.getElementById('quizNextBtn'));

  // Teachable moment for wrong answers
  if (!isCorrect) {
    var learnHTML = renderTeachableMoment(q.a);
    if (learnHTML) {
      var learnDiv = document.createElement('div');
      learnDiv.innerHTML = learnHTML;
      quizArea.insertBefore(learnDiv.firstChild, document.getElementById('quizNextBtn'));
    }
  }

  document.getElementById('quizNextBtn').style.display = 'inline-block';
  document.getElementById('quizNextBtn').textContent = quizState.qIndex < quizState.questions.length - 1 ? 'Next Question' : 'See Results';
}

function showQuizResults() {
  quizState.active = false;
  var missed = quizState.answers.filter(function(a) { return !a.isCorrect; });
  var pct = quizState.questions.length > 0 ? Math.round(quizState.score / quizState.questions.length * 100) : 0;
  var grade = pct >= 90 ? "Outstanding! You're ready!" : pct >= 70 ? "Great job! Keep it up!" : pct >= 50 ? "Good effort! Practice makes perfect." : "Keep at it! Every question you miss is one you'll remember next time.";

  quizHistory.push({ score: quizState.score, total: quizState.questions.length, date: new Date().toISOString(), missed: missed.length });
  saveData('quizHistory', quizHistory);

  var html = '<div class="quiz-results">' +
    '<h2>Quiz Complete!</h2>' +
    '<div class="quiz-score-display">' + quizState.score + '/' + quizState.questions.length + '</div>' +
    '<p style="font-size:16px;color:var(--accent);font-weight:600;text-align:center;margin-bottom:16px">' + grade + '</p>';

  if (missed.length > 0) {
    html += '<h3 style="margin-top:20px;margin-bottom:12px">Review What You Missed:</h3><div class="quiz-missed-list">';
    missed.forEach(function(m) {
      var learnHTML = renderTeachableMoment(m.a || m.correct);
      html += '<div class="quiz-missed-item">' +
        '<div class="missed-q">' + escHtml(m.q.substring(0, 150)) + '...</div>' +
        '<div class="missed-a">Correct: <strong>' + escHtml(m.correct) + '</strong></div>' +
        '<div class="missed-yours">Your answer: ' + escHtml(m.selected) + '</div>' +
        learnHTML +
      '</div>';
    });
    html += '</div>';
  }

  html += '<button class="next-btn" id="newQuizBtn" style="margin-top:20px">Start New Quiz</button></div>';
  document.getElementById('quizArea').innerHTML = html;
  document.getElementById('newQuizBtn').addEventListener('click', function() {
    document.getElementById('startQuizBtn').click();
  });
}

// ===== READING MATERIAL =====
function renderReading() {
  var search = document.getElementById('readingSearch').value.toLowerCase();
  var cat = document.getElementById('readingCat').value;
  var tier = document.getElementById('readingTier').value;

  var filtered = ALL_TOPICS.filter(function(t) {
    if (cat && t.cat !== cat) return false;
    if (tier && t.tier !== parseInt(tier)) return false;
    if (search && !t.name.toLowerCase().includes(search)) return false;
    return true;
  });

  var catOrder = ['us', 'european', 'asian', 'african', 'ancient', 'latin', 'other'];
  var grouped = {};
  filtered.forEach(function(t) {
    if (!grouped[t.cat]) grouped[t.cat] = [];
    grouped[t.cat].push(t);
  });

  var container = document.getElementById('readingContent');
  var html = '';

  catOrder.forEach(function(c) {
    if (!grouped[c] || grouped[c].length === 0) return;
    var topics = grouped[c];
    topics.sort(function(a, b) { return a.tier - b.tier || a.name.localeCompare(b.name); });

    html += '<div class="reading-category">';
    html += '<h2><span class="cat-dot cat-' + c + '"></span> ' + CAT_NAMES[c] + ' History (' + topics.length + ' topics)</h2>';

    [0, 1, 2, 3, 4].forEach(function(ti) {
      var tierTopics = topics.filter(function(t) { return t.tier === ti; });
      if (tierTopics.length === 0) return;
      html += '<div class="reading-tier-group">';
      html += '<h3><span class="tier-badge tier-' + ti + '">' + (ti === 0 ? 'Hot Topics' : 'Tier ' + ti) + '</span> ' +
        (ti === 0 ? '2025-2026 Current Events & Anniversaries' : ti === 1 ? 'Must Know' : ti === 2 ? 'Important' : ti === 3 ? 'Good to Know' : 'Extra Credit') +
        ' (' + tierTopics.length + ')</h3>';

      tierTopics.forEach(function(t) {
        var desc = TOPIC_DESCS[t.name] || { desc: 'Study this topic for the History Bee.', facts: [] };
        html += '<div class="reading-topic">';
        html += '<div class="reading-topic-header">';
        html += '<h4>' + escHtml(t.name) + '</h4>';
        html += '<span class="tier-badge tier-' + t.tier + '">' + (t.tier === 0 ? 'HOT' : 'T' + t.tier) + '</span>';
        html += '<span class="cat-dot cat-' + t.cat + '"></span>';
        html += '</div>';
        html += '<div class="reading-desc">' + escHtml(desc.desc) + '</div>';
        if (desc.facts && desc.facts.length > 0) {
          html += '<ul class="reading-facts">';
          desc.facts.forEach(function(f) {
            html += '<li>' + escHtml(f) + '</li>';
          });
          html += '</ul>';
        }
        html += '<div class="reading-meta">';
        html += '<span>Guides: ' + (t.guides.length ? t.guides.join(', ') : 'None') + '</span>';
        html += '<span>Competition frequency: ' + t.freq + '</span>';
        html += '</div>';
        html += '</div>';
      });

      html += '</div>';
    });

    html += '</div>';
  });

  if (!html) html = '<div class="empty-state"><div class="empty-icon">&#128218;</div><p>No topics match your search.</p></div>';
  container.innerHTML = html;
}

var readingDebounce = null;
document.getElementById('readingSearch').addEventListener('input', function() {
  clearTimeout(readingDebounce);
  readingDebounce = setTimeout(renderReading, 300);
});
['readingCat', 'readingTier'].forEach(function(id) {
  document.getElementById(id).addEventListener('change', renderReading);
});

// ===== DASHBOARD =====
function renderDashboard() {
  // Use fcMastery (flashcard mastery) for actual progress tracking
  var fcMasteredCount = 0, fcLearningCount = 0, fcTotal = 0;
  for (var key in fcMastery) {
    fcTotal++;
    if (fcMastery[key] === 'mastered') fcMasteredCount++;
    if (fcMastery[key] === 'learning') fcLearningCount++;
  }
  var totalQuestions = ALL_QUESTIONS.length;
  var totalPracticed = buzzerHistory.length;
  var avgQuizScore = quizHistory.length > 0 ? (quizHistory.reduce(function(s, q) { return s + q.score; }, 0) / quizHistory.length).toFixed(1) : '-';
  var streakCount = studyStreak.count;

  var buzzerCorrect = buzzerHistory.filter(function(b) { return b.correct; }).length;
  var buzzerPct = buzzerHistory.length > 0 ? Math.round(buzzerCorrect / buzzerHistory.length * 100) : 0;

  var html = '<div class="dash-grid">';
  html += '<div class="dash-card"><h3>Flashcards Studied</h3><div class="dash-big-num">' + fcTotal + '<span class="dash-sub">/' + totalQuestions + '</span></div></div>';
  html += '<div class="dash-card"><h3>Cards Mastered</h3><div class="dash-big-num" style="color:var(--success)">' + fcMasteredCount + '</div></div>';
  html += '<div class="dash-card"><h3>Still Learning</h3><div class="dash-big-num" style="color:var(--warning)">' + fcLearningCount + '</div></div>';
  html += '<div class="dash-card"><h3>Buzzer Questions</h3><div class="dash-big-num">' + totalPracticed + '</div></div>';
  html += '<div class="dash-card"><h3>Avg Quiz Score</h3><div class="dash-big-num">' + avgQuizScore + '<span class="dash-sub">/10</span></div></div>';
  html += '<div class="dash-card"><h3>Study Streak</h3><div class="dash-big-num" style="color:var(--warning)">' + streakCount + ' day' + (streakCount !== 1 ? 's' : '') + '</div></div>';
  html += '</div>';

  // Flashcard mastery by category
  html += '<div class="dash-card" style="margin-bottom:20px"><h3>Flashcard Progress by Category</h3>';
  var cats = ['us', 'european', 'asian', 'african', 'ancient', 'latin', 'other'];
  cats.forEach(function(c) {
    var catQuestions = ALL_QUESTIONS.filter(function(q) { return getQuestionCat(q) === c; });
    var catMastered = catQuestions.filter(function(q) { return fcMastery[q.n] === 'mastered'; }).length;
    var pct = catQuestions.length > 0 ? Math.round(catMastered / catQuestions.length * 100) : 0;
    var colors = { us: '#c92a2a', european: '#1971c2', asian: '#d6336c', african: '#e67700', ancient: '#7048e8', latin: '#2f9e44', other: '#868e96' };
    html += '<div class="progress-bar-container">';
    html += '<div class="progress-label"><span>' + CAT_NAMES[c] + '</span><span>' + catMastered + '/' + catQuestions.length + '</span></div>';
    html += '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + pct + '%;background:' + colors[c] + '"></div></div>';
    html += '</div>';
  });
  html += '</div>';

  // Buzzer accuracy
  if (buzzerHistory.length > 0) {
    html += '<div class="dash-card" style="margin-bottom:20px"><h3>Buzzer Stats</h3>';
    html += '<div class="progress-bar-container">';
    html += '<div class="progress-label"><span>Accuracy</span><span>' + buzzerCorrect + '/' + buzzerHistory.length + ' (' + buzzerPct + '%)</span></div>';
    html += '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + buzzerPct + '%;background:var(--accent)"></div></div>';
    html += '</div></div>';
  }

  // Recent quiz scores
  if (quizHistory.length > 0) {
    html += '<div class="dash-card" style="margin-bottom:20px"><h3>Recent Quiz Scores</h3>';
    quizHistory.slice(-10).reverse().forEach(function(q) {
      var scorePct = q.total > 0 ? Math.round(q.score / q.total * 100) : 0;
      var color = scorePct >= 80 ? 'var(--success)' : scorePct >= 50 ? 'var(--warning)' : 'var(--danger)';
      html += '<div class="weak-area-item"><span>' + new Date(q.date).toLocaleDateString() + '</span><span style="color:' + color + ';font-weight:600">' + q.score + '/' + q.total + '</span></div>';
    });
    html += '</div>';
  }

  // Reset data option
  html += '<div class="dash-card" style="margin-bottom:20px"><h3>Data</h3>';
  html += '<p style="font-size:14px;color:var(--text3);margin-bottom:12px">Your progress is saved on this device.</p>';
  html += '<button id="resetDataBtn" style="padding:10px 20px;border-radius:var(--radius);border:1px solid var(--danger);background:transparent;color:var(--danger);cursor:pointer;font-size:14px">Reset All Progress</button>';
  html += '<div style="margin-top:16px;font-size:12px;color:var(--text3)">v' + APP_VERSION + ' &middot; ' + ALL_QUESTIONS.length + ' questions &middot; ' + ALL_TOPICS.length + ' topics</div>';
  html += '</div>';

  document.getElementById('dashContent').innerHTML = html;

  document.getElementById('resetDataBtn').addEventListener('click', function() {
    if (confirm('Are you sure? This will erase all your study progress.')) {
      fcMastery = {};
      buzzerHistory = [];
      quizHistory = [];
      topicMastery = {};
      studyStreak = { last: '', count: 0 };
      saveData('fcMastery', fcMastery);
      saveData('buzzerHistory', buzzerHistory);
      saveData('quizHistory', quizHistory);
      saveData('topicMastery', topicMastery);
      saveData('studyStreak', studyStreak);
      renderDashboard();
    }
  });
}

// ===== UTILITY =====
function escHtml(s) {
  var d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ===== INIT =====
initTheme();
loadFlashcards();
