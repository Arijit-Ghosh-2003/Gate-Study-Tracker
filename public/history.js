// =============================================================
// MISSION GATE 2027 - WEEKLY & MONTHLY HISTORY ARCHIVE (history.js)
// =============================================================

document.addEventListener('DOMContentLoaded', loadFullHistory);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Same 59-level color scale as dashboard heatmap (style.css)
function getHeatmapLevel(minutes) {
  if (minutes <= 0) return 'lvl-0';
  if (minutes <= 360) return `lvl-${Math.ceil(minutes / 10)}`;
  if (minutes <= 600) return `lvl-${36 + Math.ceil((minutes - 360) / 15)}`;
  if (minutes <= 960) return `lvl-${52 + Math.ceil((minutes - 600) / 60)}`;
  return 'lvl-59';
}

// Weekly Study Volume Icon & Tier Badge
function getWeeklyStudyBadge(totalSeconds) {
  const hrs = totalSeconds / 3600;
  if (hrs >= 50) return { icon: '👑', label: 'Legendary Week (50h+)', bg: 'rgba(250, 204, 21, 0.2)', color: '#fde047' };
  if (hrs >= 35) return { icon: '🔥', label: 'Power Week (35h+)', bg: 'rgba(249, 115, 22, 0.2)', color: '#fb923c' };
  if (hrs >= 20) return { icon: '⚡', label: 'Strong Momentum (20h+)', bg: 'rgba(56, 189, 248, 0.2)', color: '#38bdf8' };
  if (hrs >= 10) return { icon: '📘', label: 'Steady Progress (10h+)', bg: 'rgba(34, 197, 94, 0.2)', color: '#4ade80' };
  if (hrs > 0)   return { icon: '🌱', label: 'Starter Week (<10h)', bg: 'rgba(148, 163, 184, 0.2)', color: '#cbd5e1' };
  return { icon: '💤', label: 'Rest Week (0h)', bg: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8' };
}

function formatHoursMins(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

// Convert Date object to local YYYY-MM-DD key
function toLocalDateKey(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Sunday 00:00:00 of the week containing `dateObj`
function getWeekSunday(dateObj) {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

async function loadFullHistory() {
  const container = document.getElementById('weekly-history-container');
  const tooltip = document.getElementById('history-heatmap-tooltip');

  try {
    const res = await fetch('/api/history?scope=all');
    const { history } = await res.json();

    if (!history || history.length === 0) {
      container.innerHTML = '<section class="card"><p class="text-center">No session history found.</p></section>';
      return;
    }

    // 1. Parse timestamps, compute daily totals, and group by Month -> Week
    const dailyTotals = {}; // { 'YYYY-MM-DD': totalActiveSeconds }
    const monthsMap = new Map();

    history.forEach(item => {
      const startDateObj = new Date(
        typeof item.start_time === 'string' && !item.start_time.endsWith('Z')
          ? item.start_time.replace(' ', 'T') + 'Z'
          : item.start_time
      );
      item._startDateObj = startDateObj;

      const dateKey = toLocalDateKey(startDateObj);
      item._dateKey = dateKey;

      const activeSecs = item.total_active_seconds || 0;
      dailyTotals[dateKey] = (dailyTotals[dateKey] || 0) + activeSecs;

      // Month bucket (e.g., "2026-11")
      const monthKey = `${startDateObj.getFullYear()}-${String(startDateObj.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = startDateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      if (!monthsMap.has(monthKey)) {
        monthsMap.set(monthKey, {
          monthKey,
          monthLabel,
          totalSeconds: 0,
          weeksMap: new Map()
        });
      }
      const monthGroup = monthsMap.get(monthKey);
      monthGroup.totalSeconds += activeSecs;

      // Week bucket anchored by Sunday of that week
      const sundayObj = getWeekSunday(startDateObj);
      const weekKey = toLocalDateKey(sundayObj);

      if (!monthGroup.weeksMap.has(weekKey)) {
        monthGroup.weeksMap.set(weekKey, {
          weekKey,
          sundayObj,
          totalSeconds: 0,
          sessions: []
        });
      }
      const weekGroup = monthGroup.weeksMap.get(weekKey);
      weekGroup.totalSeconds += activeSecs;
      weekGroup.sessions.push(item);
    });

    container.innerHTML = '';

    // 2. Render each Month section and its Week cards (newest first)
    monthsMap.forEach(monthGroup => {
      const monthSection = document.createElement('section');
      monthSection.className = 'month-group';

      const monthBanner = document.createElement('div');
      monthBanner.className = 'month-banner';
      monthBanner.innerHTML = `
        <h2>🗓️ ${monthGroup.monthLabel}</h2>
        <span class="month-total-pill">Monthly Study Time: ${formatHoursMins(monthGroup.totalSeconds)}</span>
      `;
      monthSection.appendChild(monthBanner);

      monthGroup.weeksMap.forEach(weekGroup => {
        const satObj = new Date(weekGroup.sundayObj);
        satObj.setDate(satObj.getDate() + 6);

        const startStr = weekGroup.sundayObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endStr = satObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const badge = getWeeklyStudyBadge(weekGroup.totalSeconds);

        const weekCard = document.createElement('div');
        weekCard.className = 'card week-card';

        // Week Header + 7-Day Single-Row Heatmap Strip
        const weekHeader = document.createElement('div');
        weekHeader.className = 'week-header';

        const weekMeta = document.createElement('div');
        weekMeta.className = 'week-meta';
        weekMeta.innerHTML = `
          <h3 class="week-range-title">📅 Week of ${startStr} – ${endStr}</h3>
          <div class="week-stats-row">
            <span class="week-total-time">⏱️ ${formatHoursMins(weekGroup.totalSeconds)}</span>
            <span class="week-rank-badge" style="background: ${badge.bg}; color: ${badge.color};">
              ${badge.icon} ${badge.label}
            </span>
          </div>
        `;

        // Build the 7-tile single-row heatmap (Sun -> Sat)
        const rowHeatmap = document.createElement('div');
        rowHeatmap.className = 'week-row-heatmap';

        for (let dOffset = 0; dOffset < 7; dOffset++) {
          const dayObj = new Date(weekGroup.sundayObj);
          dayObj.setDate(dayObj.getDate() + dOffset);

          const dKey = toLocalDateKey(dayObj);
          const daySecs = dailyTotals[dKey] || 0;
          const dayMins = Math.floor(daySecs / 60);
          const lvlClass = getHeatmapLevel(dayMins);

          const tileWrapper = document.createElement('div');
          tileWrapper.className = 'day-tile-wrapper';

          const dayLabel = document.createElement('span');
          dayLabel.className = 'day-tile-label';
          dayLabel.innerText = DAY_NAMES[dOffset];

          const tileBtn = document.createElement('button');
          tileBtn.type = 'button';
          tileBtn.className = `day-tile-btn ${lvlClass}`;
          tileBtn.innerText = dayObj.getDate();

          // Hover tooltip showing exact date & study time
          tileBtn.addEventListener('mouseenter', () => {
            const fullDateStr = dayObj.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            });
            const timeLabel = daySecs > 0
              ? `<strong>${formatHoursMins(daySecs)}</strong> studied`
              : 'No study logged';
            tooltip.innerHTML = `${timeLabel} on <strong>${fullDateStr}</strong>`;

            const rect = tileBtn.getBoundingClientRect();
            tooltip.style.left = `${rect.left + rect.width / 2}px`;
            tooltip.style.top = `${rect.top - 8}px`;
            tooltip.classList.remove('hidden');
          });

          tileBtn.addEventListener('mouseleave', () => {
            tooltip.classList.add('hidden');
          });

          // Click handler: scroll smoothly to that date's rows and highlight them
          tileBtn.addEventListener('click', () => {
            document.querySelectorAll('.day-tile-btn.active-selected-day')
              .forEach(el => el.classList.remove('active-selected-day'));
            tileBtn.classList.add('active-selected-day');

            const matchingRows = weekCard.querySelectorAll(`tr[data-date="${dKey}"]`);
            if (matchingRows.length === 0) {
              tooltip.innerHTML = `No sessions recorded on <strong>${dayObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</strong>`;
              const rect = tileBtn.getBoundingClientRect();
              tooltip.style.left = `${rect.left + rect.width / 2}px`;
              tooltip.style.top = `${rect.top - 8}px`;
              tooltip.classList.remove('hidden');
              return;
            }

            // Smoothly scroll cursor/viewport to the first session of that date
            matchingRows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Re-trigger pulse highlight on all sessions for that clicked date
            matchingRows.forEach(row => {
              row.classList.remove('date-highlight-row');
              void row.offsetWidth; // Force reflow so animation restarts cleanly
              row.classList.add('date-highlight-row');
            });
          });

          tileWrapper.appendChild(dayLabel);
          tileWrapper.appendChild(tileBtn);
          rowHeatmap.appendChild(tileWrapper);
        }

        weekHeader.appendChild(weekMeta);
        weekHeader.appendChild(rowHeatmap);
        weekCard.appendChild(weekHeader);

        // Week Sessions Table
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-responsive';
        tableWrapper.innerHTML = `
          <table>
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Mode & Subject</th>
                <th>Topic / Chapter & Platform</th>
                <th>Type & Goal</th>
                <th>Active Duration</th>
                <th>Target vs Actual Variance</th>
                <th>Break / Interruption Logs</th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        `;

        const tbody = tableWrapper.querySelector('tbody');

        weekGroup.sessions.forEach(item => {
          const row = document.createElement('tr');
          row.setAttribute('data-date', item._dateKey);

          const formattedDate = item._startDateObj.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
          });
          const formattedTime = item._startDateObj.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          });

          const activeMins = Math.floor((item.total_active_seconds || 0) / 60);
          const totalTargetMins = Math.floor(((item.target_duration_seconds || 0) + (item.extended_duration_seconds || 0)) / 60);
          const deltaMins = activeMins - totalTargetMins;

          let deltaHtml = '';
          if (item.status === 'long_interruption') {
            deltaHtml = '<span class="delta-tag delta-longbreak">☕ Long Break</span>';
          } else if (item.status === 'target_not_achieved') {
            deltaHtml = '<span class="delta-tag delta-unachieved">❌ Target Unachieved</span>';
          } else if (totalTargetMins === 0) {
            deltaHtml = '<span class="delta-tag" style="background:#334155;">No Target</span>';
          } else if (deltaMins > 0) {
            deltaHtml = `<span class="delta-tag delta-extended">+${deltaMins}m Extended</span>`;
          } else if (deltaMins < 0) {
            deltaHtml = `<span class="delta-tag delta-saved">${Math.abs(deltaMins)}m Saved</span>`;
          } else {
            deltaHtml = `<span class="delta-tag" style="background:#334155;">Exact Target</span>`;
          }

          let pauseHtml = '<span style="color: #64748b;">No breaks</span>';
          if (item.pauses && item.pauses.length > 0) {
            const shortPauses = item.pauses.filter(p => p.pause_type !== 'long_term');
            if (shortPauses.length > 0) {
              pauseHtml = '<ul class="pause-list">';
              shortPauses.forEach((p, idx) => {
                const pStartObj = new Date(
                  typeof p.pause_start === 'string' && !p.pause_start.endsWith('Z')
                    ? p.pause_start.replace(' ', 'T') + 'Z'
                    : p.pause_start
                );
                const pStart = pStartObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                let pEnd = 'Ongoing';
                if (p.pause_end) {
                  const pEndObj = new Date(
                    typeof p.pause_end === 'string' && !p.pause_end.endsWith('Z')
                      ? p.pause_end.replace(' ', 'T') + 'Z'
                      : p.pause_end
                  );
                  pEnd = pEndObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                pauseHtml += `<li>Break #${idx + 1}: ${pStart} - ${pEnd}</li>`;
              });
              pauseHtml += '</ul>';
            }
          }

          const modeBadge = `<span class="badge" style="background: ${item.session_mode === 'practice_exam' ? '#8b5cf6' : '#3b82f6'}">${item.session_mode.toUpperCase().replace('_', ' ')}</span>`;

          row.innerHTML = `
            <td><strong>${formattedDate}</strong><br><small style="color:#94a3b8">${formattedTime}</small></td>
            <td>${modeBadge}<br><strong>${escapeHtml(item.subject)}</strong></td>
            <td><strong>${escapeHtml(item.topic)}</strong><br><small style="color:#94a3b8">${escapeHtml(item.platform)}</small></td>
            <td><strong>${escapeHtml(item.target_goal || 'None')}</strong><br><small style="color:#94a3b8">${escapeHtml(item.study_type)}</small></td>
            <td><strong>${activeMins} mins</strong></td>
            <td>${deltaHtml}<br><small style="color:#94a3b8">Target: ${totalTargetMins}m</small></td>
            <td>${pauseHtml}</td>
          `;
          tbody.appendChild(row);
        });

        weekCard.appendChild(tableWrapper);
        monthSection.appendChild(weekCard);
      });

      container.appendChild(monthSection);
    });
  } catch (err) {
    console.error('Error loading full history:', err);
    container.innerHTML = `<section class="card"><p class="text-center" style="color:#ef4444;">Failed to load history archive: ${escapeHtml(err.message)}</p></section>`;
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}