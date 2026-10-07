const express = require('express');
const cors = require('cors');
const path = require('path');
const { exec } = require('child_process');
const db = require('./db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------------------------------------
// NATIVE OS SOUND & DESKTOP NOTIFICATION TRIGGER (WINDOWS)
// -------------------------------------------------------------
function triggerSystemAlert(type, topicName, extraText) {
  let title = '🎯 Mission GATE 2027 Alert';
  let message = '';
  let psBeepCommand = '';

  if (type === 'half') {
    title = '⏱️ Half-Time Reached (50%)';
    message = `You are halfway through your target time for: ${topicName}`;
    psBeepCommand = '[console]::beep(700, 300); [console]::beep(700, 300)';
  } else if (type === 'quarter') {
    title = '⏳ Quarter Time Remaining (25% Left)';
    message = `Only 25% target time remaining for: ${topicName}`;
    psBeepCommand = '[console]::beep(1100, 200); Start-Sleep -m 100; [console]::beep(1100, 200)';
  } else if (type === 'end') {
    title = '🚨 Target Timer Finished!';
    message = `Target time completed for: ${topicName}. ${extraText || ''}`;
    psBeepCommand = '[console]::beep(800, 250); [console]::beep(1000, 250); [console]::beep(1300, 500)';
  }

  if (process.platform === 'win32') {
    // -WindowStyle Hidden prevents the CMD/PowerShell window flash
    const toastMessage = message.replace(/'/g, "''");
    const cmd = `powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -Command "${psBeepCommand}; [reflection.assembly]::loadwithpartialname('System.Windows.Forms'); $notify = new-object system.windows.forms.notifyicon; $notify.icon = [system.drawing.systemicons]::Information; $notify.visible = $true; $notify.showballoontip(5000, '${title}', '${toastMessage}', [system.windows.forms.tooltipicon]::Info)"`;
    exec(cmd);
  }
}

// -------------------------------------------------------------
// BACKGROUND WORKER: TIMER MILESTONES & STALE CLEANUP
// -------------------------------------------------------------
async function processActiveSessions() {
  try {
    // 1. Cleanup stale sessions if tab/app was abruptly closed without heartbeat (> 35s)
    const [staleSessions] = await db.query(
      `SELECT id, start_time, last_heartbeat FROM study_sessions WHERE status = 'active' AND last_heartbeat < NOW() - INTERVAL 35 SECOND`
    );

    for (const session of staleSessions) {
      const activeDelta = Math.max(0, Math.floor((new Date(session.last_heartbeat) - new Date(session.start_time)) / 1000));
      
      // Update session status to long_interruption instead of terminated
      await db.query(
        `UPDATE study_sessions SET status = 'long_interruption', end_time = last_heartbeat, total_active_seconds = ? WHERE id = ?`,
        [activeDelta, session.id]
      );
      
      // Log long-term pause interval
      await db.query(
        `INSERT INTO pause_intervals (session_id, pause_start, pause_end, pause_type) VALUES (?, NOW(), NOW(), 'long_term')`,
        [session.id]
      );
    }

    // 2. Check milestone notifications for running sessions
    const [activeSessions] = await db.query(
      `SELECT * FROM study_sessions WHERE status = 'active'`
    );

    for (const s of activeSessions) {
      const lastHb = new Date(s.last_heartbeat);
      const now = new Date();
      const liveSeconds = (s.total_active_seconds || 0) + Math.max(0, Math.floor((now - lastHb) / 1000));
      const totalTargetSecs = (s.target_duration_seconds || 0) + (s.extended_duration_seconds || 0);

      if (totalTargetSecs <= 0) continue;

      const progress = liveSeconds / totalTargetSecs;

      if (progress >= 0.5 && progress < 0.75 && !s.notified_50) {
        await db.query(`UPDATE study_sessions SET notified_50 = 1 WHERE id = ?`, [s.id]);
      }

      if (progress >= 0.75 && progress < 1.0 && !s.notified_75) {
        await db.query(`UPDATE study_sessions SET notified_75 = 1 WHERE id = ?`, [s.id]);
      }

      if (progress >= 1.0 && !s.notified_100) {
        await db.query(`UPDATE study_sessions SET notified_100 = 1 WHERE id = ?`, [s.id]);
      }
    }
  } catch (err) {
    console.error('Background worker error:', err.message);
  }
}
// Run checks every 2 seconds
setInterval(processActiveSessions, 2000);

// --- API ENDPOINTS ---

app.get('/api/session/current', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT * FROM study_sessions WHERE status IN ('active', 'paused') ORDER BY id DESC LIMIT 1`
    );
    if (rows.length === 0) return res.json({ session: null });

    const session = rows[0];
    const [pauses] = await db.query(`SELECT * FROM pause_intervals WHERE session_id = ? ORDER BY pause_start ASC`, [session.id]);
    res.json({ session, pauses });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/session/last-inputs', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT session_mode, subject, topic, platform, target_goal, study_type, target_duration_seconds FROM study_sessions ORDER BY id DESC LIMIT 1`);
    if (rows.length === 0) return res.json({ lastInput: null });
    res.json({ lastInput: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/start', async (req, res) => {
  const { session_mode, subject, topic, platform, target_goal, study_type, target_minutes } = req.body;
  if (!subject || !topic) return res.status(400).json({ error: 'Subject and Topic required' });

  const targetSecs = (parseInt(target_minutes) || 0) * 60;

  try {
    await db.query(`UPDATE study_sessions SET status = 'completed', end_time = NOW() WHERE status IN ('active', 'paused')`);

    const [result] = await db.query(
      `INSERT INTO study_sessions 
       (session_mode, subject, topic, platform, target_goal, study_type, target_duration_seconds, start_time, last_heartbeat, status, notified_50, notified_75, notified_100) 
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), 'active', 0, 0, 0)`,
      [session_mode || 'study', subject.trim(), topic.trim(), platform.trim(), target_goal.trim(), study_type.trim(), targetSecs]
    );

    const [newSession] = await db.query(`SELECT * FROM study_sessions WHERE id = ?`, [result.insertId]);
    res.json({ session: newSession[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/heartbeat', async (req, res) => {
  const { sessionId, activeSeconds } = req.body;
  try {
    await db.query(
      `UPDATE study_sessions SET last_heartbeat = NOW(), total_active_seconds = ? WHERE id = ? AND status = 'active'`,
      [activeSeconds, sessionId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/extend-target', async (req, res) => {
  const { sessionId, additionalMinutes } = req.body;
  const additionalSecs = (parseInt(additionalMinutes) || 15) * 60;
  try {
    // Reset 100% notification flag so future extensions can trigger alerts again when extended target ends
    await db.query(
      `UPDATE study_sessions SET extended_duration_seconds = extended_duration_seconds + ?, notified_100 = 0 WHERE id = ?`,
      [additionalSecs, sessionId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/pause', async (req, res) => {
  const { sessionId, activeSeconds } = req.body;
  try {
    await db.query(`UPDATE study_sessions SET status = 'paused', total_active_seconds = ? WHERE id = ?`, [activeSeconds, sessionId]);
    await db.query(`INSERT INTO pause_intervals (session_id, pause_start) VALUES (?, NOW())`, [sessionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/resume', async (req, res) => {
  const { sessionId } = req.body;
  try {
    await db.query(`UPDATE study_sessions SET status = 'active', last_heartbeat = NOW() WHERE id = ?`, [sessionId]);
    await db.query(`UPDATE pause_intervals SET pause_end = NOW() WHERE session_id = ? AND pause_end IS NULL`, [sessionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/session/end', async (req, res) => {
  const { sessionId, activeSeconds } = req.body;
  try {
    await db.query(`UPDATE pause_intervals SET pause_end = NOW() WHERE session_id = ? AND pause_end IS NULL`, [sessionId]);
    await db.query(`UPDATE study_sessions SET status = 'completed', end_time = NOW(), total_active_seconds = ? WHERE id = ?`, [activeSeconds, sessionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/summary', async (req, res) => {
  try {
    const [dailyStudy] = await db.query(`SELECT SUM(total_active_seconds) as total FROM study_sessions WHERE DATE(start_time) = CURDATE()`);
    const [dailyInterruptionCount] = await db.query(`SELECT COUNT(*) as total FROM pause_intervals WHERE DATE(pause_start) = CURDATE()`);
    const [dailyInterruptionTime] = await db.query(`
      SELECT SUM(TIMESTAMPDIFF(SECOND, pause_start, IFNULL(pause_end, NOW()))) as total FROM pause_intervals WHERE DATE(pause_start) = CURDATE()
    `);
    const [weeklyStudy] = await db.query(`SELECT SUM(total_active_seconds) as total FROM study_sessions WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`);
    const [monthlyStudy] = await db.query(`SELECT SUM(total_active_seconds) as total FROM study_sessions WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`);

    res.json({
      daily_seconds: dailyStudy[0].total || 0,
      daily_interruption_count: dailyInterruptionCount[0].total || 0,
      daily_interruption_seconds: dailyInterruptionTime[0].total || 0,
      weekly_seconds: weeklyStudy[0].total || 0,
      monthly_seconds: monthlyStudy[0].total || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/analytics/heatmap', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT DATE(start_time) as date, SUM(total_active_seconds) as total_seconds
      FROM study_sessions WHERE start_time >= DATE_SUB(CURDATE(), INTERVAL 365 DAY)
      GROUP BY DATE(start_time) ORDER BY date ASC
    `);
    res.json({ data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/history', async (req, res) => {
  try {
    const [sessions] = await db.query(`SELECT s.* FROM study_sessions s ORDER BY s.start_time DESC LIMIT 100`);
    for (const session of sessions) {
      const [pauses] = await db.query(`SELECT pause_start, pause_end FROM pause_intervals WHERE session_id = ? ORDER BY pause_start ASC`, [session.id]);
      session.pauses = pauses;
    }
    res.json({ history: sessions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Mission GATE 2027 Tracker running at http://localhost:${PORT}`);
});