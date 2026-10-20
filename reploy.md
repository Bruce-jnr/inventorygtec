# Deploy Student Inventory to cPanel using GitHub and Setup Node.js App

This guide uses GitHub as the source repository and runs the cloned project directly through cPanel's **Setup Node.js App**. The startup file is **app.js** at the project root, and the private configuration file is **.env** at that same root.

Replace these examples with your real values:

| Setting | Example |
| --- | --- |
| GitHub repository | `YOUR_GITHUB_USER/StudentInventory` |
| cPanel username | `yourcpaneluser` |
| Application root, relative to your cPanel home | `studentinventory` |
| Full server path | `/home/yourcpaneluser/studentinventory` |
| Application URL | `https://students.example.com` |
| Startup file | `app.js` |

Use the root of a domain or subdomain for the application URL. The app currently expects routes such as `/api`, `/admin/login`, and `/retrieve` at the domain root.

## 1. Confirm your hosting features

Your hosting account needs **Setup Node.js App**, **Git Version Control**, Terminal or SSH access, MySQL, HTTPS, and persistent writable storage. Select Node.js **22.12 or newer**. If a feature is missing, ask your hosting provider to enable it.

Create the domain/subdomain in cPanel and enable its SSL certificate before testing admin login. Production session cookies require HTTPS.

## 2. Push the project to GitHub

Create an empty repository on GitHub, preferably private. If the project is not already connected to Git, run these commands locally from the project root:

```sh
git init
git add .
git status
git commit -m "Prepare Student Inventory for deployment"
git branch -M main
git remote add origin git@github.com:YOUR_GITHUB_USER/StudentInventory.git
git push -u origin main
```

If you already have a repository and remote, commit and push your changes using that existing setup instead. GitHub authentication must already be configured on your computer; do not put passwords or tokens into the remote URL.

Before committing, inspect `git status`. The existing `.gitignore` excludes `.env`, `node_modules`, `frontend/dist`, private uploads, logs, and generated test artifacts. Commit `.env.example`, source files, and all package lockfiles. Never commit real credentials or student documents. If secrets were committed previously, ignoring them now does not remove the earlier copies; rotate those credentials before deployment.

## 3. Connect cPanel to GitHub

For a **public repository**, you can clone with its HTTPS URL:

```text
https://github.com/YOUR_GITHUB_USER/StudentInventory.git
```

For a **private repository**, configure a read-only GitHub deploy key. In cPanel Terminal, generate a dedicated key without overwriting any existing key:

```sh
ssh-keygen -t ed25519 -C "studentinventory-cpanel" -f ~/.ssh/studentinventory_github
cat ~/.ssh/studentinventory_github.pub
```

For unattended Git pulls, the host needs a key it can use without an interactive passphrase prompt. Restrict this key to this repository and keep the private key on the hosting account.

Copy only the **public** key into GitHub: **Repository → Settings → Deploy keys → Add deploy key**. Leave **Allow write access** unchecked.

Edit `~/.ssh/config`, preserving any existing entries, and add:

```sshconfig
Host github-studentinventory
  HostName github.com
  User git
  IdentityFile ~/.ssh/studentinventory_github
  IdentitiesOnly yes
```

On the cPanel server:

```sh
chmod 700 ~/.ssh
chmod 600 ~/.ssh/studentinventory_github ~/.ssh/config
ssh -T git@github-studentinventory
```

On the first connection, verify GitHub's host-key fingerprint against its official documentation before accepting it. A successful GitHub authentication message says shell access is unavailable; that is expected. Use this clone URL for the private repository:

```text
git@github-studentinventory:YOUR_GITHUB_USER/StudentInventory.git
```

## 4. Clone the repository in cPanel

Open **cPanel → Git Version Control → Create**:

1. Enable **Clone a Repository**.
2. Enter the public HTTPS URL or private SSH URL from the previous section.
3. Set **Repository Path** to `/home/yourcpaneluser/studentinventory`.
4. Choose a repository name and click **Create**.

Keep the repository/application root outside `public_html`. The Node server serves only the built `frontend/dist` directory; it must not expose the repository, `.git`, `.env`, backend source, or uploads as public files.

