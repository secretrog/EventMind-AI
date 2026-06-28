# 🚀 EventMind AI

> **An AI-powered conversational event intelligence platform that helps organizers detect, prioritize, resolve, and learn from participant issues in real time.**

## 📖 Overview

Traditional feedback forms are completed after an event ends, making it impossible to resolve participant issues while the event is still running.

**EventMind AI** replaces static surveys with an AI-powered conversational assistant. Participants simply scan a QR code and chat naturally with an AI assistant. The platform understands their feedback, intelligently groups similar issues, alerts organizers in real time, follows up after issues are resolved, and continuously learns from previous events using **Hindsight** and **Cascadeflow**.

---

# ✨ Features

### 🤖 AI Conversational Assistant

* AI-guided participant assistance
* Natural conversations instead of lengthy forms
* Intelligent follow-up questions
* Context-aware responses

### 📱 QR Code Access

Participants can instantly access the AI assistant by scanning a QR code displayed at the venue.

### 🎯 Smart Issue Detection

Automatically identifies:

* Wi-Fi issues
* Food complaints
* Registration delays
* Mentor availability
* Venue concerns
* Power issues
* Suggestions
* Appreciation

### 🧠 Intelligent Issue Clustering

Instead of creating hundreds of duplicate reports, similar complaints are merged into a single actionable issue.

Example:

```
"Wi-Fi is slow"

"Internet keeps disconnecting"

"Can't connect to Wi-Fi"

↓

One Issue Ticket

Wi-Fi
Hall B
43 Participants Affected
Priority: Critical
```

---

# 📊 Real-Time Organizer Dashboard

The dashboard provides live insights including:

* Total Conversations
* Active Participants
* Critical Issues
* Open Tickets
* Resolved Issues
* AI Recommendations
* Sentiment Distribution
* Issue Trends
* Resolution Success Rate

---

# 🚨 Live Alerts

When multiple participants report the same issue within a short period, EventMind AI automatically generates a high-priority alert.

Example:

```
🚨 Critical Alert

Issue:
Wi-Fi

Location:
Hall B

Affected Participants:
43

Recommended Action:
Deploy an additional router.
```

---

# 🔄 Automatic Follow-Up

After organizers resolve an issue, EventMind AI automatically follows up with affected participants.

Example:

> Earlier you reported a Wi-Fi issue in Hall B.

> Organizers have marked it as resolved.

> Has your experience improved?

Participants can respond:

* ✅ Yes
* ⚠️ Partially
* ❌ No

If participants indicate the issue still exists, the system automatically reopens the issue and notifies organizers.

---

# 🧠 Hindsight

EventMind AI remembers previous events.

It stores:

* Previous issues
* Root causes
* Successful resolutions
* Resolution effectiveness
* Satisfaction scores

This allows the platform to recommend proven solutions for future events.

Example:

```
Last Event

Issue:
Wi-Fi Hall B

Solution:
Installed Additional Router

Success Rate:
94%

↓

Future Event

Recommendation:
Deploy additional router before event begins.
```

---

# 🌊 Cascadeflow

The platform uses a multi-agent architecture where each AI agent performs a specific responsibility.

```
Participant

↓

Conversation Agent

↓

Issue Extraction Agent

↓

Issue Classification Agent

↓

Duplicate Detection Agent

↓

Priority Agent

↓

Dashboard Update Agent

↓

Notification Agent

↓

Follow-Up Agent

↓

Hindsight Memory Agent

↓

Recommendation Agent
```

This modular design keeps the system scalable, maintainable, and easy to extend.

---

# 🛠️ Tech Stack

## Frontend

* React
* TypeScript
* Tailwind CSS

## Backend

* FastAPI

## Database

* Firebase Firestore

## Authentication

* Firebase Authentication

## AI

* Gemini API

## Charts

* Chart.js

## Real-Time Updates

* Firebase Snapshot Listeners

---

# 🏗️ Project Architecture

```
                    QR Code

                       │

                       ▼

             AI Conversation Assistant

                       │

                       ▼

             Issue Extraction Agent

                       │

                       ▼

           Duplicate Detection Agent

                       │

                       ▼

            Priority Classification

                       │

                       ▼

           Organizer Dashboard

                       │

                       ▼

             Organizer Resolution

                       │

                       ▼

          Automatic AI Follow-Up

                       │

                       ▼

              Hindsight Memory

                       │

                       ▼

        Recommendations for Future Events
```

---

# 🚀 Future Enhancements

* Voice conversations
* Speech-to-text support
* Multi-language conversations
* WhatsApp integration
* Telegram integration
* Predictive issue detection
* Volunteer task assignment
* Cross-event analytics
* PDF executive reports
* Mobile application

---

# 🎯 Problem Statement

Participants often experience issues during live events, but traditional feedback forms collect responses only after the event has ended.

As a result:

* Problems remain unresolved during the event.
* Organizers receive duplicate complaints.
* Valuable feedback is difficult to prioritize.
* There is no mechanism to verify whether issues were actually fixed.
* Lessons from previous events are often forgotten.

---

# 💡 Solution

EventMind AI enables participants to communicate naturally with an AI assistant throughout an event. The system converts conversations into structured issue tickets, groups duplicate reports, alerts organizers in real time, verifies whether issues are resolved through automated follow-ups, and continuously improves future events using Hindsight and Cascadeflow.

---

# 🌟 Why EventMind AI?

Unlike traditional survey tools, EventMind AI closes the entire feedback loop:

**Conversation → Issue Detection → Live Alerts → Resolution → Follow-Up → Learning**

This transforms event feedback into a continuous operational improvement process rather than a post-event report.

---

# 📄 License

This project is developed as a prototype to demonstrate AI-powered conversational event intelligence using multi-agent workflows with Hindsight and Cascadeflow.
