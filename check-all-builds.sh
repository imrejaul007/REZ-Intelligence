#!/bin/bash
# Check all services for TypeScript build errors

REZ_DIR="/Users/rejaulkarim/Documents/ReZ Full App/REZ-Intelligence"
cd "$REZ_DIR"

echo "Checking all REZ-Intelligence services for TypeScript build errors..."
echo "============================================"

for pkg in */; do
  if [ -d "$pkg" ] && [ -f "$pkg/package.json" ]; then
    # Skip non-service directories
    if [[ "$pkg" == "node_modules/" ]] || [[ "$pkg" == "dist/" ]] || [[ "$pkg" == "docs/" ]] || [[ "$pkg" == "logs/" ]] || [[ "$pkg" == "scripts/" ]] || [[ "$pkg" == "src/" ]] || [[ "$pkg" == "packages/" ]]; then
      continue
    fi

    # Check if there's a build script
    if grep -q '"build"' "$pkg/package.json" 2>/dev/null; then
      echo ""
      echo "Checking: $pkg"
      cd "$REZ_DIR"

      # Run build and capture output
      output=$(cd "$pkg" && npm run build 2>&1)
      errors=$(echo "$output" | grep -E "error TS" | head -5)

      if [ -n "$errors" ]; then
        echo "  HAS ERRORS:"
        echo "$errors" | sed 's/^/    /'
      else
        echo "  OK"
      fi
    fi
  fi
done

echo ""
echo "============================================"
echo "Build check complete."
