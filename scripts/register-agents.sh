#!/bin/bash

# Register Expert Agents with Orchestrator

ORCH_URL="http://localhost:4006"
TOKEN="core-brain-token-123"

echo "Registering Expert Agents with Orchestrator..."

# Culinary Expert
curl -s -X POST ${ORCH_URL}/api/v2/routing/agents \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${TOKEN}" \
  -d '{
    "name": "Culinary Expert",
    "description": "Food ordering, restaurant recommendations, dietary preferences",
    "capabilities": ["food_ordering", "restaurant_search", "dietary_preferences", "menu_recommendations"],
    "endpoint": "http://localhost:3001/api/culinary/chat",
    "version": "1.0.0"
  }' && echo " - Culinary Expert registered"

# Hospitality Expert
curl -s -X POST ${ORCH_URL}/api/v2/routing/agents \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${TOKEN}" \
  -d '{
    "name": "Hospitality Expert",
    "description": "Hotels, stays, room service, check-in/out",
    "capabilities": ["hotel_booking", "room_service", "checkin_checkout", "travel_stay"],
    "endpoint": "http://localhost:3000/api/v1/hospitality/chat",
    "version": "1.0.0"
  }' && echo " - Hospitality Expert registered"

# Health Expert
curl -s -X POST ${ORCH_URL}/api/v2/routing/agents \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${TOKEN}" \
  -d '{
    "name": "Health Expert",
    "description": "Healthcare, clinic appointments, medical services",
    "capabilities": ["healthcare", "appointments", "medical_services"],
    "endpoint": "http://localhost:3011/api/v1/health/chat",
    "version": "1.0.0"
  }' && echo " - Health Expert registered"

# Travel Expert
curl -s -X POST ${ORCH_URL}/api/v2/routing/agents \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${TOKEN}" \
  -d '{
    "name": "Travel Expert",
    "description": "Travel booking, tourism, transportation",
    "capabilities": ["travel_booking", "tourism", "transportation"],
    "endpoint": "http://localhost:3003/api/v1/travel/chat",
    "version": "1.0.0"
  }' && echo " - Travel Expert registered"

echo ""
echo "Checking registered agents..."
curl -s ${ORCH_URL}/api/v2/routing/agents \
  -H "X-Internal-Token: ${TOKEN}" | jq '.count'
