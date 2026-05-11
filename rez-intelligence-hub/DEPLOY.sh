#!/bin/bash
# Deploy REZ Intelligence Hub to Render

set -e

echo "=== Deploying REZ Intelligence Hub ==="

cd "$(dirname "$0")"

# Build
echo "Building..."
npm run build

# Check if dist exists
if [ ! -d "dist" ]; then
  echo "ERROR: Build failed - dist directory not found"
  exit 1
fi

echo "Build successful!"

# Render deployment
echo ""
echo "To deploy to Render:"
echo "1. Go to https://dashboard.render.com"
echo "2. Create new Web Service"
echo "3. Connect your GitHub repository"
echo "4. Set build command: npm run build"
echo "5. Set start command: npm start"
echo "6. Set environment variables:"
echo "   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/rez_intelligence"
echo "   INTENT_GRAPH_URL=https://rez-intent-graph.onrender.com"
echo "7. Set port: 4020"

echo ""
echo "=== Deploy Instructions Ready ==="
