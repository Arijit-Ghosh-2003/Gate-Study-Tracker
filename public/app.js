// =============================================================
// PASTE THIS AT THE VERY TOP (LINE 1) OF public/app.js
// =============================================================
const SoundEngine = {
  ctx: null,
  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  },
  playClick() {
    this.init();
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(1000, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.15, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.04);
    osc.connect(gain); gain.connect(this.ctx.destination);
    osc.start(); osc.stop(this.ctx.currentTime + 0.04);
  },
  playHalftime() {
    this.init(); if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + idx * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.15 + 0.3);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.15); osc.stop(now + idx * 0.15 + 0.3);
    });
  },
  playQuarter() {
    this.init(); if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [0, 0.15].forEach(delay => {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = 'triangle'; osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.25, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.1);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + delay); osc.stop(now + delay + 0.1);
    });
  },
  playFinish() {
    this.init(); if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator(), gain = this.ctx.createGain();
      osc.type = 'sine'; osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.12 + 0.5);
      osc.connect(gain); gain.connect(this.ctx.destination);
      osc.start(now + idx * 0.12); osc.stop(now + idx * 0.12 + 0.5);
    });
  }
};

function triggerHapticFeedback(ms = 15) {
  if ('vibrate' in navigator) navigator.vibrate(ms);
}

// =============================================================
// YOUR EXISTING CODE CONTINUES HERE BELOW
// =============================================================

let currentSession = null;
let timerInterval = null;
let heartbeatInterval = null;
let activeSeconds = 0;
let targetRemainingSeconds = 0;
let notificationFired = false;

document.addEventListener('DOMContentLoaded', () => {
  init();

  // Request browser notification permissions
  if ('Notification' in window && Notification.permission !== 'granted') {
    Notification.requestPermission();
  }

  // Radio button listener for mode switching
  document.querySelectorAll('input[name="session_mode"]').forEach(radio => {
    radio.addEventListener('change', updateFormLabels);
  });

  document.getElementById('start-form').addEventListener('submit', startSession);
  document.getElementById('pause-btn').addEventListener('click', pauseSession);
  document.getElementById('resume-btn').addEventListener('click', resumeSession);
  document.getElementById('end-btn').addEventListener('click', endSession);
  document.getElementById('extend-custom-btn').addEventListener('click', promptExtendTarget);

  // Quick extend buttons on alert
  document.querySelectorAll('.extend-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mins = parseInt(e.target.dataset.mins);
      extendTargetTime(mins);
    });
  });
  
    // Universal click audio + haptics listener
  document.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('.btn') || e.target.closest('input[type="radio"]')) {
      SoundEngine.playClick();
      triggerHapticFeedback(15);
    }
  });

  // New button listeners
  document.getElementById('long-break-btn').addEventListener('click', () => triggerLongInterrupt('long_interruption'));
  document.getElementById('target-unachieved-btn').addEventListener('click', () => triggerLongInterrupt('target_not_achieved'));
  document.getElementById('modal-resume-btn').addEventListener('click', handleModalResume);
  document.getElementById('modal-new-btn').addEventListener('click', handleModalNewSession);
});

async function init() {
  updateFormLabels();
  await loadLastInputs();
  await loadCurrentSession();
  await loadSummaryAnalytics();
  await loadHeatmap();
  await loadHistory();
}

// 1. Dynamic Form Labeling based on Study vs Practice Exam Mode
function updateFormLabels() {
  const mode = document.querySelector('input[name="session_mode"]:checked').value;
  const lblSubject = document.getElementById('lbl-subject');
  const lblTopic = document.getElementById('lbl-topic');
  const lblPlatform = document.getElementById('lbl-platform');
  const lblTarget = document.getElementById('lbl-target');
  const lblType = document.getElementById('lbl-type');
  const inpType = document.getElementById('inp-type');

  if (mode === 'study') {
    lblSubject.innerText = 'Subject Name';
    lblTopic.innerText = 'Chapter / Topic Name';
    lblPlatform.innerText = 'Study Platform / Source';
    lblTarget.innerText = 'Session Target / Goal';
    lblType.innerText = 'Study Type';

    inpType.innerHTML = `
      <option value="Fresh Study">Fresh Study / New Learning</option>
      <option value="Revision">Revision</option>
    `;
  } else {
    lblSubject.innerText = 'Exam / Subject Name';
    lblTopic.innerText = 'Mock Test / Topic Test Name';
    lblPlatform.innerText = 'Test Series / Platform Name';
    lblTarget.innerText = 'Target Score / Goals';
    lblType.innerText = 'Practice Exam Category';

    inpType.innerHTML = `
      <option value="Full Length Test">Full Length Mock Test</option>
      <option value="Subject Test">Subject Test</option>
      <option value="Topic Test">Topic Test</option>
    `;
  }
}

