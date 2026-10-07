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
