#!/bin/bash

# REZ Agent OS - Stop Script
# Stops all services

echo "Stopping REZ Agent OS services..."

pkill -f "rez-core-brain" 2>/dev/null && echo "Core Brain stopped" || true
pkill -f "rez-orchestrator-v2" 2>/dev/null && echo "Orchestrator stopped" || true
pkill -f "rez-channel-orchestrator" 2>/dev/null && echo "Channel Orchestrator stopped" || true
pkill -f "rez-sms-bridge" 2>/dev/null && echo "SMS Bridge stopped" || true
pkill -f "rez-email-bridge" 2>/dev/null && echo "Email Bridge stopped" || true
pkill -f "rez-rcs-bridge" 2>/dev/null && echo "RCS Bridge stopped" || true
pkill -f "rez-web-widget" 2>/dev/null && echo "Web Widget stopped" || true
pkill -f "rez-app-bridge" 2>/dev/null && echo "App Bridge stopped" || true
pkill -f "rez-culinary-expert" 2>/dev/null && echo "Culinary Expert stopped" || true
pkill -f "rez-hospitality-expert" 2>/dev/null && echo "Hospitality Expert stopped" || true
pkill -f "rez-health-expert" 2>/dev/null && echo "Health Expert stopped" || true
pkill -f "rez-fitness-expert" 2>/dev/null && echo "Fitness Expert stopped" || true
pkill -f "rez-retail-expert" 2>/dev/null && echo "Retail Expert stopped" || true
pkill -f "rez-salon-expert" 2>/dev/null && echo "Salon Expert stopped" || true
pkill -f "rez-travel-expert" 2>/dev/null && echo "Travel Expert stopped" || true
pkill -f "rez-education-expert" 2>/dev/null && echo "Education Expert stopped" || true

echo ""
echo "All services stopped."