// 2. Pre-fill Form with Last Session Data
async function loadLastInputs() {
  try {
    const res = await fetch('/api/session/last-inputs');
    const { lastInput } = await res.json();

    if (lastInput) {
      const modeRadio = document.querySelector(`input[name="session_mode"][value="${lastInput.session_mode}"]`);
      if (modeRadio) {
        modeRadio.checked = true;
        updateFormLabels();
      }

      document.getElementById('inp-subject').value = lastInput.subject || '';
      document.getElementById('inp-topic').value = lastInput.topic || '';
      document.getElementById('inp-platform').value = lastInput.platform || '';
      document.getElementById('inp-target').value = lastInput.target_goal || '';
      document.getElementById('inp-type').value = lastInput.study_type || '';
      
      if (lastInput.target_duration_seconds) {
        const totalMins = Math.floor(lastInput.target_duration_seconds / 60);
        document.getElementById('inp-target-hrs').value = Math.floor(totalMins / 60);
        document.getElementById('inp-target-mins').value = totalMins % 60;
      }
    }
  } catch (err) {
    console.error('Error fetching last inputs:', err);
  }
}

// 3. Load Active or Interrupted Session
// REPLACE your existing loadCurrentSession() with this:
async function loadCurrentSession() {
  const res = await fetch('/api/session/current');
  const data = await res.json();

  if (data.session) {
    currentSession = data.session;
    activeSeconds = currentSession.total_active_seconds || 0;

    if (currentSession.status === 'active') {
      const lastHeartbeat = new Date(currentSession.last_heartbeat);
      const now = new Date();
      const elapsedSinceHeartbeat = Math.max(0, Math.floor((now - lastHeartbeat) / 1000));
      activeSeconds += elapsedSinceHeartbeat;
      renderActiveSessionUI();
      startTimer();
    } else if (currentSession.status === 'paused' || currentSession.status === 'long_interruption') {
      // Show continuation popup when reopening an interrupted session
      showContinuationModal(currentSession);
    }
  } else {
    showSetupUI();
  }
}
// PASTE THESE 4 FUNCTIONS DIRECTLY BELOW loadCurrentSession():

function showContinuationModal(session) {
  const modal = document.getElementById('continuation-modal');
  const infoText = document.getElementById('modal-session-info');
  infoText.innerHTML = `Previous session for <strong>${escapeHtml(session.topic)}</strong> (${escapeHtml(session.subject)}) was interrupted. Total active study time saved: <strong>${Math.floor(session.total_active_seconds / 60)} mins</strong>.`;
  modal.classList.remove('hidden');
}

async function handleModalResume() {
  document.getElementById('continuation-modal').classList.add('hidden');
  renderActiveSessionUI();
  await resumeSession();
}

async function handleModalNewSession() {
  document.getElementById('continuation-modal').classList.add('hidden');
  if (currentSession) {
    await fetch('/api/session/end', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: currentSession.id, activeSeconds, statusReason: 'target_not_achieved' })
    });
  }
  currentSession = null;
  activeSeconds = 0;
  showSetupUI();
  await loadSummaryAnalytics();
  await loadHeatmap();
  await loadHistory();
}

async function triggerLongInterrupt(reason) {
  stopTimer();
  if (!currentSession) return;

  await fetch('/api/session/long-interrupt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: currentSession.id, activeSeconds, statusReason: reason })
  });

  currentSession = null;
  activeSeconds = 0;
  showSetupUI();

  await loadSummaryAnalytics();
  await loadHeatmap();
  await loadHistory();
}

function renderActiveSessionUI() {
  document.getElementById('session-setup').classList.add('hidden');
  document.getElementById('active-session').classList.remove('hidden');

  document.getElementById('current-topic-display').innerText = currentSession.topic;
  document.getElementById('current-meta-display').innerText = 
    `${currentSession.subject} • ${currentSession.platform} • Target: ${currentSession.target_goal || 'N/A'} (${currentSession.study_type})`;

  const badge = document.getElementById('status-badge');
  badge.innerText = currentSession.status === 'active' ? 'STUDYING' : 'INTERRUPTED';
  badge.style.background = currentSession.status === 'active' ? '#22c55e' : '#f59e0b';

  const modeBadge = document.getElementById('mode-display-badge');
  modeBadge.innerText = currentSession.session_mode.toUpperCase().replace('_', ' ');
}

