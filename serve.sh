#!/usr/bin/env bash
cd "$(dirname "$0")"
echo "Serving They Live test page at:"
echo "  http://localhost:8765/test/test-page.html"
echo ""
echo "Press Ctrl+C to stop."
python3 -m http.server 8765
