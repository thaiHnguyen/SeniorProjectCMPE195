# CI/CD

```
 push / pull request ─>  CI (GitHub's servers)              ─>   Deploy (runs ON the Pi)
                          ├─ Backend:  pytest (Python 3.11)        only for main, only if CI passed
                          └─ Frontend: ESLint + vite build          pull → back up DB → restart → health check
                                                                    └─ unhealthy? automatic rollback
```

## Files and what they do
- `.github/workflows/ci.yml`: **CI**: tests + lint + build on every push and every PR into `main` 
- `.github/workflows/deploy.yml`:**CD**: deploys the backend to the Pi after CI passes on `main` (off until the Pi is set up) 
- `deploy/deploy.sh`: The deploy itself. The workflow calls it; you can also run it by hand on the Pi 
- `deploy/hydroponic.service`: systemd service that runs the backend on the Pi 
- `.github/actionlint.yaml`: Tells the workflow linter about the `hydro-pi` runner label 
---

## CI (works as soon as this is merged)

Every push to any branch and every pull request into `main` runs two jobs:

- **Backend tests**: Python 3.11 (same as the Pi), `pip install -r requirements.txt`, `pytest tests` - Broken backend logic, login, alerts, migrations 
- **Frontend lint + build**: Node 22, `npm ci`, `npm run lint`, `npm run build` - Unused variables, React mistakes, imports that don't exist. Also **file-name case mistakes** (`Logo_Light.png` vs `Logo_light.png`) that work on Windows but break on Linux and the Pi 

**Where to see results:** the ✅ / ❌ next to each commit on GitHub, the checks box on every pull request, and the repo's **Actions** tab. Click a ❌ to see which step failed and its output.

**Run the same checks locally before pushing:**
```bash
python -m pytest tests                        # repo root
cd frontend && npm run lint && npm run build
```

**Recommended: protect `main`.** Settings → Branches → Add rule for `main` → *Require status checks to pass before merging* → select **Backend tests (pytest)** and **Frontend lint + build**. Then nothing broken can be merged into `main`, so nothing broken gets deployed.

---

## CD: deploy to the Pi (one-time setup by the hardware team)

### How it works
A **self-hosted GitHub runner** is installed on the Pi. It connects *out* to GitHub and waits for jobs, so GitHub never needs to reach the Pi (no port forwarding, works behind the school/home network). When CI passes on `main`, the runner runs `deploy/deploy.sh`:

1. Stops if the Pi has local edits to tracked files (`.env`, `data/`, `logs/` are ignored, so they're fine)
2. Fast-forwards the Pi's checkout to **exactly the commit CI tested** (never forces)
3. Backs up the database to `data/backups/` (keeps the newest 10)
4. Runs `pip install -r requirements.txt` **only if** that file changed
5. Restarts the `hydroponic` service
6. Waits up to 60 s for `/api/health`. **If it doesn't come up, it rolls back** the code and the database, restarts, and marks the deploy as failed (❌)

### Before you start
- The Pi must be able to `git pull` **without typing a password** (SSH key, or a saved token). Check with `git -C ~/<repo-folder> pull`.
- You need **admin** access to the GitHub repo to add a runner. In the class org, the instructor/org owner may need to allow self-hosted runners.
- The backend already works on the Pi with a `.env` (see `backend/BACKEND_UPDATE.md`).

### 1. Run the backend as a systemd service
```bash
cd ~/<repo-folder>
nano deploy/hydroponic.service      # replace <pi-user> and <repo-folder>; fix the python path if there's no venv
sudo cp deploy/hydroponic.service /etc/systemd/system/hydroponic.service
sudo systemctl daemon-reload
sudo systemctl enable --now hydroponic
curl http://localhost:8000/api/health
```
If the backend was running in a terminal/tmux before, stop that first (`Ctrl+C`) so the port is free.

### 2. Let the deploy restart the service without a password
```bash
echo "<pi-user> ALL=(root) NOPASSWD: /usr/bin/systemctl restart hydroponic" | sudo tee /etc/sudoers.d/hydroponic-deploy
sudo chmod 440 /etc/sudoers.d/hydroponic-deploy
sudo -n systemctl restart hydroponic && echo OK     # must print OK without asking for a password
```
This allows **only** that one command.

### 3. Install the GitHub runner on the Pi
On GitHub: **Settings → Actions → Runners → New self-hosted runner → Linux → ARM64**. Run the download commands it shows, as the **same user that owns the repo folder** (not root), then configure it with our label:
```bash
./config.sh --url https://github.com/<org>/<repo> --token <token-from-that-page> --labels hydro-pi --name hydro-pi
sudo ./svc.sh install       # run the runner as a service, so it survives reboots
sudo ./svc.sh start
```
The runner should show as **Idle** on that GitHub page.

### 4. Turn deploys on
GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**

Variables and value:
- `PI_DEPLOY_ENABLED`: `true`
- `PI_DEPLOY_DIR`: full path of the repo on the Pi, e.g. `/home/vy/group-project-expedition-23` 
- `PI_SERVICE_NAME`: *(optional)* default `hydroponic` 
- `PI_HEALTH_URL`: *(optional)* default `http://localhost:8000/api/health`

### 5. Test it
**Actions → Deploy to Pi → Run workflow**. The log should end with `Healthy at <commit>`. From now on, every push to `main` that passes CI deploys automatically.

To pause deploys (e.g. during a demo), set `PI_DEPLOY_ENABLED` to `false`.

---

## Manual deploy / rollback (on the Pi)

```bash
cd ~/<repo-folder>
bash deploy/deploy.sh                          # deploy latest main, same steps as the workflow

# go back to an older version by hand
sudo systemctl stop hydroponic
git reset --hard <old-commit>
cp data/backups/hydroponic-<timestamp>-<commit>.db data/hydroponic.db    # only if the DB needs restoring
sudo systemctl start hydroponic
```

---

## Troubleshooting
- CI ❌ on **Lint**: Run `npm run lint` in `frontend/` and fix what it lists 

- CI ❌ on **Build**: but it works on local laptop. Usually a file-name case mismatch in an import. Linux is case-sensitive 

- CI ❌ on **Run tests**: Run `python -m pytest tests -x` locally; `-x` stops at the first failure 

- Deploy job never starts / "Waiting for a runner": The runner is offline: `sudo ./svc.sh status` in the runner folder on the Pi, and check the Pi is online 

- Deploy didn't run after a push: Check CI passed (deploy only follows a green CI on `main`) and `PI_DEPLOY_ENABLED` is `true` 

- `uncommitted changes to tracked files`: Someone edited code directly on the Pi. Commit it from a laptop, or `git checkout -- <file>` on the Pi 

- `can't fast-forward`: The Pi's `main` has commits that aren't on GitHub. Push them, or `git reset --hard origin/main` if they aren't needed

- `git fetch failed`: The Pi can't pull without a password. Set up an SSH key or a saved token 

- `sudo: a password is required` | Step 2 (sudoers) is missing or has the wrong user/path. Check `which systemctl`

- `rolled back`: The new code didn't start. On the Pi: `sudo journalctl -u hydroponic -n 80` shows why

### Status badge for the README (optional)
```markdown
![CI](https://github.com/<org>/<repo>/actions/workflows/ci.yml/badge.svg)
```