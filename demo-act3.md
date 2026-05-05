# DinoQuest CI/CD Demo Script

## Before the Demo — One-time Setup

No manual PR creation needed — the CI skill files the PR automatically when it runs.

---

## Model Armor Demo Rollback (run to make the security demo replayable)

The CI skill detects that Model Armor is **missing** and installs it as part of the pipeline.
To replay this demo moment, you must remove the Model Armor integration so the scan fails again.

```bash
# 1. Strip Model Armor from requirements.txt
sed -i '' '/google-cloud-modelarmor/d' backend/requirements.txt

# 2. Remove Model Armor code from backend/main.py
# (removes the import block, _ma_client, _get_ma_client, check_prompt_safety, and the call site)
python3 - <<'EOF'
import re, pathlib

src = pathlib.Path("backend/main.py").read_text()

# Remove the import + client setup block
src = re.sub(
    r'\nimport os\nfrom google\.cloud import modelarmor_v1.*?print\(f"Model Armor check skipped.*?\)\n',
    '\n',
    src,
    flags=re.DOTALL
)

# Remove the call site inside generate_dinosaur
src = re.sub(r'\s*check_prompt_safety\(request\.preferences\)\n', '\n', src)

pathlib.Path("backend/main.py").write_text(src)
print("Model Armor removed from backend/main.py")
EOF

# 3. Commit and push the rollback
git add backend/requirements.txt backend/main.py
git commit -m "chore: remove Model Armor integration (demo reset)"
git push origin level_2
```

> After this reset, the next `/ci-dinoquest` run will detect the missing protection,
> install Model Armor, patch `backend/main.py`, and re-run tests — live on stage.

---

## Demo Reset Script (run before each demo)

```bash
# 1. Reset Cloud Run back to stable (pre-deploy state)
gcloud run services update-traffic dinoquest2 \
  --region=us-central1 --project=gca-america-virtual-ta-test \
  --to-revisions=dinoquest2-00016-w62=100

# 2. Close the old PR and reset the branch
gh pr close <PR_NUMBER> --repo weimeilin79/DinoQuest
git reset --hard origin/main
git push --force origin level_2

# 3. Re-apply the demo change
sed -i '' 's/"event": "LEVEL2_GAME_END"/"event": "LEVEL_2_GAME_END"/' \
  backend/main.py

git add backend/main.py
git commit -m "fix: normalize Level 2 game end event name to LEVEL_2_GAME_END"
git push origin level_2
```

> The CI skill will auto-generate and file the PR when it runs — no manual `gh pr create` needed.
> Each demo starts with a clean commit on the branch and no open PR.

---

## The Demo Flow

### Act 1 — Run CI and File the PR (4–5 min)

Type `/ci-dinoquest` in Claude Code.

> *"We've got a feature branch adding Level 2 to the game. Instead of manually creating a PR and then triggering CI, we just kick off the skill — it reads the current branch, writes a PR summary from the diff, files the PR automatically, and then runs the full pipeline."*

**Talking points as it runs:**

- **Auto PR creation** — *"It reads the git diff and commit history, synthesizes a title and summary, and files the PR — no copy-pasting templates."*

- **Scope detection** — *"Instead of blindly running every test, it reads the diff and decides what to test. Backend changed + frontend changed = full scope."*

- **TypeScript lint** — *"It finds pre-existing errors in firebase.ts, but since those files aren't in our diff it flags them as a warning and doesn't block the build. Pre-existing debt shouldn't block new features."*

- **Backend tests** — *"16 tests pass. It also reads the PR title — 'feat: Add Level 2' — so it knows this is a feature, not a hotfix. Full checks required."*

- **Model Armor security scan** — *"The skill checks whether the Gemini endpoint is protected against prompt injection and jailbreak attacks. It finds it isn't — Model Armor isn't installed. So it installs the GCP template, patches `backend/main.py` to wrap the Gemini call, and re-runs the tests. The security fix happens automatically, inside the pipeline, before the image is built."*

- **Cloud Build** — *"Builds a Docker image — React frontend + Python backend — and pushes it to Artifact Registry."*

- **Commit status** — *"Posts a ✅ back to the PR it just filed. If we had branch protection on main, this would be a hard gate — you literally cannot merge without it."*

---

### Act 2 — Run Canary Deploy (5–7 min)

Type `/canary-deploy` in Claude Code.

**Talking points as it runs:**

- **Risk scoring** — *"It reads the diff and scores the risk. New API routes are +3, new game component is +1, Level 2 feature content is +1. Score is 5/10 — medium risk. That maps to a 10% canary with a 15-minute window. A CSS-only change would go straight to 50%."*

- **SPA asset check** — *"Before splitting traffic it checks whether the two revisions serve different JS bundle filenames. If they do and there's no session affinity, users would get a blank page. We learned this the hard way — now it's caught automatically."*

> **Demo gotcha:** If you've run `/canary-deploy` multiple times, the stable revision may already be running Level 2 — meaning both revisions build to the same JS bundle hash and the SPA check passes trivially. To avoid this, always reset Cloud Run to a pre-Level-2 revision before the demo using the reset script above.

- **Traffic split** — *"10% of users hit the new revision, 90% stay on stable. Each user is pinned to one revision for their whole session via a cookie, so their HTML and JavaScript always come from the same build."*

- **Monitoring loop** — *"It watches error rates every 2 minutes. If the canary's error rate doubles the stable's, it rolls back automatically. No human needed."*

- **Promote** — *"All green. Promoted to 100%. The new version is live."*

---

## Suggested Realistic Additions

These would make the demo feel more production-grade:

**1. Add a failing test scenario**

Before the demo, temporarily break a test so CI catches it. Shows the "fail fast" story:

```python
# in backend/tests/test_main.py — temporarily break one assertion
assert response.status_code == 999  # will fail
```

Run CI → show it catching the failure → fix it → re-run → passes. Much more compelling than a straight green run.

**2. Set up branch protection on main**

In GitHub → Settings → Branches → add rule for `main`:
- Require `ci-dinoquest` status to pass
- Require PR before merging

Then show the PR page with the CI check as a hard gate. The merge button is greyed out until CI passes.

**3. Show the canary URL mid-deploy**

While the monitoring loop is running, open `https://canary---dinoquest2-ohke54lriq-uc.a.run.app` in a browser and show Level 2 running live on just 10% of traffic. Very visual.

**4. Trigger a rollback**

Temporarily inject a bug that causes 5xx errors on the canary, let the monitor catch it and auto-rollback. The "it saved us" moment is the most memorable part of a CD demo.
