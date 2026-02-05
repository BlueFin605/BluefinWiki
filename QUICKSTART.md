# BlueFinWiki - Quick Start Guide

## 🚀 Get Started in 3 Steps

### 1️⃣ First Time Setup (One Time Only)

```powershell
.\setup-aspire.ps1
```

This installs .NET Aspire workload and all dependencies.

### 2️⃣ Start Development Environment

```powershell
dotnet run --project aspire/BlueFinWiki.AppHost
```

### 3️⃣ Open Your Browser

The terminal will show URLs. Typically:

- **Frontend**: http://localhost:5173
- **Aspire Dashboard**: http://localhost:15888

---

## 📋 Prerequisites

- ✅ .NET 8.0 SDK
- ✅ Node.js 18+
- ✅ Docker Desktop (must be running)

---

## 🌐 Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:5173 | React/Vite app |
| **Backend API** | http://localhost:3000 | Node.js API |
| **Aspire Dashboard** | http://localhost:15888 | Monitoring & logs |
| **LocalStack** | http://localhost:4566 | AWS emulation |
| **MailHog UI** | http://localhost:8025 | View sent emails |

---

## 🛠️ Common Commands

### Start Everything
```powershell
dotnet run --project aspire/BlueFinWiki.AppHost
```

### Stop Everything
Press `Ctrl+C` in the terminal

### Restart After Changes
Stop with `Ctrl+C`, then run again

### Install Dependencies
```powershell
# Frontend
cd frontend
npm install

# Backend
cd backend
npm install
```

---

## 📊 Aspire Dashboard Features

**Resources Tab**: Service status (Running/Stopped/Failed)

**Console Logs Tab**: Real-time logs from all services

**Traces Tab**: Distributed tracing (see request flow)

**Metrics Tab**: Performance metrics and charts

---

## 📧 Email Testing

All emails are captured by MailHog (not sent to real addresses):

1. Backend sends email (e.g., password reset)
2. Open http://localhost:8025
3. View the email in MailHog UI

---

## ☁️ AWS Services (Local)

LocalStack emulates AWS services locally:

- **S3**: Page storage, attachments, exports
- **DynamoDB**: Users, metadata, activity logs
- **SES**: Email sending (captured by MailHog)

No AWS account needed for local development!

---

## 🔧 Troubleshooting

### "Aspire workload not installed"
```powershell
dotnet workload install aspire
```

### "Docker daemon is not running"
Start Docker Desktop before running Aspire

### Port Already in Use
Stop the other service or change ports in `aspire/BlueFinWiki.AppHost/Program.cs`

### Backend Won't Start
1. Check LocalStack is running in Aspire Dashboard
2. Verify Docker is running
3. Check backend logs in Aspire Dashboard

---

## 📖 Documentation

- **Detailed Setup**: [ASPIRE-SETUP.md](ASPIRE-SETUP.md)
- **Local Dev Guide**: [aspire/ASPIRE-LOCAL-DEV.md](aspire/ASPIRE-LOCAL-DEV.md)
- **Implementation Details**: [TASK-1.2-IMPLEMENTATION.md](TASK-1.2-IMPLEMENTATION.md)
- **Task List**: [TASKS.md](TASKS.md)

---

## 💡 Tips

- **Frontend hot reloads**: Edit files in `frontend/src`, changes appear instantly
- **Backend restart**: Stop/start Aspire to reload backend changes
- **View logs**: Open Aspire Dashboard → Console Logs tab
- **Debug traces**: Aspire Dashboard → Traces tab shows request flow
- **Reset data**: Delete `aspire/BlueFinWiki.AppHost/localstack-data/`

---

## 🎯 What's Running?

When you start Aspire, these services start automatically:

1. **LocalStack** (container) - AWS services
2. **MailHog** (container) - Email capture
3. **Backend** (Node.js) - API server
4. **Frontend** (Vite) - Web app

All orchestrated and monitored by Aspire! 🎉

---

## 🚨 Need Help?

1. Check [ASPIRE-SETUP.md](ASPIRE-SETUP.md) for detailed troubleshooting
2. View service logs in Aspire Dashboard
3. Check that Docker Desktop is running
4. Verify ports aren't in use: `netstat -ano | findstr :3000`

---

**Ready to build BlueFinWiki!** 🐟📚
