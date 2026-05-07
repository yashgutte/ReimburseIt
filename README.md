# ReimburseIt — Expense Reimbursement Platform

A modern multi-role expense reimbursement platform featuring configurable multi-level approval workflows, OCR receipt scanning (Gemini Vision), multi-currency support, and role-based dashboards.

## Tech Stack

- **Backend**: Node.js, Express, Mongoose (MongoDB Atlas)
- **Frontend**: React (Vite), Tailwind CSS, shadcn/ui
- **Database**: MongoDB Atlas
- **OCR**: Google Gemini Vision API
- **Auth**: JWT + bcrypt

## Features

- User Authentication & Authorization (JWT + bcrypt)
- Auto Company & Admin Creation on Signup
- Multi-Currency Expense Submission with Live FX Conversion
- OCR Receipt Scanning (Gemini Vision API — auto-fills expense fields)
- Configurable Multi-Level Approval Workflows
- Conditional Approval Rules (Sequential, Percentage, Specific, Hybrid)
- Admin Dashboard (Users, Rules, All Expenses)
- Manager Approval Queue with Approval Timeline
- Email Notifications on Approval / Rejection
- Responsive Design

## Prerequisites

- Node.js (v18 or higher)
- MongoDB Atlas account (or local MongoDB)
- npm
- Gemini API key (for OCR)
- Gmail app password (for email notifications)

## Quick Start

### 1. Clone & Install Dependencies

```bash
git clone https://github.com/your-username/reimburse-it.git
cd reimburse-it

# Install backend dependencies
cd server && npm install

# Install frontend dependencies
cd ../client && npm install
```

### 2. Set Up Environment

**server/.env:**
```env
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/reimburse_it?retryWrites=true&w=majority
JWT_SECRET=your_secret
PORT=8081
NODE_ENV=development

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS="your_app_password"
SMTP_FROM="ReimburseIt <you@gmail.com>"

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.5-flash
```

**client/.env:**
```env
VITE_BACKEND_URL=http://localhost:8081
```

### 3. Start the Application

```bash
# Terminal 1 — Start backend
cd server && npm run dev

# Terminal 2 — Start frontend
cd client && npm run dev
```

### 4. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:8081
- **Health Check**: http://localhost:8081/ping

> **First signup** automatically creates a Company (using your selected country's currency) and an Admin account.

---

## API Endpoints

### Authentication
- `POST /api/auth/signup` — Register + auto-create company and admin
- `POST /api/auth/login` — Login, returns JWT
- `POST /api/auth/forgot-password` — Send temp password via email

### User Management (Admin)
- `GET /api/admin/users` — List all users in company
- `POST /api/admin/users/send-password` — Create or reset user

### Approval Rules (Admin)
- `GET /api/admin/approval-rules` — All rules for company
- `POST /api/admin/approval-rules` — Create rule
- `PUT /api/admin/approval-rules/:id` — Update rule
- `DELETE /api/admin/approval-rules/:id` — Delete rule

### Expenses
- `GET /api/expenses/mine` — Own expenses
- `POST /api/expenses` — Submit new expense
- `POST /api/expenses/parse-receipt` — OCR receipt scan

### Manager
- `GET /api/manager/approvals` — Pending approval queue
- `POST /api/manager/approvals/:expenseId/approve` — Approve
- `POST /api/manager/approvals/:expenseId/reject` — Reject

---

## Roles & Permissions

| Role | Key Capabilities |
|------|-----------------|
| **Admin** | Auto-created on signup. Manages users, roles, approval rules. |
| **Manager** | Views pending approval queue. Approves or rejects with comments. |
| **Employee** | Submits expenses with optional OCR. Tracks own history. |

---

## License

This project is licensed under the ISC License.