## 5. Create the Node.js application

Open **cPanel → Setup Node.js App → Create Application**:

| Field | Value |
| --- | --- |
| Node.js version | `22.12+`, or a newer supported release |
| Application mode | `Production` |
| Application root | `studentinventory` |
| Application URL | Your HTTPS domain/subdomain, at `/` |
| Application startup file | `app.js` |

Click **Create**. The application may fail to start initially because the environment, database, dependencies, and frontend build are not ready yet. Finish the following steps, then restart it.

Copy the **Node.js environment activation command** displayed by cPanel. Paste that exact command into cPanel Terminal before running npm commands. Do not guess the environment path: it depends on your account, app path, and selected Node version.

After activation, change to the application root and check the versions:

```sh
cd /home/yourcpaneluser/studentinventory
node --version
npm --version
```

## 6. Create the MySQL database and root .env

In **cPanel → MySQL Database Wizard**, create a database and database user, and assign that user privileges on the database. Use the complete prefixed names shown by cPanel, such as `yourcpaneluser_inventory` and `yourcpaneluser_inventoryuser`.

At `/home/yourcpaneluser/studentinventory`, create `.env` from `.env.example`. If `.env` already exists, edit it rather than overwriting it. File Manager's **Show Hidden Files** option may be needed.

```env
NODE_ENV=production
FRONTEND_ORIGIN=https://students.example.com
DB_HOST=localhost
DB_PORT=3306
DB_NAME=yourcpaneluser_inventory
DB_USER=yourcpaneluser_inventoryuser
DB_PASSWORD="replace_with_your_database_password"
SESSION_SECRET=replace_with_a_long_random_secret
UPLOAD_DIR=./uploads
MAX_UPLOAD_MB=3
```

Generate a session secret in the activated terminal:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy that output into `SESSION_SECRET`; do not commit it. Set restrictive permissions:

```sh
chmod 600 .env
mkdir -p backend/uploads
chmod 700 backend/uploads
```

`UPLOAD_DIR=./uploads` resolves to `backend/uploads`, preserving this project's existing storage convention. Do not delete this directory during updates.

If your provider uses a different database hostname or port, use its values. Set `FRONTEND_ORIGIN` to the exact HTTPS origin with no trailing slash. Let cPanel provide `PORT` if it sets one. Environment variables configured in the Node.js setup screen take precedence over `.env`, so remove stale duplicate values or keep them consistent.

## 7. Install dependencies and build the frontend

From the activated Node.js environment, in the application root:

```sh
npm install
npm --prefix frontend ci --include=dev
npm run build
```

The root `npm install` runs this project's `postinstall`, which installs backend dependencies. You can use **Run NPM Install** in the cPanel Node.js screen instead of the first command. If your host disables lifecycle scripts, explicitly run:

```sh
npm --prefix backend ci --omit=dev
```

The frontend build needs its development dependencies even though the application runs in production. That is why its installation uses `--include=dev`.

Leave `VITE_API_BASE_URL` unset or empty for this deployment so the frontend uses the same domain's `/api`. Do not build with a localhost API URL. If the Node.js selector manages a root `node_modules` symlink, preserve it and prefer its **Run NPM Install** button for the root installation.

Do not copy Windows `node_modules` to Linux hosting. Packages such as Sharp and bcrypt must install for the server's platform.

**Important:** `frontend/dist` is ignored by Git, so cloning or pulling from GitHub does not provide the build. Build it on the server using the commands above. If the host lacks enough memory to build, run `npm run build` locally and upload the resulting `frontend/dist` separately, then restart the app.

## 8. Initialize tables and create the administrator

Still in the application root and activated environment:

```sh
npm run db:init
npm run admin:create
```

Database setup uses the existing cPanel database and adds missing tables/columns. It does not drop existing student records. The user needs CREATE/ALTER privileges for schema setup. Use a more restricted runtime account afterward if your hosting arrangement supports it.

Administrator setup prompts for a username and hidden password. Keep the password between 12 and 72 UTF-8 bytes. There is no default administrator. Run this command only when creating an administrator, not on every deployment.

## 9. Restart and verify

