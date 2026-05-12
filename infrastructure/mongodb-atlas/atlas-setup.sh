#!/bin/bash
# MongoDB Atlas Setup Script

echo "MongoDB Atlas Setup for REZ Intelligence"
echo "======================================"

# Check if mongosh is installed
if ! command -v mongosh &> /dev/null; then
    echo "Installing mongosh..."
    brew install mongosh  # macOS
fi

# Atlas connection string (replace with your actual connection string)
ATLAS_URI="${MONGODB_URI:-mongodb+srv://<username>:<password>@cluster.mongodb.net}"

echo ""
echo "Connecting to Atlas..."
echo "URI: $ATLAS_URI"

# Test connection
mongosh "$ATLAS_URI" --eval "db.adminCommand({ping:1})"

# Create databases
echo ""
echo "Creating databases..."
mongosh "$ATLAS_URI" --eval "
  use rez_intelligence;
  db.createCollection('profiles');
  db.createCollection('events');
  db.createCollection('recommendations');
  db.createCollection('feedback');
"

mongosh "$ATLAS_URI/rez_events" --eval "
  db.createCollection('events');
  db.createCollection('sessions');
"

mongosh "$ATLAS_URI/rez_orders" --eval "
  db.createCollection('orders');
  db.createCollection('payments');
"

mongosh "$ATLAS_URI/rez_ml" --eval "
  db.createCollection('models');
  db.createCollection('predictions');
  db.createCollection('training_data');
"

mongosh "$ATLAS_URI/rez_logs" --eval "
  db.createCollection('logs');
  db.createCollection('audit');
"

echo ""
echo "Creating indexes..."
mongosh "$ATLAS_URI/rez_intelligence" --eval "
  db.profiles.createIndex({unifiedId:1},{unique:true});
  db.profiles.createIndex({'identifiers.phone':1});
  db.events.createIndex({userId:1,timestamp:-1});
  db.recommendations.createIndex({userId:1,type:1,createdAt:-1});
"

echo ""
echo "Setup complete!"
echo ""
echo "Environment variable to set:"
echo "export MONGODB_URI='$ATLAS_URI'"
