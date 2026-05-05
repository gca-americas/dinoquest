#!/bin/bash

URL="https://dinoquest2-984439674425.us-central1.run.app"
COUNT=15
INTERVAL=2

for i in $(seq 1 $COUNT); do
  echo "--- Request $i / $COUNT ---"
  curl -s -o /dev/null -w "Status: %{http_code}  Time: %{time_total}s\n" "$URL"
  if [ $i -lt $COUNT ]; then
    sleep $INTERVAL
  fi
done