Return to **Setup Node.js App** and click **Restart**. cPanel manages the process; do not start a second permanent server with `npm start` in another terminal.

Check these URLs:

| URL | Expected result |
| --- | --- |
| `https://students.example.com/` | Student registration form |
| `https://students.example.com/retrieve` | Retrieve and correct a registration |
| `https://students.example.com/admin/login` | Administrator login |
| `https://students.example.com/api/health` | `{"status":"ok"}` |
| `https://students.example.com/.env` | 404; no secrets |

Test with a synthetic student: submit the form, retrieve it, save a correction, sign in as admin, view documents, and print the single-page record. Check both one- and two-certificate submissions. Configure the backup and retention arrangements described in [docs/OPERATIONS.md](docs/OPERATIONS.md) before accepting real student information.

## 10. Deploy future changes from GitHub

Locally, commit and push your changes. On the server, take a consistent database/private-upload backup before schema changes. Then:

1. Open **Git Version Control → Manage → Pull or Deploy → Update from Remote** to fetch the new revision. Alternatively, use the terminal commands below.
2. Activate the Node.js environment shown in **Setup Node.js App**.
3. In the application root, install dependencies, rebuild, apply schema additions, and restart.

```sh
cd /home/yourcpaneluser/studentinventory
git status --short
git pull --ff-only origin main
npm install
npm --prefix frontend ci --include=dev
npm run build
npm run db:init
```

Run `git pull` only if you did not already update the working tree through the cPanel interface. If tracked local changes or conflicts are reported, resolve them before continuing; do not reset or clean the live directory to force an update. Finally, click **Restart** in Setup Node.js App and repeat the health/login checks.

Preserve `.env` and `backend/uploads`. Never use `git clean -fdx` on the live application directory: it can delete ignored credentials and uploaded documents.

This workflow runs directly from the clone, so it does **not** require **Deploy HEAD Commit** or a `.cpanel.yml`. That button is for a separate deployment-task workflow; if you use it later, configure and review those tasks explicitly. Pushing to GitHub alone does not automatically build or restart this application.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Node app will not start | Startup file is root `app.js`; selected Node version is supported; dependencies installed in the activated environment; inspect the application's Passenger/error log. |
| `ERR_MODULE_NOT_FOUND` | Read the next log line for the missing package/file. From the activated Node environment and application root, run `npm --prefix backend install --omit=dev`. If a local backend file is missing, pull/upload the complete backend directory and check filename casing. Root-only dependency installation may not install nested backend dependencies if lifecycle scripts were disabled. |
| `FRONTEND_BUILD_MISSING` | Run `npm --prefix frontend ci --include=dev` and `npm run build`, or upload the current local `frontend/dist`. |
| Database unavailable | Confirm prefixed database/user names, password, host, assigned privileges, and `npm run db:init`. |
| Login succeeds but redirects back to login | Use HTTPS; check production mode, cookies, proxy HTTPS forwarding, and the exact `FRONTEND_ORIGIN`. |
| GitHub clone/pull denied | Confirm the deploy key, SSH Host alias, repository permissions, host-key verification, and clone URL. |
| Uploads fail | Check `backend/uploads` ownership/write permission, available disk space and the host's request-size limit. Allow slightly more than 9 MB total for three 3 MB images plus multipart overhead. |
| Old frontend after pulling | Rebuild `frontend/dist`, restart the Node app, and refresh the browser. |
| Build is killed on shared hosting | Build locally and upload `frontend/dist`; keep the Node runtime dependencies installed on the Linux host. |

## Official references

- [cPanel Git Version Control](https://docs.cpanel.net/cpanel/files/git-version-control/)
- [cPanel Git deployment workflows](https://docs.cpanel.net/knowledge-base/web-services/guide-to-git-set-up-deployment/)
- [cPanel Node.js startup guidance](https://docs.cpanel.net/knowledge-base/web-services/how-to-install-a-node.js-application/)
- [CloudLinux Setup Node.js App settings](https://docs.cloudlinux.com/cloudlinuxos/lve_manager/)
- [GitHub deploy keys](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys)
- [GitHub SSH host-key fingerprints](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)

