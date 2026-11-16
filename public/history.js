// =============================================================
// MISSION GATE 2027 - WEEKLY & MONTHLY HISTORY ARCHIVE (history.js)
// =============================================================

document.addEventListener('DOMContentLoaded', loadFullHistory);

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PREVIEW_ROW_LIMIT = 2; // Number of sessions shown when week is collapsed

// Exact 59-level daily color scale matching dashboard heatmap (style.css)
function getHeatmapLevel(minutes) {
  if (minutes <= 0) return 'lvl-0';
  if (minutes <= 360) return `lvl-${Math.ceil(minutes / 10)}`;
  if (minutes <= 600) return `lvl-${36 + Math.ceil((minutes - 360) / 15)}`;
  if (minutes <= 960) return `lvl-${52 + Math.ceil((minutes - 600) / 60)}`;
  return 'lvl-59';
}

// 45-Level Weekly Study Time Color Tier & Icon
function getWeeklyLevelInfo(totalSeconds) {
  if (totalSeconds <= 0) {
    return { level: 0, className: 'week-lvl-0', icon: '💤', tier: 'Rest Week' };
  }

  const hours = totalSeconds / 3600;
  let level = 1;

  if (hours <= 20) {
    // 1h to 20h -> Levels 1 to 20 (1 level per hour)
    level = Math.max(1, Math.ceil(hours));
  } else if (hours <= 50) {
    // 20h to 50h -> Levels 21 to 35 (1 level per 2 hours)
    level = 20 + Math.ceil((hours - 20) / 2);
  } else {
    // 50h to 100h+ -> Levels 36 to 45 (1 level per 5 hours, capped at 45)
    level = Math.min(45, 35 + Math.ceil((hours - 50) / 5));
  }

  let icon = '🌱';
  let tier = 'Starter';
  if (level >= 43)      { icon = '💎'; tier = 'Diamond Elite'; }
  else if (level >= 37) { icon = '👑'; tier = 'Champion'; }
  else if (level >= 28) { icon = '🔥'; tier = 'Blazing'; }
  else if (level >= 19) { icon = '⚡'; tier = 'High Focus'; }
  else if (level >= 10) { icon = '📘'; tier = 'Momentum'; }

  return {
    level,
    className: `week-lvl-${level}`,
    icon,
    tier
  };
}

function formatHoursMins(totalSeconds) {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  return `${hrs}h ${mins}m`;
}

function toLocalDateKey(dateObj) {
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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
    const dailyTotals = {};
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

    // 2. Render each Month section and its collapsible Week cards
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
        const weekInfo = getWeeklyLevelInfo(weekGroup.totalSeconds);
        const totalCount = weekGroup.sessions.length;
        const hiddenCount = Math.max(0, totalCount - PREVIEW_ROW_LIMIT);

        const weekCard = document.createElement('div');
        weekCard.className = 'card week-card';

        // Week Header + 45-Level Time Pill + 7-Day Row Heatmap + Dropdown Arrow Button
        const weekHeader = document.createElement('div');
        weekHeader.className = 'week-header';

        const weekMeta = document.createElement('div');
        weekMeta.className = 'week-meta';
        weekMeta.innerHTML = `
          <h3 class="week-range-title">📅 Week of ${startStr} – ${endStr}</h3>
          <div class="week-stats-row">
            <span class="week-time-pill ${weekInfo.className}">
              ${weekInfo.icon} ${formatHoursMins(weekGroup.totalSeconds)} • Lvl ${weekInfo.level} (${weekInfo.tier})
            </span>
          </div>
        `;

        const rightControls = document.createElement('div');
        rightControls.className = 'week-header-right';

        // 7-Tile Single-Row Heatmap using exact .square.lvl-X classes from style.css
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
          tileBtn.className = `square day-tile-btn ${lvlClass}`;
          tileBtn.innerText = dayObj.getDate();

          // Hover tooltip
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

          // Click date tile: auto-expand week if collapsed, scroll to date, and highlight rows
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

            // Expand the week card automatically if the target session was hidden
            if (!weekCard.classList.contains('expanded') && hiddenCount > 0) {
              setWeekExpandedState(true);
            }

            matchingRows[0].scrollIntoView({ behavior: 'smooth', block: 'center' });

            matchingRows.forEach(row => {
              row.classList.remove('date-highlight-row');
              void row.offsetWidth;
              row.classList.add('date-highlight-row');
            });
          });

          tileWrapper.appendChild(dayLabel);
          tileWrapper.appendChild(tileBtn);
          rowHeatmap.appendChild(tileWrapper);
        }

        rightControls.appendChild(rowHeatmap);

        // Dropdown Arrow Button to expand/collapse all sessions of the week
        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'week-toggle-btn';
        toggleBtn.setAttribute('aria-expanded', 'false');

        const toggleText = document.createElement('span');
        toggleText.innerText = hiddenCount > 0 ? `Show All (${totalCount})` : `All (${totalCount})`;

        const toggleArrow = document.createElement('span');
        toggleArrow.className = 'week-toggle-arrow';
        toggleArrow.innerText = '▼';

        toggleBtn.appendChild(toggleText);
        toggleBtn.appendChild(toggleArrow);

        if (hiddenCount === 0) {
          toggleBtn.style.opacity = '0.65';
          toggleBtn.style.cursor = 'default';
        }

        rightControls.appendChild(toggleBtn);
        weekHeader.appendChild(weekMeta);
        weekHeader.appendChild(rightControls);
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

        weekGroup.sessions.forEach((item, idx) => {
          const row = document.createElement('tr');
          row.setAttribute('data-date', item._dateKey);
          if (idx >= PREVIEW_ROW_LIMIT) {
            row.classList.add('extra-session-row');
          }

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
              shortPauses.forEach((p, pIdx) => {
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

                pauseHtml += `<li>Break #${pIdx + 1}: ${pStart} - ${pEnd}</li>`;
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

        // Optional bottom expand/collapse bar when there are > 2 sessions
        let bottomLink = null;
        if (hiddenCount > 0) {
          const footer = document.createElement('div');
          footer.className = 'week-preview-footer';
          bottomLink = document.createElement('button');
          bottomLink.type = 'button';
          bottomLink.className = 'week-expand-link';
          bottomLink.innerText = `▼ Show ${hiddenCount} more session${hiddenCount > 1 ? 's' : ''} from this week`;
          footer.appendChild(bottomLink);
          weekCard.appendChild(footer);
        }

        function setWeekExpandedState(expand) {
          if (hiddenCount === 0) return;
          weekCard.classList.toggle('expanded', expand);
          toggleBtn.setAttribute('aria-expanded', String(expand));
          toggleText.innerText = expand ? 'Hide Extra' : `Show All (${totalCount})`;
          if (bottomLink) {
            bottomLink.innerText = expand
              ? '▲ Collapse week sessions'
              : `▼ Show ${hiddenCount} more session${hiddenCount > 1 ? 's' : ''} from this week`;
          }
        }

        if (hiddenCount > 0) {
          toggleBtn.addEventListener('click', () => {
            setWeekExpandedState(!weekCard.classList.contains('expanded'));
          });
          if (bottomLink) {
            bottomLink.addEventListener('click', () => {
              setWeekExpandedState(!weekCard.classList.contains('expanded'));
            });
          }
        }

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