# 🎯 Mission GATE 2027 - Study & Practice Tracker (v3.0)

A specialized full-stack study time tracker and test series analytics application designed for GATE 2027 preparation, built with Node.js, Express, MySQL, HTML5, CSS3, and JavaScript.

---

## 🌟 What's New in Version 3.0

1. **Project Name:** Updated branding to **Mission GATE 2027**.
2. **Session Mode Split:** Switch between **📖 Study / Learning Session** and **📝 Practice Exam / Test Series**.
3. **Subdivided Input Fields:**
   - **Study Mode:** Subject Name, Chapter/Topic Name, Study Platform (YouTube, MadeEasy, NPTEL), Target/Goal, and Study Type (`Fresh Study` or `Revision`).
   - **Practice Exam Mode:** Exam/Subject Name, Test Name, Platform/Test Series Name, Target Score, and Category (`Full Length Test`, `Subject Test`, `Topic Test`).
4. **Auto-Fill & Pre-filling Memory:** Automatically pre-fills input fields with your previous session details on load, while allowing full editing prior to starting.
5. **Countdown Target Timer & Notifications:** Set target duration in minutes. The countdown timer ticks down *only* while the session is active. Triggers browser alerts and notifications upon expiration, offering options to extend (+15m, +30m, +60m, or custom).
6. **Time Variance Analysis in History:** Displays how much active time exceeded or finished early compared to the predicted target duration (`+Xm Extended` vs `-Ym Saved`).
7. **Daily Interruption Metrics (Top Banner):** Top banner highlights:
   - Today's Total Active Study Time
   - Today's Number of Breaks / Interruptions
   - Today's Cumulative Duration of Breaks / Interruptions

---

## ⚙️ Configuration & Execution

### 1. Database Setup
Run `schema.sql` in MySQL Workbench or Command Line to update/create tables.

### 2. `.env` Credentials
Configure `.env` with your local MySQL password:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=YOUR_ACTUAL_MYSQL_PASSWORD
DB_NAME=study_tracker
```

### 3. Run Application
```bash
npm install
npm start
```
Access at `http://localhost:3000`.

---

### Option B: Running in Background via PM2 (Without VS Code)

To keep the application running persistently in the background—even after closing VS Code or terminal windows:

1. Install **PM2** globally on your system:
   
   npm install -g pm2
2.Navigate to your project folder and start the application under PM2:Bash

pm2 start server.js --name "study-tracker"

3.Save the current PM2 process list so it automatically restarts upon system reboots:Bash
pm2 save

4.Useful PM2 Commands:
    Check Status: 
        pm2 status
    View Live Logs: 
        pm2 logs study-tracker
    Restart App: 
        pm2 restart study-tracker
    Stop App: 
        pm2 stop study-tracker
    Delete app:
         pm2 delete study-tracker
    
# 📡 API Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/session/current` | Retrieves the current active/interrupted session and pause log |
| `POST` | `/api/session/start` | Starts a new study session topic |
| `POST` | `/api/session/heartbeat` | Updates active study duration and heartbeat timestamp |
| `POST` | `/api/session/pause` | Logs an interruption / pause interval |
| `POST` | `/api/session/resume` | Resumes an interrupted study session |
| `POST` | `/api/session/end` | Completes and closes the study session |
| `GET` | `/api/analytics/summary` | Fetches daily, weekly, and monthly study time and break counts |
| `GET` | `/api/analytics/heatmap` | Aggregates past 365-day study data for the contribution grid |
| `GET` | `/api/history` | Fetches recent study session logs and granular pause timestamps |
