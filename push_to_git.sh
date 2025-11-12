#!/bin/bash
cd /Users/dayhan/Desktop/ilsekreterlikdemo/sekreterlik4

echo "=== Git Status ==="
git status

echo ""
echo "=== Staging All Changes ==="
git add -A
git status --short

echo ""
echo "=== Committing ==="
git commit -m "fix: localAttendees kaydetme ve okuma sorunları düzeltildi, debug log'ları eklendi"

echo ""
echo "=== Pushing to Remote ==="
git push origin main

echo ""
echo "=== Verifying Push ==="
git log --oneline -1
git status