function showSetupUI() {
  document.getElementById('session-setup').classList.remove('hidden');
  document.getElementById('active-session').classList.add('hidden');
  document.getElementById('target-reached-alert').classList.add('hidden');
  stopTimer();
}

function startTimer() {
  stopTimer();
  notificationFired = false;

  timerInterval = setInterval(() => {
    activeSeconds++;
    updateTimerDisplay();
  }, 1000);

  heartbeatInterval = setInterval(sendHeartbeat, 10000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
}

// 🟢 REPLACE WITH THIS UPDATED VERSION IN public/app.js:
function updateTimerDisplay() {
  // 1. Elapsed Active Time Display
  const hrs = String(Math.floor(activeSeconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((activeSeconds % 3600) / 60)).padStart(2, '0');
  const secs = String(activeSeconds % 60).padStart(2, '0');
  document.getElementById('timer-display').innerText = `${hrs}:${mins}:${secs}`;

  // 2. Target Countdown & Audio Milestone Checks
  if (currentSession) {
    const totalTargetSecs = (currentSession.target_duration_seconds || 0) + (currentSession.extended_duration_seconds || 0);
    targetRemainingSeconds = totalTargetSecs - activeSeconds;

    if (totalTargetSecs > 0) {
      const progress = activeSeconds / totalTargetSecs;

      // 50% Halftime Audio Milestone (Upward Chime)
      if (progress >= 0.5 && progress < 0.75 && !milestone50Fired) {
        milestone50Fired = true;
        SoundEngine.playHalftime();
      }

      // 75% Quarter Time Remaining Audio Milestone (Double Pulse)
      if (progress >= 0.75 && progress < 1.0 && !milestone75Fired) {
        milestone75Fired = true;
        SoundEngine.playQuarter();
      }

      // 100% Target Completed Audio Milestone (Fanfare Chord + Haptics)
      if (targetRemainingSeconds <= 0) {
        document.getElementById('target-countdown-display').innerText = '00:00:00';
        document.getElementById('target-status-subtext').innerText = '🎯 Target Time Reached!';
        document.getElementById('target-reached-alert').classList.remove('hidden');

        if (!milestone100Fired) {
          milestone100Fired = true;
          SoundEngine.playFinish();
          triggerHapticFeedback([100, 50, 100]);
        }
      } else {
        document.getElementById('target-reached-alert').classList.add('hidden');
        const tHrs = String(Math.floor(targetRemainingSeconds / 3600)).padStart(2, '0');
        const tMins = String(Math.floor((targetRemainingSeconds % 3600) / 60)).padStart(2, '0');
        const tSecs = String(targetRemainingSeconds % 60).padStart(2, '0');
        document.getElementById('target-countdown-display').innerText = `${tHrs}:${tMins}:${tSecs}`;
        document.getElementById('target-status-subtext').innerText = 'Runs only during active session';
      }
    }
  }
}

function triggerNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🎯 Mission GATE 2027 Alert', {
      body: `Your target time for "${currentSession.topic}" has completed!`,
      icon: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png'
    });
  }
}

async function sendHeartbeat() {
  if (!currentSession || currentSession.status !== 'active') return;
  await fetch('/api/session/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: currentSession.id, activeSeconds })
  });
}

// 4. Start Session
async function startSession(e) {
  e.preventDefault();

  const session_mode = document.querySelector('input[name="session_mode"]:checked').value;
  const subject = document.getElementById('inp-subject').value;
  const topic = document.getElementById('inp-topic').value;
  const platform = document.getElementById('inp-platform').value;
  const target_goal = document.getElementById('inp-target').value;
  const study_type = document.getElementById('inp-type').value;
  const hrs = parseInt(document.getElementById('inp-target-hrs').value) || 0;
  const mins = parseInt(document.getElementById('inp-target-mins').value) || 0;
  const target_minutes = (hrs * 60) + mins;

  const res = await fetch('/api/session/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_mode, subject, topic, platform, target_goal, study_type, target_minutes })
  });

  const data = await res.json();
  currentSession = data.session;
  activeSeconds = 0;

  document.getElementById('pause-btn').classList.remove('hidden');
  document.getElementById('resume-btn').classList.add('hidden');

  renderActiveSessionUI();
  startTimer();
}

