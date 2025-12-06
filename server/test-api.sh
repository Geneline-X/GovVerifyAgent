#!/bin/bash

# GovVerify API Testing Script
# Quick test of all 38 endpoints

BASE_URL="http://localhost:3800"

echo "🚀 Testing GovVerify API Endpoints..."
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test function
test_endpoint() {
    local method=$1
    local endpoint=$2
    local description=$3
    
    echo -e "${BLUE}Testing:${NC} $description"
    echo -e "${BLUE}Endpoint:${NC} $method $endpoint"
    
    response=$(curl -s -o /dev/null -w "%{http_code}" -X $method "$BASE_URL$endpoint")
    
    if [ "$response" -eq 200 ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $response)"
    else
        echo -e "${RED}✗ FAIL${NC} (HTTP $response)"
    fi
    echo ""
}

echo "📊 ANALYTICS ENDPOINTS"
echo "----------------------"
test_endpoint "GET" "/api/analytics/overview" "Dashboard Overview"
test_endpoint "GET" "/api/analytics/verifications/status" "Verification Status"
test_endpoint "GET" "/api/analytics/verifications/trends?days=7" "Verification Trends"
test_endpoint "GET" "/api/analytics/verifications/categories?limit=5" "Top Categories"
test_endpoint "GET" "/api/analytics/verifications/confidence" "Confidence Levels"
test_endpoint "GET" "/api/analytics/verifications/recent?limit=5" "Recent Verifications"
test_endpoint "GET" "/api/analytics/threats/types?limit=5" "Top Threat Types"
test_endpoint "GET" "/api/analytics/threats/trends?days=30" "Threat Trends"
test_endpoint "GET" "/api/analytics/threats/financial-impact?days=30" "Financial Impact"
test_endpoint "GET" "/api/analytics/threats/urgent?limit=5" "Urgent Threats"
test_endpoint "GET" "/api/analytics/threats/status-breakdown" "Threat Status"
test_endpoint "GET" "/api/analytics/patterns" "Threat Patterns"
test_endpoint "GET" "/api/analytics/daily-stats?from=2025-12-01&to=2025-12-06" "Daily Stats"

echo "👥 CITIZEN ENGAGEMENT ENDPOINTS"
echo "--------------------------------"
test_endpoint "GET" "/api/citizen-engagement/overview" "Engagement Overview"
test_endpoint "GET" "/api/citizen-engagement/daily-active-users?days=7" "Daily Active Users"
test_endpoint "GET" "/api/citizen-engagement/user-roles" "User Roles"
test_endpoint "GET" "/api/citizen-engagement/top-users?limit=5" "Top Users"
test_endpoint "GET" "/api/citizen-engagement/recent-activities?limit=10" "Recent Activities"
test_endpoint "GET" "/api/citizen-engagement/activity-breakdown" "Activity Breakdown"
test_endpoint "GET" "/api/citizen-engagement/user-feedback" "User Feedback"

echo "📄 DOCUMENT FEEDS ENDPOINTS"
echo "---------------------------"
test_endpoint "GET" "/api/feeds/verifications?limit=5" "Verification Feed"
test_endpoint "GET" "/api/feeds/threats?limit=5" "Threats Feed"
test_endpoint "GET" "/api/feeds/official-information?limit=5" "Official Info Feed"
test_endpoint "GET" "/api/feeds/public-awareness?limit=5" "Awareness Feed"
test_endpoint "GET" "/api/feeds/information-requests?limit=5" "Info Requests Feed"
test_endpoint "GET" "/api/feeds/user-feedback?limit=5" "Feedback Feed"
test_endpoint "GET" "/api/feeds/combined?limit=10" "Combined Feed"

echo "📈 CITIZEN STATS ENDPOINTS"
echo "--------------------------"
test_endpoint "GET" "/api/citizen-stats/overview" "Stats Overview"
test_endpoint "GET" "/api/citizen-stats/top-queries?limit=5" "Top Queries"
test_endpoint "GET" "/api/citizen-stats/query-trends?days=7" "Query Trends"
test_endpoint "GET" "/api/citizen-stats/popular-topics?limit=5" "Popular Topics"
test_endpoint "GET" "/api/citizen-stats/ministry-distribution" "Ministry Distribution"
test_endpoint "GET" "/api/citizen-stats/response-quality" "Response Quality"
test_endpoint "GET" "/api/citizen-stats/unanswered-queries?limit=5" "Unanswered Queries"
test_endpoint "GET" "/api/citizen-stats/peak-hours" "Peak Hours"
test_endpoint "GET" "/api/citizen-stats/user-retention?days=30" "User Retention"

echo "======================================"
echo "✅ Testing Complete!"
echo ""
echo "To view detailed responses:"
echo "  curl -s http://localhost:3000/api/analytics/overview | jq"
echo ""
echo "To test a specific endpoint:"
echo "  curl -v http://localhost:3000/api/analytics/overview"
