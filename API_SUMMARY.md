# 📋 API ENDPOINTS SUMMARY FOR FRONTEND

## Quick Reference Guide for GenelineX Government Verification System

### BASE URL
```
http://localhost:3000
```

---

## 🎯 6 MAIN API ROUTE GROUPS

### 1. 📊 DASHBOARD (`/api/dashboard`)
Main dashboard data and system overview
- `/overview` - Complete dashboard with all metrics
- `/system-health` - System status and performance
- `/recent-activities` - Latest activities feed
- `/statistics-summary` - Day-over-day comparison
- `/threat-analysis` - Detailed threat analysis
- `/verification-insights` - Verification patterns

### 2. 📈 ANALYTICS (`/api/analytics`)
Deep analytics and reports
- `/overview` - Today's KPIs
- `/verifications/status` - Status breakdown
- `/verifications/trends` - Time-based trends
- `/verifications/categories` - Category distribution
- `/verifications/confidence` - Confidence levels
- `/verifications/recent` - Recent verifications
- `/threats/types` - Threat type breakdown
- `/threats/trends` - Threat trends
- `/threats/financial-impact` - Financial losses
- `/threats/urgent` - Urgent threats list
- `/threats/status-breakdown` - Status distribution
- `/patterns` - Known threat patterns
- `/patterns/:id` - Pattern details
- `/daily-stats` - Daily statistics
- `/data-gaps` - Information gaps
- `/data-gaps/trending` - Trending gaps

### 3. 👥 CITIZEN ENGAGEMENT (`/api/citizen-engagement`)
User engagement and activity metrics
- `/overview` - Engagement summary
- `/daily-active-users` - Daily active users
- `/user-roles` - Role distribution
- `/top-users` - Most active users
- `/recent-activities` - Recent activities
- `/activity-breakdown` - Activity types
- `/user-feedback` - User feedback

### 4. 📊 CITIZEN STATS (`/api/citizen-stats`)
Citizen query statistics
- `/overview` - Query statistics
- `/top-queries` - Most common queries
- `/query-trends` - Query trends
- `/popular-topics` - Popular topics
- `/ministry-distribution` - Ministry distribution
- `/response-quality` - Quality metrics
- `/unanswered-queries` - Pending queries
- `/peak-hours` - Peak usage times
- `/user-retention` - Retention metrics

### 5. 📰 FEEDS (`/api/feeds`)
Content feeds and lists
- `/verifications` - Verification feed
- `/threats` - Threat reports feed
- `/official-information` - Official info
- `/public-awareness` - Awareness campaigns
- `/information-requests` - Info requests
- `/user-feedback` - User feedback
- `/combined` - Combined feed

### 6. ❤️ HEALTH (`/health`, `/healthz`)
System health checks
- `/health` - Detailed health status
- `/healthz` - Simple health check

---

## 🎨 RECOMMENDED PAGES

| Page | Primary Endpoint | Purpose |
|------|-----------------|---------|
| **Dashboard** | `/api/dashboard/overview` | Main overview with KPIs |
| **Verifications** | `/api/feeds/verifications` | List all verifications |
| **Threats** | `/api/feeds/threats` | List all threat reports |
| **Analytics** | `/api/analytics/*` | Charts and insights |
| **Citizens** | `/api/citizen-engagement/overview` | User metrics |
| **Information** | `/api/feeds/official-information` | Official content |
| **Data Gaps** | `/api/analytics/data-gaps` | Unanswered queries |
| **Patterns** | `/api/analytics/patterns` | Threat patterns |

---

## 🔑 COMMON QUERY PARAMETERS

- `limit` - Number of results (default: 10-20)
- `offset` - Pagination offset (default: 0)
- `days` - Number of days for trends (default: 7-30)
- `status` - Filter by status
- `category` - Filter by category
- `threatType` - Filter by threat type

---

## 📊 KEY DATA TYPES

### Verification Status
- `VERIFIED` ✅
- `FALSE` ❌
- `PARTIALLY_TRUE` ⚠️
- `UNVERIFIED` ❓
- `PENDING` ⏳

### Threat Types
- `ROMANCE_SCAM`
- `INVESTMENT_FRAUD`
- `IMPERSONATION`
- `PHISHING`
- `MOBILE_MONEY_FRAUD`
- `JOB_SCAM`
- `LOTTERY_PRIZE_SCAM`
- `BLACKMAIL_SEXTORTION`
- `IDENTITY_THEFT`
- `FAKE_CHARITY`
- `SOCIAL_MEDIA_HACK`
- `OTHER`

### Threat Status
- `PENDING` ⏳
- `URGENT` 🚨
- `UNDER_INVESTIGATION` 🔍
- `RESOLVED` ✅
- `CLOSED` 📁

### Information Categories
- `GOVERNMENT_POLICY`
- `HEALTH`
- `SECURITY`
- `FINANCIAL`
- `LEGAL`
- `ADMINISTRATIVE`
- `EDUCATION`
- `INFRASTRUCTURE`
- `SOCIAL_WELFARE`
- `EMPLOYMENT`
- `OTHER`

### Confidence Levels
- `HIGH` 🟢
- `MEDIUM` 🟡
- `LOW` 🔴
- `UNKNOWN` ⚪

---

## 🚀 QUICK START EXAMPLE

```typescript
// Fetch dashboard overview
const response = await fetch('http://localhost:3000/api/dashboard/overview');
const data = await response.json();

console.log('Total Verifications:', data.overview.total_verifications);
console.log('Urgent Threats:', data.overview.urgent_threats);
console.log('Response Rate:', data.overview.response_rate_percentage + '%');
```

---

## 📦 NEXTUI COMPONENTS NEEDED

### Most Used
- `Card` - Metric cards, containers
- `Table` - Data lists
- `Chip` - Status badges
- `Button` - Actions
- `Tabs` - Page sections
- `Select` - Filters
- `Progress` - Loading states
- `Badge` - Counts
- `Modal` - Details
- `Skeleton` - Loading

### For Charts
- Install: `recharts` or `chart.js`
- Components: Bar, Line, Pie, Area charts

---

## 💡 TIPS

1. **All endpoints return JSON**
2. **No authentication required** (currently)
3. **CORS enabled** for localhost:3000 and localhost:3001
4. **Pagination available** on most list endpoints
5. **Date fields** are ISO 8601 strings
6. **Phone numbers** are in E.164 format (+23276123456)
7. **Amounts** are in Sierra Leone Leones (Le)

---

## 🎨 COLOR SCHEME

Based on Sierra Leone flag 🇸🇱:
- **Primary Green**: `#00A651`
- **Secondary Blue**: `#0072C6`
- **White**: `#FFFFFF`
- **Warning**: `#F59E0B` (orange)
- **Danger**: `#EF4444` (red)
- **Success**: `#10B981` (green)

---

## 📁 FILE TO REFERENCE

For complete details, see: `FRONTEND_PROMPT.md`

This file contains:
✅ All endpoint definitions
✅ TypeScript response types
✅ Query parameters
✅ Page structure recommendations
✅ Component suggestions
✅ Setup instructions
✅ Best practices

---

**Ready to build? Start with the Dashboard page using `/api/dashboard/overview`!** 🚀