async function extendTargetTime(additionalMins) {
  if (!currentSession) return;
  await fetch('/api/session/extend-target', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: currentSession.id, additionalMinutes: additionalMins })
  });

  currentSession.extended_duration_seconds = (currentSession.extended_duration_seconds || 0) + (additionalMins * 60);
  notificationFired = false;
  document.getElementById('target-reached-alert').classList.add('hidden');
  updateTimerDisplay();
}

function promptExtendTarget() {
  const mins = prompt('Enter additional target minutes to extend:', '30');
  if (mins && !isNaN(mins)) {
    extendTargetTime(parseInt(mins));
  }
}

async function pauseSession() {
  stopTimer();
  currentSession.status = 'paused';

  await fetch('/api/session/pause', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: currentSession.id, activeSeconds })
  });

  showPauseState();
  await loadSummaryAnalytics();
}

function showPauseState() {
  const badge = document.getElementById('status-badge');
  badge.innerText = 'INTERRUPTED';
  badge.style.background = '#f59e0b';
  document.getElementById('pause-btn').classList.add('hidden');
  document.getElementById('resume-btn').classList.remove('hidden');
}

async function resumeSession() {
  currentSession.status = 'active';

  await fetch('/api/session/resume', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: currentSession.id })
  });

  const badge = document.getElementById('status-badge');
  badge.innerText = 'STUDYING';
  badge.style.background = '#22c55e';
  document.getElementById('pause-btn').classList.remove('hidden');
  document.getElementById('resume-btn').classList.add('hidden');

  startTimer();
}

async function endSession() {
  stopTimer();

  await fetch('/api/session/end', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: currentSession.id, activeSeconds })
  });

  currentSession = null;
  activeSeconds = 0;
  showSetupUI();
  
  await loadSummaryAnalytics();
  await loadHeatmap();
  await loadHistory();
}

// 5. Load Summary Analytics Header Values
async function loadSummaryAnalytics() {
  const res = await fetch('/api/analytics/summary');
  const data = await res.json();

  document.getElementById('top-daily-time').innerText = formatHoursMins(data.daily_seconds);
  document.getElementById('top-daily-break-count').innerText = `${data.daily_interruption_count} breaks`;
  document.getElementById('top-daily-break-time').innerText = formatHoursMins(data.daily_interruption_seconds);

  document.getElementById('stat-weekly-time').innerText = formatHoursMins(data.weekly_seconds);
  document.getElementById('stat-monthly-time').innerText = formatHoursMins(data.monthly_seconds);
}

