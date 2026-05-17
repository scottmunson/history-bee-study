const ALL_QUESTIONS = ALL_QUESTIONS_1.concat(ALL_QUESTIONS_2);
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
let topicMastery = loadData('topicMastery', {});
let buzzerHistory = loadData('buzzerHistory', []);
let quizHistory = loadData('quizHistory', []);
let studyStreak = loadData('studyStreak', { last: '', count: 0 });

function recordStudy() {
  const today = new Date().toISOString().slice(0, 10);
  if (studyStreak.last === today) return;
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (studyStreak.last === yesterday) {
    studyStreak.count++;
  } else {
    studyStreak.count = 1;
  }
  studyStreak.last = today;
  saveData('studyStreak', studyStreak);
}

// ===== THEME =====
function initTheme() {
  const saved = loadData('theme', 'light');
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn(saved);
}
function updateThemeBtn(theme) {
  const btn = document.getElementById('themeToggle');
  btn.innerHTML = theme === 'dark' ? '&#9728;&#65039; Light' : '&#127769; Dark';
}
document.getElementById('themeToggle').addEventListener('click', function() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  saveData('theme', next);
  updateThemeBtn(next);
});

// ===== TABS =====
document.getElementById('mainNav').addEventListener('click', function(e) {
  const btn = e.target.closest('.nav-btn');
  if (!btn) return;
  const tab = btn.getAttribute('data-tab');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  if (tab === 'flashcards') loadFlashcards();
  if (tab === 'reading') renderReading();
  if (tab === 'dashboard') renderDashboard();
});

// ===== CATEGORY HELPERS =====
const CAT_NAMES = { african: 'African', asian: 'Asian', ancient: 'Ancient', european: 'European', latin: 'Latin American', us: 'U.S.', other: 'Other' };
const CAT_ICONS = { african: '&#127757;', asian: '&#127759;', ancient: '&#127963;', european: '&#127758;', latin: '&#127758;', us: '&#127482;&#127480;', other: '&#127760;' };

// ===== BUZZER PRACTICE =====
(function() {
  // Populate filters
  const years = [...new Set(ALL_QUESTIONS.map(q => q.y).filter(Boolean))].sort();
  const rounds = [...new Set(ALL_QUESTIONS.map(q => q.r).filter(Boolean))].sort();
  const yearSel = document.getElementById('buzzerYear');
  const roundSel = document.getElementById('buzzerRound');
  years.forEach(y => { const o = document.createElement('option'); o.value = y; o.textContent = y; yearSel.appendChild(o); });
  rounds.forEach(r => { const o = document.createElement('option'); o.value = r; o.textContent = r; roundSel.appendChild(o); });
})();

