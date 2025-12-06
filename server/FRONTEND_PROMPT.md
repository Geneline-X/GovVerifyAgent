# 🚀 FRONTEND PROMPT FOR GENELINE X GOVERNMENT VERIFICATION SYSTEM

## PROJECT OVERVIEW
Build a Next.js frontend using **NextUI (HeroUI)** for the Sierra Leone Government Information Verification & Cyber Threat Reporting System. This system allows citizens to verify information and report cyber threats.

## TECH STACK
- **Framework**: Next.js 14+ (App Router)
- **UI Library**: NextUI v2 (HeroUI)
- **Styling**: Tailwind CSS (comes with NextUI)
- **State Management**: React Context API / Zustand
- **API Client**: Axios or Fetch API
- **Charts**: Recharts or Chart.js
- **Icons**: Lucide React or Heroicons

## API BASE URL
```
http://localhost:3000
```

## COLOR SCHEME (Sierra Leone Theme)
- Primary: Green (#00A651) - from Sierra Leone flag
- Secondary: Blue (#0072C6) - from Sierra Leone flag  
- Accent: White (#FFFFFF)
- Warning: Orange/Yellow for urgent threats
- Danger: Red for false information and critical threats
- Success: Green for verified information

---

## 📡 COMPLETE API ENDPOINTS

### 1. DASHBOARD ROUTES (`/api/dashboard`)

#### GET `/api/dashboard/overview`
**Complete dashboard overview with all metrics**
```typescript
Response: {
  overview: {
    total_verifications: number;
    pending_verifications: number;
    verifications_today: number;
    total_threats: number;
    urgent_threats: number;
    threats_today: number;
    total_users: number;
    active_users_7_days: number;
    total_amount_lost_le: number;
    response_rate_percentage: number;
    engagement_rate_percentage: number;
    avg_response_time_ms: number;
    today_stats: {
      verifications: number;
      threats: number;
      active_users: number;
      new_users: number;
    } | null;
  };
  breakdowns: {
    verification_status: Array<{ status: string; count: number }>;
    top_threat_types: Array<{ threat_type: string; count: number }>;
    top_verification_categories: Array<{ category: string; count: number }>;
  };
  trends: {
    last_7_days: Array<{
      date: Date;
      verifications: number;
      threats: number;
      active_users: number;
      new_users: number;
    }>;
  };
  user_metrics: {
    total_users: number;
    citizens: number;
    active_last_7_days: number;
    engagement_rate: number;
  };
  information_requests: {
    total: number;
    answered: number;
    answer_rate: number;
  };
}
```

#### GET `/api/dashboard/system-health`
**System health and operational metrics**
```typescript
Response: {
  status: "healthy" | "unhealthy";
  timestamp: Date;
  database: {
    connected: boolean;
    verifications: number;
    threats: number;
    users: number;
    activities: number;
  };
  performance: {
    avg_response_time_ms: number;
    min_response_time_ms: number;
    max_response_time_ms: number;
  };
  pending_items: {
    verifications: number;
    urgent_threats: number;
    total_requiring_attention: number;
  };
  last_updated: Date | null;
}
```

#### GET `/api/dashboard/recent-activities?limit=20`
**Recent activities across the system**
```typescript
Response: {
  verifications: Array<{
    type: "verification";
    id: number;
    description: string;
    status: string;
    category: string;
    timestamp: Date;
  }>;
  threats: Array<{
    type: "threat";
    id: number;
    reference: string;
    threat_type: string;
    status: string;
    is_urgent: boolean;
    amount_lost: number | null;
    timestamp: Date;
  }>;
  activity_logs: Array<{
    id: number;
    action: string;
    details: any;
    timestamp: Date;
    userPhone: string;
  }>;
}
```

#### GET `/api/dashboard/statistics-summary`
**Day-over-day statistics comparison**
```typescript
Response: {
  today: {
    verifications: number;
    threats: number;
    new_users: number;
  };
  yesterday: {
    verifications: number;
    threats: number;
    new_users: number;
  };
  changes: {
    verifications_change: number; // percentage
    threats_change: number;
    users_change: number;
  };
}
```

#### GET `/api/dashboard/threat-analysis`
**Detailed threat analysis and patterns**
```typescript
Response: {
  by_type: Array<{
    threat_type: string;
    count: number;
    total_amount_lost: number;
  }>;
  by_platform: Array<{
    platform: string;
    count: number;
  }>;
  by_status: Array<{
    status: string;
    count: number;
  }>;
  monthly_trend: Array<{
    month: string; // YYYY-MM
    count: number;
    total_lost: number;
  }>;
  highest_losses: Array<{
    id: number;
    referenceNumber: string;
    threatType: string;
    amountLost: number;
    platform: string;
    reportedAt: Date;
  }>;
}
```

#### GET `/api/dashboard/verification-insights`
**Detailed verification insights**
```typescript
Response: {
  by_category: Array<{ category: string; count: number }>;
  by_status: Array<{ status: string; count: number }>;
  by_confidence: Array<{ confidence: string; count: number }>;
  avg_response_time_by_category: Array<{
    category: string;
    avg_response_time_ms: number;
  }>;
  most_viewed: Array<{
    id: number;
    claim: string;
    category: string;
    status: string;
    views: number;
    shares: number;
    verified_at: Date;
  }>;
  monthly_trend: Array<{
    month: string;
    total: number;
    verified: number;
    false_info: number;
  }>;
}
```

---

### 2. ANALYTICS ROUTES (`/api/analytics`)

#### GET `/api/analytics/overview`
**Today's key metrics**
```typescript
Response: {
  total_verifications: number;
  total_threats: number;
  active_users: number;
  pending_verifications: number;
  total_amount_lost: number;
  avg_response_time_ms: number;
  date: Date;
}
```

#### GET `/api/analytics/verifications/status`
**Verification status breakdown**
```typescript
Response: {
  data: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}
```

#### GET `/api/analytics/verifications/trends?days=30`
**Verification trends over time**
```typescript
Response: {
  data: Array<{
    date: Date;
    total: number;
    verified: number;
    false: number;
    unverified: number;
    pending: number;
  }>;
  days: number;
}
```

#### GET `/api/analytics/verifications/categories`
**Verification breakdown by category**
```typescript
Response: {
  data: Array<{
    category: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}
```

#### GET `/api/analytics/verifications/confidence`
**Verification confidence levels**
```typescript
Response: {
  data: Array<{
    confidence: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}
```

#### GET `/api/analytics/verifications/recent?limit=20`
**Recent verification requests**
```typescript
Response: {
  data: Array<{
    id: number;
    claim: string;
    category: string;
    status: string;
    confidence: string | null;
    requestedAt: Date;
    verifiedAt: Date | null;
    requesterPhone: string;
  }>;
  total: number;
  limit: number;
}
```

#### GET `/api/analytics/threats/types`
**Threat types breakdown**
```typescript
Response: {
  data: Array<{
    threatType: string;
    count: number;
    percentage: number;
    totalAmountLost: number;
  }>;
  total: number;
}
```

#### GET `/api/analytics/threats/trends?days=30`
**Threat trends over time**
```typescript
Response: {
  data: Array<{
    date: Date;
    total: number;
    urgent: number;
    totalAmountLost: number;
  }>;
  days: number;
}
```

#### GET `/api/analytics/threats/financial-impact?days=30`
**Financial impact analysis**
```typescript
Response: {
  total_amount_lost: number;
  average_loss_per_threat: number;
  median_loss: number;
  highest_loss: number;
  by_threat_type: Array<{
    threatType: string;
    totalLoss: number;
    averageLoss: number;
    reportCount: number;
  }>;
  days: number;
}
```

#### GET `/api/analytics/threats/urgent`
**Urgent threats requiring attention**
```typescript
Response: {
  data: Array<{
    id: number;
    referenceNumber: string;
    threatType: string;
    description: string;
    platform: string;
    amountLost: number | null;
    status: string;
    reportedAt: Date;
    reporterPhone: string;
  }>;
  total: number;
}
```

#### GET `/api/analytics/threats/status-breakdown`
**Threat status distribution**
```typescript
Response: {
  data: Array<{
    status: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}
```

#### GET `/api/analytics/patterns`
**Known threat patterns**
```typescript
Response: {
  data: Array<{
    id: number;
    patternName: string;
    threatType: string;
    reportCount: number;
    totalAmountLost: number;
    isActive: boolean;
    publicWarningIssued: boolean;
    firstReported: Date;
    lastReported: Date;
  }>;
  total: number;
}
```

#### GET `/api/analytics/patterns/:id`
**Specific threat pattern details**
```typescript
Response: {
  id: number;
  patternName: string;
  threatType: string;
  description: string;
  knownContacts: string[];
  commonPhrases: string[];
  targetedPlatforms: string[];
  reportCount: number;
  totalAmountLost: number;
  isActive: boolean;
  publicWarningIssued: boolean;
  firstReported: Date;
  lastReported: Date;
}
```

#### GET `/api/analytics/daily-stats?days=30`
**Daily statistics over time**
```typescript
Response: {
  data: Array<{
    date: Date;
    totalVerifications: number;
    totalThreats: number;
    activeUsers: number;
    newUsers: number;
    totalAmountLostDaily: number;
    avgResponseTimeMs: number;
  }>;
  days: number;
}
```

#### GET `/api/analytics/data-gaps?limit=20`
**Information gaps citizens are requesting**
```typescript
Response: {
  data: Array<{
    id: number;
    topic: string;
    category: string | null;
    ministry: string | null;
    requestCount: number;
    priority: string;
    wasAnswered: boolean;
    firstRequested: Date;
    lastRequested: Date;
  }>;
  total: number;
  limit: number;
}
```

#### GET `/api/analytics/data-gaps/trending?limit=10`
**Trending data gaps**
```typescript
Response: {
  data: Array<{
    topic: string;
    requestCount: number;
    uniqueRequesters: number;
    category: string | null;
    ministry: string | null;
    priority: string;
  }>;
  limit: number;
}
```

---

### 3. CITIZEN ENGAGEMENT ROUTES (`/api/citizen-engagement`)

#### GET `/api/citizen-engagement/overview`
**Citizen engagement overview**
```typescript
Response: {
  total_users: number;
  active_users_7_days: number;
  new_users_today: number;
  total_activities: number;
  engagement_rate: number;
}
```

#### GET `/api/citizen-engagement/daily-active-users?days=30`
**Daily active users trend**
```typescript
Response: {
  data: Array<{
    date: Date;
    activeUsers: number;
    newUsers: number;
  }>;
  days: number;
}
```

#### GET `/api/citizen-engagement/user-roles`
**User role distribution**
```typescript
Response: {
  data: Array<{
    role: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}
```

#### GET `/api/citizen-engagement/top-users?limit=10`
**Most active users**
```typescript
Response: {
  data: Array<{
    phoneE164: string;
    verificationCount: number;
    threatReportCount: number;
    totalActivities: number;
    lastActiveAt: Date;
  }>;
  limit: number;
}
```

#### GET `/api/citizen-engagement/recent-activities?limit=20`
**Recent user activities**
```typescript
Response: {
  data: Array<{
    id: number;
    action: string;
    userPhone: string;
    timestamp: Date;
    details: any;
  }>;
  total: number;
  limit: number;
}
```

#### GET `/api/citizen-engagement/activity-breakdown`
**Activity type breakdown**
```typescript
Response: {
  data: Array<{
    action: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}
```

#### GET `/api/citizen-engagement/user-feedback`
**User feedback on verifications**
```typescript
Response: {
  data: Array<{
    id: number;
    verificationId: number;
    isCorrect: boolean | null;
    comment: string | null;
    submittedAt: Date;
  }>;
  total: number;
  positive_feedback: number;
  negative_feedback: number;
  accuracy_rate: number;
}
```

---

### 4. CITIZEN STATS ROUTES (`/api/citizen-stats`)

#### GET `/api/citizen-stats/overview`
**Overall citizen query statistics**
```typescript
Response: {
  total_queries: number;
  total_verifications: number;
  total_info_requests: number;
  total_answered: number;
  response_rate: number;
  avg_response_time_ms: number;
  unique_citizens: number;
}
```

#### GET `/api/citizen-stats/top-queries?limit=10`
**Most common query topics**
```typescript
Response: {
  verifications_by_category: Array<{
    category: string;
    count: number;
  }>;
  top_topics: Array<{
    topic: string;
    count: number;
  }>;
  limit: number;
}
```

#### GET `/api/citizen-stats/query-trends?days=30`
**Query trends over time**
```typescript
Response: {
  data: Array<{
    date: Date;
    verifications: number;
    infoRequests: number;
    total: number;
  }>;
  days: number;
}
```

#### GET `/api/citizen-stats/popular-topics?limit=10`
**Popular information request topics**
```typescript
Response: {
  data: Array<{
    topic: string;
    count: number;
    wasAnswered: boolean;
  }>;
  limit: number;
}
```

#### GET `/api/citizen-stats/ministry-distribution`
**Query distribution by ministry**
```typescript
Response: {
  data: Array<{
    ministry: string;
    count: number;
    percentage: number;
  }>;
  total: number;
}
```

#### GET `/api/citizen-stats/response-quality`
**Response quality metrics**
```typescript
Response: {
  total_with_confidence: number;
  high_confidence: number;
  medium_confidence: number;
  low_confidence: number;
  avg_response_time_ms: number;
  user_satisfaction: {
    total_feedback: number;
    positive: number;
    negative: number;
    satisfaction_rate: number;
  };
}
```

#### GET `/api/citizen-stats/unanswered-queries?limit=20`
**Queries needing attention**
```typescript
Response: {
  verifications: Array<{
    id: number;
    claim: string;
    category: string;
    requestedAt: Date;
    requesterPhone: string;
  }>;
  info_requests: Array<{
    id: number;
    topic: string;
    category: string | null;
    requestedAt: Date;
    requesterPhone: string;
  }>;
  total_unanswered: number;
  limit: number;
}
```

#### GET `/api/citizen-stats/peak-hours`
**Peak usage hours analysis**
```typescript
Response: {
  hourly_distribution: Array<{
    hour: number;
    count: number;
  }>;
  peak_hour: number;
  peak_count: number;
}
```

#### GET `/api/citizen-stats/user-retention`
**User retention metrics**
```typescript
Response: {
  new_users_last_30_days: number;
  returning_users: number;
  retention_rate: number;
  avg_queries_per_user: number;
}
```

---

### 5. DOCUMENT FEEDS ROUTES (`/api/feeds`)

#### GET `/api/feeds/verifications?limit=20&offset=0&status=VERIFIED&category=HEALTH`
**Recent verification feed**
```typescript
Response: {
  data: Array<{
    id: number;
    claim: string;
    status: string;
    category: string;
    confidence: string | null;
    result: string | null;
    verifiedAt: Date | null;
    requesterPhone: string;
    sources: any;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

#### GET `/api/feeds/threats?limit=20&offset=0&threatType=ROMANCE_SCAM&status=URGENT`
**Recent cyber threat reports feed**
```typescript
Response: {
  data: Array<{
    id: number;
    referenceNumber: string;
    threatType: string;
    description: string;
    platform: string;
    amountLost: number | null;
    status: string;
    isUrgent: boolean;
    reportedAt: Date;
    reporterPhone: string;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

#### GET `/api/feeds/official-information?limit=20&offset=0&category=HEALTH`
**Official government information**
```typescript
Response: {
  data: Array<{
    id: number;
    title: string;
    category: string;
    content: string;
    sourceMinistry: string;
    sourceUrl: string | null;
    publishedDate: Date;
    isPinned: boolean;
    viewCount: number;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

#### GET `/api/feeds/public-awareness?limit=20&offset=0`
**Public awareness campaigns**
```typescript
Response: {
  data: Array<{
    id: number;
    title: string;
    type: string;
    content: string;
    threatType: string | null;
    priority: string;
    publishedAt: Date;
    viewCount: number;
    shareCount: number;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

#### GET `/api/feeds/information-requests?limit=20&offset=0`
**Information requests from citizens**
```typescript
Response: {
  data: Array<{
    id: number;
    topic: string;
    category: string | null;
    ministry: string | null;
    wasAnswered: boolean;
    requestedAt: Date;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

#### GET `/api/feeds/user-feedback?limit=20&offset=0`
**User feedback on verifications**
```typescript
Response: {
  data: Array<{
    id: number;
    verificationId: number;
    isCorrect: boolean | null;
    comment: string | null;
    submittedAt: Date;
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

#### GET `/api/feeds/combined?limit=20&offset=0`
**Combined feed of all activities**
```typescript
Response: {
  data: Array<{
    type: "verification" | "threat" | "official_info" | "awareness";
    id: number;
    title: string;
    content: string;
    timestamp: Date;
    // ... other type-specific fields
  }>;
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}
```

---

### 6. HEALTH CHECK ROUTES

#### GET `/health`
**System health check**
```typescript
Response: {
  status: "healthy";
  service: "gov-verify-agent";
  activeConversations: number;
}
```

#### GET `/healthz`
**Simple health check**
```
Response: "ok" (200 status)
```

---

## 🎨 RECOMMENDED PAGE STRUCTURE

### 1. **Dashboard Page** (`/dashboard`)
- Overview metrics cards (6 key metrics)
- System health status
- Charts (verification status, threat types, trends)
- Recent activities feed
- Use: `/api/dashboard/overview`, `/api/dashboard/system-health`

### 2. **Verifications Page** (`/verifications`)
- List of all verifications (table with filters)
- Status filter (VERIFIED, FALSE, PENDING, etc.)
- Category filter
- Search by claim text
- Pagination
- Use: `/api/feeds/verifications`, `/api/analytics/verifications/status`

### 3. **Threats Page** (`/threats`)
- List of all threat reports
- Threat type filter
- Status filter
- Urgent threats highlight
- Financial impact summary
- Use: `/api/feeds/threats`, `/api/analytics/threats/types`

### 4. **Analytics Page** (`/analytics`)
- Multiple tabs: Verifications, Threats, Users, Trends
- Interactive charts and graphs
- Date range selectors
- Export functionality
- Use: All `/api/analytics/*` endpoints

### 5. **Citizens Page** (`/citizens`)
- User engagement metrics
- Active users list
- Retention analysis
- Feedback summary
- Use: `/api/citizen-engagement/*`, `/api/citizen-stats/*`

### 6. **Official Information Page** (`/information`)
- Government announcements
- Public awareness campaigns
- Filter by ministry/category
- Pin important information
- Use: `/api/feeds/official-information`, `/api/feeds/public-awareness`

### 7. **Data Gaps Page** (`/data-gaps`)
- Unanswered queries
- Trending topics
- Priority assignment
- Ministry assignment
- Use: `/api/analytics/data-gaps/*`, `/api/citizen-stats/unanswered-queries`

### 8. **Threat Patterns Page** (`/patterns`)
- Known scam patterns
- Pattern details
- Warning status
- Related reports
- Use: `/api/analytics/patterns`, `/api/analytics/patterns/:id`

---

## 🎯 KEY FEATURES TO IMPLEMENT

### 1. **Real-time Updates**
- Auto-refresh dashboard every 30 seconds
- Live activity feed
- Notification badges for urgent items

### 2. **Data Visualization**
- Bar charts for distributions
- Line charts for trends
- Pie charts for breakdowns
- Area charts for cumulative data

### 3. **Filtering & Search**
- Date range pickers
- Multi-select filters (status, category, type)
- Text search
- Sort by columns

### 4. **Responsive Design**
- Mobile-first approach
- Tablet optimization
- Desktop layouts
- Touch-friendly controls

### 5. **Status Indicators**
- Color-coded badges
- Progress indicators
- Health status icons
- Urgency levels

### 6. **Export & Share**
- Export to CSV/Excel
- Share reports
- Print-friendly views
- Copy data to clipboard

---

## 📦 NEXTUI COMPONENTS TO USE

### Cards & Layout
- `Card` - For metric cards, data containers
- `CardHeader`, `CardBody`, `CardFooter`
- `Divider` - Section separators

### Navigation
- `Navbar` - Top navigation
- `Tabs` - Page sections
- `Breadcrumbs` - Navigation trail
- `Link` - Internal navigation

### Data Display
- `Table` - Data grids
- `Chip` - Status badges
- `Avatar` - User icons
- `Badge` - Notification counts
- `Progress` - Loading/completion
- `Skeleton` - Loading states

### Forms & Input
- `Input` - Search fields
- `Select` - Dropdown filters
- `DatePicker` - Date ranges
- `Checkbox` - Multi-select
- `Radio` - Single select
- `Switch` - Toggle options

### Feedback
- `Modal` - Details view
- `Tooltip` - Hover info
- `Popover` - Action menus
- `Spinner` - Loading indicator
- `Alert` - Status messages

### Actions
- `Button` - All actions
- `Dropdown` - Action menus
- `Pagination` - Page navigation

---

## 🎨 COLOR MAPPING FOR STATUS

```typescript
// Verification Status
VERIFIED: "success" (green)
FALSE: "danger" (red)
PARTIALLY_TRUE: "warning" (yellow)
UNVERIFIED: "default" (gray)
PENDING: "primary" (blue)

// Threat Status
URGENT: "danger" (red)
PENDING: "warning" (yellow)
UNDER_INVESTIGATION: "primary" (blue)
RESOLVED: "success" (green)
CLOSED: "default" (gray)

// Confidence Level
HIGH: "success" (green)
MEDIUM: "warning" (yellow)
LOW: "danger" (red)
UNKNOWN: "default" (gray)

// Priority
CRITICAL: "danger" (red)
HIGH: "warning" (orange)
NORMAL: "primary" (blue)
LOW: "default" (gray)
```

---

## 🔐 SECURITY CONSIDERATIONS

1. **Environment Variables**
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

2. **Error Handling**
- Display user-friendly error messages
- Log errors to console in dev
- Retry failed requests
- Fallback UI for errors

3. **Data Validation**
- Validate all user inputs
- Sanitize display data
- Handle null/undefined values
- Type checking with TypeScript

---

## 📱 RESPONSIVE BREAKPOINTS

```typescript
// Tailwind/NextUI breakpoints
sm: 640px   // Mobile landscape
md: 768px   // Tablet
lg: 1024px  // Laptop
xl: 1280px  // Desktop
2xl: 1536px // Large desktop
```

---

## ✅ CHECKLIST

- [ ] Setup Next.js project with App Router
- [ ] Install NextUI v2 and dependencies
- [ ] Configure Tailwind with NextUI theme
- [ ] Create API service layer with axios
- [ ] Implement authentication (if needed)
- [ ] Build Dashboard page
- [ ] Build Verifications page
- [ ] Build Threats page
- [ ] Build Analytics page
- [ ] Build Citizens page
- [ ] Build Official Information page
- [ ] Build Data Gaps page
- [ ] Build Threat Patterns page
- [ ] Add charts and visualizations
- [ ] Implement filters and search
- [ ] Add pagination
- [ ] Test on mobile devices
- [ ] Optimize performance
- [ ] Add error boundaries
- [ ] Deploy to production

---

## 🚀 GETTING STARTED COMMANDS

```bash
# Create Next.js app
npx create-next-app@latest geneline-x-frontend --typescript --tailwind --app

# Install NextUI
npm install @nextui-org/react framer-motion

# Install additional dependencies
npm install axios recharts lucide-react date-fns zustand

# Install dev dependencies
npm install -D @types/node @types/react @types/react-dom

# Run development server
npm run dev
```

---

This prompt contains ONLY the actual endpoints available in your server. No extra features, no fictional APIs - just exactly what your backend provides. Build your frontend to consume these exact endpoints! 🎉