function formatHoursMins(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

// 6. Heatmap
function getHeatmapLevel(minutes) {
  if (minutes <= 0) return 'lvl-0';      // 0 min
  if (minutes < 30) return 'lvl-1';      // < 30 min
  if (minutes < 45) return 'lvl-2';      // 30 min
  if (minutes < 60) return 'lvl-3';      // 45 min
  if (minutes < 120) return 'lvl-4';     // 1 hr
  if (minutes < 180) return 'lvl-5';     // 2 hr
  if (minutes < 360) return 'lvl-6';     // 3 hr
  if (minutes < 480) return 'lvl-7';     // 6 hr
  if (minutes < 600) return 'lvl-8';     // 8 hr
  if (minutes < 720) return 'lvl-9';     // 10 hr
  if (minutes < 960) return 'lvl-10';    // 12 hr
  return 'lvl-11';                       // 16 hr+
}

async function loadHeatmap() {
  const res = await fetch('/api/analytics/heatmap');
  const { data } = await res.json();

  const activityMap = {};
  data.forEach(item => {
    const dateStr = new Date(item.date).toISOString().split('T')[0];
    activityMap[dateStr] = item.total_seconds;
  });

  const container = document.getElementById('heatmap-container');
  const tooltip = document.getElementById('heatmap-tooltip');
  container.innerHTML = '';

  // Show 3 months ending with current month
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonthIdx = today.getMonth();

  for (let offset = 2; offset >= 0; offset--) {
    const monthDate = new Date(currentYear, currentMonthIdx - offset, 1);
    const mYear = monthDate.getFullYear();
    const mIdx = monthDate.getMonth();
    const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });

    // Month Card Block
    const monthBlock = document.createElement('div');
    monthBlock.className = 'month-block';

    const monthTitle = document.createElement('div');
    monthTitle.className = 'month-title';
    monthTitle.innerText = monthName;
    monthBlock.appendChild(monthTitle);

    const daysGrid = document.createElement('div');
    daysGrid.className = 'days-grid';

    const daysInMonth = new Date(mYear, mIdx + 1, 0).getDate();

    for (let day = 1; day <= daysInMonth; day++) {
      const yyyy = mYear;
      const mm = String(mIdx + 1).padStart(2, '0');
      const dd = String(day).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;

      const totalSecs = activityMap[dateStr] || 0;
      const mins = Math.floor(totalSecs / 60);
      const level = getHeatmapLevel(mins);

      const square = document.createElement('div');
      square.className = `square ${level}`;

      // LeetCode-style Floating Tooltip Events
      square.addEventListener('mouseenter', (e) => {
        const d = new Date(dateStr + 'T00:00:00');
        const dateFormatted = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        
        let timeStr = 'No study logged';
        if (totalSecs > 0) {
          const hrs = Math.floor(totalSecs / 3600);
          const m = Math.floor((totalSecs % 3600) / 60);
          const hrsText = hrs > 0 ? `${hrs}h ` : '';
          timeStr = `<strong>${hrsText}${m}m</strong> study time`;
        }

        tooltip.innerHTML = `${timeStr} on <strong>${dateFormatted}</strong>`;
        tooltip.classList.remove('hidden');
      });

      square.addEventListener('mousemove', (e) => {
        tooltip.style.left = `${e.pageX}px`;
        tooltip.style.top = `${e.pageY}px`;
      });

      square.addEventListener('mouseleave', () => {
        tooltip.classList.add('hidden');
      });

      daysGrid.appendChild(square);
    }

    monthBlock.appendChild(daysGrid);
    container.appendChild(monthBlock);
  }
}
// 7. Load History Table with Time Variance
async function loadHistory() {
  const res = await fetch('/api/history');
  const { history } = await res.json();

  const tbody = document.getElementById('history-tbody');
  tbody.innerHTML = '';

  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center">No session history recorded yet.</td></tr>';
    return;
  }

  history.forEach(item => {
    const row = document.createElement('tr');
    
    const activeMins = Math.floor(item.total_active_seconds / 60);
    const totalTargetMins = Math.floor(((item.target_duration_seconds || 0) + (item.extended_duration_seconds || 0)) / 60);
    
    // Variance calculation
    const deltaMins = activeMins - totalTargetMins;
    let deltaHtml = '';
    if (totalTargetMins === 0) {
      deltaHtml = '<span class="delta-tag">No Target</span>';
    } else if (deltaMins > 0) {
      deltaHtml = `<span class="delta-tag delta-extended">+${deltaMins}m Extended</span>`;
    } else if (deltaMins < 0) {
      deltaHtml = `<span class="delta-tag delta-saved">${Math.abs(deltaMins)}m Saved</span>`;
    } else {
      deltaHtml = `<span class="delta-tag" style="background:#334155;">Exact Target</span>`;
    }

    // Interruption logs
    let pauseHtml = '<span style="color: #64748b;">No breaks</span>';
    if (item.pauses && item.pauses.length > 0) {
      pauseHtml = '<ul class="pause-list">';
      item.pauses.forEach((p, idx) => {
        const pStart = new Date(p.pause_start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const pEnd = p.pause_end ? new Date(p.pause_end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Ongoing';
        pauseHtml += `<li>Break #${idx + 1}: ${pStart} - ${pEnd}</li>`;
      });
      pauseHtml += '</ul>';
    }

    const modeBadge = `<span class="badge" style="background: ${item.session_mode === 'practice_exam' ? '#8b5cf6' : '#3b82f6'}">${item.session_mode.toUpperCase().replace('_', ' ')}</span>`;

    row.innerHTML = `
      <td>${modeBadge}<br><strong>${escapeHtml(item.subject)}</strong></td>
      <td><strong>${escapeHtml(item.topic)}</strong><br><small style="color:#94a3b8">${escapeHtml(item.platform)}</small></td>
      <td><strong>${escapeHtml(item.target_goal || 'None')}</strong><br><small style="color:#94a3b8">${escapeHtml(item.study_type)}</small></td>
      <td><strong>${activeMins} mins</strong></td>
      <td>${deltaHtml}<br><small style="color:#94a3b8">Target: ${totalTargetMins}m</small></td>
      <td>${pauseHtml}</td>
    `;
    tbody.appendChild(row);
  });
}

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; });
}