let buzzerState = {
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
  const y = document.getElementById('buzzerYear').value;
  const r = document.getElementById('buzzerRound').value;
  return ALL_QUESTIONS.filter(q => (!y || q.y === y) && (!r || q.r === r));
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

document.getElementById('startRoundBtn').addEventListener('click', function() {
  const filtered = getFilteredQuestions();
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
  // Render an array of sentences as separate paragraphs
  el.innerHTML = '';
  sentences.forEach(function(s, idx) {
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
  const acc = buzzerState.total > 0 ? Math.round(buzzerState.correct / buzzerState.total * 100) + '%' : '-';
  document.getElementById('bAccuracy').textContent = acc;
}

function showBuzzerQuestion() {
  if (buzzerState.qIndex >= buzzerState.questions.length) {
    showBuzzerSummary();
    return;
  }
  const q = buzzerState.questions[buzzerState.qIndex];
  // Split into sentences for sentence-by-sentence reveal
  // Split into sentences. Avoid splitting on abbreviations (single capital letter followed by period)
  buzzerState.sentences = q.q.split(/(?<=[a-z\)\"]{2}\.)\s+(?=[A-Z])|(?=For the point,)|(?=For ten points,)/);
  buzzerState.sentenceIndex = 0;
  buzzerState.totalSentences = buzzerState.sentences.length;
  buzzerState.words = q.q.split(/\s+/);  // keep for scoring calc
  buzzerState.wordIndex = 0;
  buzzerState.buzzed = false;
  buzzerState.answered = false;
  buzzerState.startTime = Date.now();
  updateBuzzerStats();

  const area = document.getElementById('buzzerArea');
  area.innerHTML = '<div class="question-display" id="qDisplay"></div>' +
    '<div class="timer-bar-container"><div class="timer-bar" id="timerBar"></div></div>' +
    '<div class="clue-counter" id="clueCounter"></div>' +
    '<button class="buzz-btn" id="buzzBtn">BUZZ!</button>';

  document.getElementById('buzzBtn').addEventListener('click', handleBuzz);

  // Reveal first sentence immediately
  const display = document.getElementById('qDisplay');
  display.textContent = '';
  function revealNextSentence() {
    if (buzzerState.sentenceIndex < buzzerState.sentences.length) {
      var shown = buzzerState.sentences.slice(0, buzzerState.sentenceIndex + 1);
      buzzerState.wordIndex = shown.join(' ').split(/\s+/).length;
      formatSentences(shown, display);
      // Update clue counter
      var counter = document.getElementById('clueCounter');
      if (counter) counter.textContent = 'Clue ' + (buzzerState.sentenceIndex + 1) + ' of ' + buzzerState.totalSentences;
      buzzerState.sentenceIndex++;
    } else {
      clearInterval(buzzerState.timer);
    }
    updateTimerBar();
  }
  revealNextSentence();  // Show first clue right away
  // Reveal subsequent sentences every 5 seconds
  buzzerState.timer = setInterval(revealNextSentence, 5000);

  // Time limit: 5 seconds per sentence + 5 second buffer
  var totalTime = buzzerState.totalSentences * 5000 + 5000;
  buzzerState.totalTime = totalTime;
  buzzerState.timerInterval = setTimeout(function() {
    if (!buzzerState.buzzed) {
      clearInterval(buzzerState.timer);
      timeUp();
    }
  }, totalTime);
}

function updateTimerBar() {
  const elapsed = Date.now() - buzzerState.startTime;
  const totalTime = buzzerState.totalTime || 15000;
  const pct = Math.max(0, 100 - (elapsed / totalTime) * 100);
  const bar = document.getElementById('timerBar');
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

  // Show full question with formatting
  const display = document.getElementById('qDisplay');
  formatSentences(buzzerState.sentences, display);

  // Replace buzz button with answer input
  const area = document.getElementById('buzzerArea');
  const buzzBtn = document.getElementById('buzzBtn');
  buzzBtn.style.display = 'none';

  const inputArea = document.createElement('div');
  inputArea.className = 'answer-input-area';
  inputArea.innerHTML = '<input type="text" id="answerInput" placeholder="Type your answer..." autofocus>' +
    '<button class="next-btn" id="submitAnswer">Submit</button>';
  area.appendChild(inputArea);

  const input = document.getElementById('answerInput');
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
  // Exact match
  if (u === c) return true;
  // Substring match (typed answer is inside correct or vice versa)
  if (c.includes(u) && u.length >= 3) return true;
  if (u.includes(c) && c.length >= 3) return true;
  // Last name match — if correct answer is "FirstName LastName", accept just "LastName"
  var cParts = c.split(' ');
  if (cParts.length >= 2) {
    var lastName = cParts[cParts.length - 1];
    if (lastName.length >= 3 && (u === lastName || levenshtein(u, lastName) <= 1)) return true;
  }
  // Levenshtein tolerance — allow 1 typo for short answers, 2 for longer ones
  var maxDist = c.length <= 5 ? 1 : c.length <= 10 ? 2 : 3;
  if (levenshtein(u, c) <= maxDist) return true;
  // Word overlap — at least half the significant words match
  var cWords = c.split(' ').filter(function(w) { return w.length > 2; });
  var uWords = u.split(' ').filter(function(w) { return w.length > 2; });
  if (cWords.length > 0) {
    var matchCount = cWords.filter(function(w) {
      return uWords.some(function(uw) { return uw === w || levenshtein(uw, w) <= 1; });
    }).length;
    if (matchCount >= Math.ceil(cWords.length * 0.5) && matchCount >= 1) return true;
  }
  // Also check if the answer within parentheses in the full answer matches
  // e.g. "Elizabeth Cady Stanton (accept either underlined name)"
  var parenMatch = correctAns.match(/\((?:accept|or)\s+(.+?)\)/i);
  if (parenMatch) {
    var alt = normalize(parenMatch[1]);
    if (alt && (u === alt || alt.includes(u) || u.includes(alt) || levenshtein(u, alt) <= 2)) return true;
  }
  return false;
}

function findTeachableMoment(answerText) {
  // Try to find a matching topic description for this answer
  var norm = function(s) { return s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim(); };
  var aNorm = norm(answerText);
  // Direct match first
  for (var key in TOPIC_DESCS) {
    if (norm(key) === aNorm) return { topic: key, info: TOPIC_DESCS[key] };
  }
  // Partial match — answer contained in topic name or vice versa
  for (var key in TOPIC_DESCS) {
    var kNorm = norm(key);
    if (kNorm.includes(aNorm) || aNorm.includes(kNorm)) return { topic: key, info: TOPIC_DESCS[key] };
  }
  // Try last name only
  var parts = aNorm.split(' ');
  if (parts.length >= 2) {
    var last = parts[parts.length - 1];
    for (var key in TOPIC_DESCS) {
      if (norm(key).includes(last) && last.length >= 4) return { topic: key, info: TOPIC_DESCS[key] };
    }
  }
  return null;
}

function checkBuzzerAnswer() {
  if (buzzerState.answered) return;
  buzzerState.answered = true;
  const q = buzzerState.questions[buzzerState.qIndex];
  const userAns = document.getElementById('answerInput').value;

  // Check against primary answer and full answer
  const isCorrect = fuzzyMatch(userAns, q.a) || fuzzyMatch(userAns, q.af);

  const cluesShown = buzzerState.sentenceIndex || 1;
  const totalClues = buzzerState.totalSentences || 1;
  const earlyBuzz = cluesShown / totalClues < 0.6;

  let points = 0;
  if (isCorrect) {
    points = earlyBuzz ? 10 : 5;
    buzzerState.correct++;
    buzzerState.streak++;
  } else {
    points = -5;
    buzzerState.streak = 0;
  }
  buzzerState.score += points;
  buzzerState.total++;
  updateBuzzerStats();

  // Save to history
  buzzerHistory.push({ q: q.q, a: q.a, userAns: userAns, correct: isCorrect, points: points, date: new Date().toISOString() });
  saveData('buzzerHistory', buzzerHistory);

  // Show result
  const area = document.getElementById('buzzerArea');
  const result = document.createElement('div');
  result.className = 'result-display ' + (isCorrect ? 'correct' : 'wrong');
  result.innerHTML = isCorrect ?
    '&#10004; Correct! ' + (earlyBuzz ? '+10 (early buzz!)' : '+5') :
    '&#10008; Not quite. The answer is below.';
  area.appendChild(result);

  const correctDiv = document.createElement('div');
  correctDiv.className = 'correct-answer-display';
  correctDiv.innerHTML = '<strong>Answer:</strong> ' + escHtml(q.af);
  if (!isCorrect && userAns) correctDiv.innerHTML += '<br><span style="color:var(--text3);font-size:13px">You said: ' + escHtml(userAns) + '</span>';
  area.appendChild(correctDiv);

  const nextBtn = document.createElement('button');
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

  // Show "time's up" but let them still guess
  var prompt = document.createElement('div');
  prompt.className = 'result-display';
  prompt.style.background = 'var(--gold-bg)';
  prompt.style.color = 'var(--warning)';
  prompt.innerHTML = "&#9200; Time is up! Take your best guess:";
  area.appendChild(prompt);

  var inputArea = document.createElement('div');
  inputArea.className = 'answer-input-area';
  inputArea.innerHTML = '<input type="text" id="answerInput" placeholder="Type your guess..." autofocus>' +
    '<button class="next-btn" id="submitAnswer">Submit</button>' +
    '<button class="next-btn" id="skipGuess" style="background:var(--bg3);color:var(--text2)">Show Answer</button>';
  area.appendChild(inputArea);

  var input = document.getElementById('answerInput');
  input.focus();

  function revealTimeUpAnswer(userAns) {
    if (buzzerState.answered) return;
    buzzerState.answered = true;
    // Remove the input area and prompt
    inputArea.remove();
    prompt.remove();

    var isCorrect = userAns && (fuzzyMatch(userAns, q.a) || fuzzyMatch(userAns, q.af));

    if (isCorrect) {
      buzzerState.correct++;
      buzzerState.score += 2;  // Small reward for knowing it even after time
      updateBuzzerStats();
    }
    buzzerState.streak = 0;
    updateBuzzerStats();

    var result = document.createElement('div');
    result.className = 'result-display ' + (isCorrect ? 'correct' : 'wrong');
    if (isCorrect) {
      result.innerHTML = '&#10004; You knew it! +2 (but remember to buzz faster next time!)';
    } else if (userAns) {
      result.innerHTML = '&#10008; Not quite.';
    } else {
      result.innerHTML = '&#9200; No guess — check the answer below.';
    }
    area.appendChild(result);

    var correctDiv = document.createElement('div');
    correctDiv.className = 'correct-answer-display';
    correctDiv.innerHTML = '<strong>Answer:</strong> ' + escHtml(q.af);
    if (!isCorrect && userAns) correctDiv.innerHTML += '<br><span style="color:var(--text3);font-size:13px">You said: ' + escHtml(userAns) + '</span>';
    area.appendChild(correctDiv);

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
  const area = document.getElementById('buzzerArea');
  area.innerHTML = '<div style="text-align:center">' +
    '<h2>Round Complete!</h2>' +
    '<div class="quiz-score-display">' + buzzerState.score + ' pts</div>' +
    '<p style="font-size:18px;margin-bottom:16px">' + buzzerState.correct + '/' + buzzerState.total + ' correct</p>' +
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
// Flashcards use REAL competition questions as prompts.
// Each card shows the question clues — user tries to identify the answer.

var fcState = { cards: [], index: 0, revealed: false };
var fcMastery = loadData('fcMastery') || {}; // per-question mastery, keyed by question number

// Build a lookup: answer name → topic object (for category metadata)
var answerToTopic = {};
ALL_TOPICS.forEach(function(t) { answerToTopic[t.name.toLowerCase().trim()] = t; });

function getTopicForAnswer(answer) {
  var norm = answer.toLowerCase().trim();
  if (answerToTopic[norm]) return answerToTopic[norm];
  // Try partial match
  for (var key in answerToTopic) {
    if (key.includes(norm) || norm.includes(key)) return answerToTopic[key];
  }
  return null;
}

// Assign a category to each question based on its answer
function getQuestionCat(q) {
  var t = getTopicForAnswer(q.a);
  return t ? t.cat : 'other';
}

function shuffleArray(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

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

  progress.innerHTML = 'Card ' + (fcState.index + 1) + ' of ' + fcState.cards.length +
    ' &nbsp;&middot;&nbsp; ' + gotItCount + ' got it';

  fcState.revealed = false;

  area.innerHTML = '';
  var card = document.createElement('div');
  card.className = 'fc-card-single';

  // Build the clue text — show the full question as reading clues
  var clueText = q.q;
  var promptHTML = '<div class="fc-prompt-label">Read the clues. Who or what is this?</div>' +
    '<div class="fc-prompt">' + escHtml(clueText) + '</div>' +
    '<div class="fc-tap-hint">Click or press Space to reveal the answer</div>';

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
    area.innerHTML = '<div style="text-align:center;padding:40px">' +
      '<h2 style="margin-bottom:12px">Deck complete!</h2>' +
      '<p style="font-size:18px;color:var(--text2);margin-bottom:8px">You got ' + gotItCount + ' of ' + fcState.cards.length + ' cards right.</p>' +
      '<p style="color:var(--text3);margin-bottom:20px">Change filters or shuffle to study again.</p>' +
      '<button id="fcRestartBtn" style="padding:10px 28px;border-radius:var(--radius);border:none;background:var(--accent);color:white;font-size:16px;font-weight:600;cursor:pointer">Start Over</button></div>';
    document.getElementById('fcRestartBtn').addEventListener('click', loadFlashcards);
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
let quizState = {
  active: false,
  questions: [],
  qIndex: 0,
  score: 0,
  answers: [],
  selectedAnswer: null
};

document.getElementById('startQuizBtn').addEventListener('click', function() {
  const cat = document.getElementById('quizCat').value;
  let pool = ALL_QUESTIONS.filter(q => q.a && q.a.length > 0);
  if (cat) {
    // Filter questions that are likely about this category
    // Use topics to help
    const catTopics = ALL_TOPICS.filter(t => t.cat === cat).map(t => t.name.toLowerCase());
    pool = pool.filter(q => {
      const qa = q.a.toLowerCase();
      const qq = q.q.toLowerCase();
      return catTopics.some(t => qa.includes(t) || qq.includes(t));
    });
    if (pool.length < 10) pool = ALL_QUESTIONS.filter(q => q.a && q.a.length > 0);
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
  const q = quizState.questions[quizState.qIndex];
  quizState.selectedAnswer = null;

  // Generate wrong answers
  const allAnswers = [...new Set(ALL_QUESTIONS.map(q => q.a).filter(a => a && a.length > 0))];
  const wrongAnswers = shuffle(allAnswers.filter(a => a !== q.a)).slice(0, 3);
  const options = shuffle([q.a, ...wrongAnswers]);

  const area = document.getElementById('quizArea');
  area.innerHTML = '<div class="quiz-area">' +
    '<div class="quiz-progress">Question ' + (quizState.qIndex + 1) + ' of ' + quizState.questions.length + ' | Score: ' + quizState.score + '/10</div>' +
    '<div class="quiz-question">' + escHtml(q.q) + '</div>' +
    '<div class="quiz-options" id="quizOptions"></div>' +
    '<button class="next-btn" id="quizNextBtn" style="display:none;margin-top:16px;">Next Question</button>' +
  '</div>';

  const optionsDiv = document.getElementById('quizOptions');
  options.forEach(function(opt) {
    const btn = document.createElement('div');
    btn.className = 'quiz-option';
    btn.textContent = opt;
    btn.addEventListener('click', function() { selectQuizAnswer(btn, opt, q.a); });
    optionsDiv.appendChild(btn);
  });

  document.getElementById('quizNextBtn').addEventListener('click', function() {
    quizState.qIndex++;
    showQuizQuestion();
  });
}

function selectQuizAnswer(btn, selected, correct) {
  if (quizState.selectedAnswer !== null) return;
  quizState.selectedAnswer = selected;
  const isCorrect = selected === correct;
  if (isCorrect) quizState.score++;

  quizState.answers.push({
    q: quizState.questions[quizState.qIndex].q,
    correct: correct,
    selected: selected,
    isCorrect: isCorrect
  });

  // Highlight answers
  document.querySelectorAll('.quiz-option').forEach(function(opt) {
    opt.style.cursor = 'default';
    if (opt.textContent === correct) opt.classList.add('correct');
    if (opt.textContent === selected && !isCorrect) opt.classList.add('wrong');
  });

  document.getElementById('quizNextBtn').style.display = 'inline-block';
  document.getElementById('quizNextBtn').textContent = quizState.qIndex < quizState.questions.length - 1 ? 'Next Question' : 'See Results';
}

function showQuizResults() {
  quizState.active = false;
  const missed = quizState.answers.filter(a => !a.isCorrect);

  // Save quiz history
  quizHistory.push({ score: quizState.score, total: quizState.questions.length, date: new Date().toISOString(), missed: missed.length });
  saveData('quizHistory', quizHistory);

  let html = '<div class="quiz-results">' +
    '<h2>Quiz Complete!</h2>' +
    '<div class="quiz-score-display">' + quizState.score + '/' + quizState.questions.length + '</div>';

  if (missed.length > 0) {
    html += '<h3 style="margin-top:20px;margin-bottom:12px">Missed Questions:</h3><div class="quiz-missed-list">';
    missed.forEach(function(m) {
      html += '<div class="quiz-missed-item">' +
        '<div class="missed-q">' + escHtml(m.q.substring(0, 150)) + '...</div>' +
        '<div class="missed-a">Correct: ' + escHtml(m.correct) + '</div>' +
        '<div class="missed-yours">Your answer: ' + escHtml(m.selected) + '</div>' +
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
  const search = document.getElementById('readingSearch').value.toLowerCase();
  const cat = document.getElementById('readingCat').value;
  const tier = document.getElementById('readingTier').value;

  let filtered = ALL_TOPICS.filter(function(t) {
    if (cat && t.cat !== cat) return false;
    if (tier && t.tier !== parseInt(tier)) return false;
    if (search && !t.name.toLowerCase().includes(search)) return false;
    return true;
  });

  // Group by category
  const catOrder = ['us', 'european', 'asian', 'african', 'ancient', 'latin', 'other'];
  const grouped = {};
  filtered.forEach(function(t) {
    if (!grouped[t.cat]) grouped[t.cat] = [];
    grouped[t.cat].push(t);
  });

  const container = document.getElementById('readingContent');
  let html = '';

  catOrder.forEach(function(c) {
    if (!grouped[c] || grouped[c].length === 0) return;
    const topics = grouped[c];
    // Sort by tier then name
    topics.sort(function(a, b) { return a.tier - b.tier || a.name.localeCompare(b.name); });

    html += '<div class="reading-category">';
    html += '<h2><span class="cat-dot cat-' + c + '"></span> ' + CAT_NAMES[c] + ' History (' + topics.length + ' topics)</h2>';

    // Group by tier
    [0, 1, 2, 3, 4].forEach(function(ti) {
      var tierTopics = topics.filter(t => t.tier === ti);
      if (tierTopics.length === 0) return;
      html += '<div class="reading-tier-group">';
      html += '<h3><span class="tier-badge tier-' + ti + '">' + (ti === 0 ? 'Hot Topics' : 'Tier ' + ti) + '</span> ' +
        (ti === 0 ? '2025-2026 Current Events & Anniversaries' : ti === 1 ? 'Must Know' : ti === 2 ? 'Important' : ti === 3 ? 'Good to Know' : 'Extra Credit') +
        ' (' + tierTopics.length + ')</h3>';

      tierTopics.forEach(function(t) {
        const desc = TOPIC_DESCS[t.name] || { desc: 'Study this topic for the History Bee.', facts: [] };
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

let readingDebounce = null;
document.getElementById('readingSearch').addEventListener('input', function() {
  clearTimeout(readingDebounce);
  readingDebounce = setTimeout(renderReading, 300);
});
['readingCat', 'readingTier'].forEach(function(id) {
  document.getElementById(id).addEventListener('change', renderReading);
});

// ===== DASHBOARD =====
function renderDashboard() {
  const masteredCount = Object.values(topicMastery).filter(v => v === 'mastered').length;
  const learningCount = Object.values(topicMastery).filter(v => v === 'learning').length;
  const totalTopics = ALL_TOPICS.length;
  const totalPracticed = buzzerHistory.length;
  const avgQuizScore = quizHistory.length > 0 ? (quizHistory.reduce((s, q) => s + q.score, 0) / quizHistory.length).toFixed(1) : '-';
  const streakCount = studyStreak.count;

  let html = '<div class="dash-grid">';
  html += '<div class="dash-card"><h3>Total Topics</h3><div class="dash-big-num">' + totalTopics + '</div></div>';
  html += '<div class="dash-card"><h3>Mastered</h3><div class="dash-big-num" style="color:var(--success)">' + masteredCount + '</div></div>';
  html += '<div class="dash-card"><h3>Questions Practiced</h3><div class="dash-big-num">' + totalPracticed + '</div></div>';
  html += '<div class="dash-card"><h3>Avg Quiz Score</h3><div class="dash-big-num">' + avgQuizScore + '</div></div>';
  html += '<div class="dash-card"><h3>Study Streak</h3><div class="dash-big-num" style="color:var(--warning)">' + streakCount + ' day' + (streakCount !== 1 ? 's' : '') + '</div></div>';
  html += '<div class="dash-card"><h3>Quizzes Taken</h3><div class="dash-big-num">' + quizHistory.length + '</div></div>';
  html += '</div>';

  // Progress by category
  html += '<div class="dash-card" style="margin-bottom:20px"><h3>Progress by Category</h3>';
  const cats = ['us', 'european', 'asian', 'african', 'ancient', 'latin', 'other'];
  cats.forEach(function(c) {
    const catTopics = ALL_TOPICS.filter(t => t.cat === c);
    const catMastered = catTopics.filter(t => topicMastery[t.name] === 'mastered').length;
    const pct = catTopics.length > 0 ? Math.round(catMastered / catTopics.length * 100) : 0;
    const colors = { us: '#c92a2a', european: '#1971c2', asian: '#d6336c', african: '#e67700', ancient: '#7048e8', latin: '#2f9e44', other: '#868e96' };
    html += '<div class="progress-bar-container">';
    html += '<div class="progress-label"><span>' + CAT_NAMES[c] + '</span><span>' + catMastered + '/' + catTopics.length + '</span></div>';
    html += '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + pct + '%;background:' + colors[c] + '"></div></div>';
    html += '</div>';
  });
  html += '</div>';

  // Progress by tier
  html += '<div class="dash-card" style="margin-bottom:20px"><h3>Progress by Tier</h3>';
  [0, 1, 2, 3, 4].forEach(function(ti) {
    const tierTopics = ALL_TOPICS.filter(t => t.tier === ti);
    const tierMastered = tierTopics.filter(t => topicMastery[t.name] === 'mastered').length;
    const pct = tierTopics.length > 0 ? Math.round(tierMastered / tierTopics.length * 100) : 0;
    const colors = { 0: '#e03131', 1: '#e03131', 2: '#e67700', 3: '#1971c2', 4: '#868e96' };
    const names = { 0: 'Hot Topics (2025-2026)', 1: 'Tier 1 (Must Know)', 2: 'Tier 2 (Important)', 3: 'Tier 3 (Good to Know)', 4: 'Tier 4 (Extra Credit)' };
    html += '<div class="progress-bar-container">';
    html += '<div class="progress-label"><span>' + names[ti] + '</span><span>' + tierMastered + '/' + tierTopics.length + '</span></div>';
    html += '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + pct + '%;background:' + colors[ti] + '"></div></div>';
    html += '</div>';
  });
  html += '</div>';

  // Recent quiz scores
  if (quizHistory.length > 0) {
    html += '<div class="dash-card" style="margin-bottom:20px"><h3>Recent Quiz Scores</h3>';
    quizHistory.slice(-10).reverse().forEach(function(q) {
      html += '<div class="weak-area-item"><span>' + new Date(q.date).toLocaleDateString() + '</span><span>' + q.score + '/' + q.total + '</span></div>';
    });
    html += '</div>';
  }

  // Buzzer accuracy
  if (buzzerHistory.length > 0) {
    const correct = buzzerHistory.filter(b => b.correct).length;
    const total = buzzerHistory.length;
    html += '<div class="dash-card"><h3>Buzzer Stats</h3>';
    html += '<div class="progress-bar-container">';
    html += '<div class="progress-label"><span>Accuracy</span><span>' + correct + '/' + total + ' (' + Math.round(correct/total*100) + '%)</span></div>';
    html += '<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:' + Math.round(correct/total*100) + '%;background:var(--accent)"></div></div>';
    html += '</div></div>';
  }

  document.getElementById('dashContent').innerHTML = html;
}

// ===== UTILITY =====
function escHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// ===== INIT =====
initTheme();
loadFlashcards();