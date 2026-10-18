-- Mission GATE 2027 Study Tracker Schema v3
CREATE DATABASE IF NOT EXISTS study_tracker;
USE study_tracker;

-- Table to store study & practice exam sessions
CREATE TABLE IF NOT EXISTS study_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_mode ENUM('study', 'practice_exam') DEFAULT 'study',
    subject VARCHAR(255) NOT NULL,
    topic VARCHAR(255) NOT NULL,
    platform VARCHAR(255) NOT NULL,
    target_goal TEXT,
    study_type VARCHAR(100) NOT NULL, -- 'Fresh Study', 'Revision', 'Full Length Test', etc.
    start_time DATETIME NOT NULL,
    end_time DATETIME DEFAULT NULL,
    total_active_seconds INT DEFAULT 0,
    target_duration_seconds INT DEFAULT 0,
    extended_duration_seconds INT DEFAULT 0,
    status ENUM('active', 'paused', 'completed', 'terminated') DEFAULT 'active',
    last_heartbeat DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Table to track pause intervals / interruptions
CREATE TABLE IF NOT EXISTS pause_intervals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    pause_start DATETIME NOT NULL,
    pause_end DATETIME DEFAULT NULL,
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE CASCADE
);

ALTER TABLE study_sessions
ADD COLUMN notified_50 TINYINT DEFAULT 0,
ADD COLUMN notified_75 TINYINT DEFAULT 0,
ADD COLUMN notified_100 TINYINT DEFAULT 0;

-- 1. Expand session status ENUM
ALTER TABLE study_sessions 
MODIFY COLUMN status ENUM('active', 'paused', 'long_interruption', 'target_not_achieved', 'completed', 'terminated') DEFAULT 'active';

-- 2. Add pause type classification
ALTER TABLE pause_intervals 
ADD COLUMN pause_type ENUM('short', 'long_term') DEFAULT 'short';

Select * from study_sessions;
Select * from pause_intervals;

update study_sessions
set status='long_interruption'
where id=15;

-- Delete from study_sessions
-- where id=14;

-- SELECT 
--     table_name AS `Table`,
--     table_rows AS `Approximate Rows`,
--     ROUND(data_length / 1024 / 1024, 2) AS `Data Size (MB)`,
--     ROUND(index_length / 1024 / 1024, 2) AS `Index Size (MB)`,
--     ROUND((data_length + index_length) / 1024 / 1024, 2) AS `Total Storage (MB)`,
--     ROUND((data_length + index_length) / IFNULL(NULLIF(table_rows, 0), 1), 0) AS `Avg Bytes / Row`
-- FROM information_schema.tables
-- WHERE table_schema = 'study_tracker';

UPDATE study_sessions 
SET 
  total_active_seconds = 2220,
  end_time = DATE_ADD(start_time, INTERVAL 37 MINUTE),
  status = 'completed'
WHERE id = 16;

UPDATE pause_intervals 
SET pause_end = NOW() 
WHERE id = 336;

UPDATE study_sessions s
SET total_active_seconds = (
  TIMESTAMPDIFF(SECOND, s.start_time, IFNULL(s.end_time, NOW())) - (
    SELECT IFNULL(SUM(TIMESTAMPDIFF(SECOND, pause_start, IFNULL(pause_end, NOW()))), 0)
    FROM pause_intervals
    WHERE session_id = s.id
  )
)
WHERE s.id = 16;

-- View session total duration vs break duration
SELECT 
  s.id AS session_id,
  s.start_time,
  s.end_time,
  TIMESTAMPDIFF(SECOND, s.start_time, s.end_time) AS total_session_sec,
  p.id AS pause_id,
  p.pause_start,
  p.pause_end,
  TIMESTAMPDIFF(SECOND, p.pause_start, p.pause_end) AS break_sec
FROM study_sessions s
JOIN pause_intervals p ON s.id = p.session_id
WHERE s.id = 16;

UPDATE study_sessions s
SET total_active_seconds = GREATEST(0, (
  TIMESTAMPDIFF(SECOND, s.start_time, IFNULL(s.end_time, NOW())) - (
    SELECT IFNULL(SUM(TIMESTAMPDIFF(SECOND, pause_start, IFNULL(pause_end, NOW()))), 0)
    FROM pause_intervals
    WHERE session_id = s.id
  )
))
WHERE s.id = 16;