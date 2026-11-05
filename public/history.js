// =============================================================
// MISSION GATE 2027 - FULL HISTORY SCRIPT (history.js)
// =============================================================

document.addEventListener('DOMContentLoaded', loadFullHistory);

async function loadFullHistory() {
  try {
    // Fetch all historical records from backend scope=all
    const res = await fetch('/api/history?scope=all');
    const { history } = await res.json();

    const tbody = document.getElementById('full-history-tbody');
    tbody.innerHTML = '';

    if (!history || history.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center">No session history found.</td></tr>';
      return;
    }

    history.forEach(item => {
      const row = document.createElement('tr');

      // Date parsing & IST localization
      const startDateObj = new Date(
        typeof item.start_time === 'string' && !item.start_time.endsWith('Z')
          ? item.start_time.replace(' ', 'T') + 'Z'
          : item.start_time
      );

      const formattedDate = startDateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
      const formattedTime = startDateObj.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
      });

      const activeMins = Math.floor(item.total_active_seconds / 60);
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

// Filter short-term breaks for log display with UTC-to-IST conversion
      let pauseHtml = '<span style="color: #64748b;">No breaks</span>';
      if (item.pauses && item.pauses.length > 0) {
        const shortPauses = item.pauses.filter(p => p.pause_type !== 'long_term');
        if (shortPauses.length > 0) {
          pauseHtml = '<ul class="pause-list">';
          shortPauses.forEach((p, idx) => {
            // Safely parse start time string into UTC Date object
            const pStartObj = new Date(
              typeof p.pause_start === 'string' && !p.pause_start.endsWith('Z')
                ? p.pause_start.replace(' ', 'T') + 'Z'
                : p.pause_start
            );
            const pStart = pStartObj.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            });

            // Safely parse end time string into UTC Date object
            let pEnd = 'Ongoing';
            if (p.pause_end) {
              const pEndObj = new Date(
                typeof p.pause_end === 'string' && !p.pause_end.endsWith('Z')
                  ? p.pause_end.replace(' ', 'T') + 'Z'
                  : p.pause_end
              );
              pEnd = pEndObj.toLocaleTimeString([], { 
                hour: '2-digit', 
                minute: '2-digit' 
              });
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
  } catch (err) {
    console.error('Error loading full history:', err);
    const tbody = document.getElementById('full-history-tbody');
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="color:#ef4444;">Failed to load history archive: ${escapeHtml(err.message)}</td></tr>`;
    }
  }
}

function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, function(m) { 
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; 
  });
}