# skill_gitAddCommitPush

## Trigger

User says `@skills/skill_gitAddCommitPush.md` or `skill_gitAddCommitPush.md`, or any equivalent that means: run the build check, fix errors, then commit and push.

## What it means

Run `npm run build`. If it passes clean, commit everything and push to main. If it fails, fix every error first, then commit and push. Never push broken code.

## Behavior

When triggered, Claude:

1. Run `npm run build` and capture output
2. If build passes with no errors → go to step 4
3. If build errors → fix every error in source files, then re-run `npm run build` to confirm clean — repeat until clean
4. `git add .`
5. Write a professional commit message that summarizes the actual changes made (what changed and why, not generic boilerplate)
6. `git commit -m "<message>"`
7. `git push origin main`
8. Report: build status, what was fixed (if anything), and the commit message used

## Scope

- Touches: any source file with a build error
- Off-limits: do not change logic, features, or content beyond what's needed to fix build errors

## Edge cases

- Build passes first try: skip directly to git steps, no "nothing to fix" comment needed
- Multiple errors: fix all in one pass before re-checking build
- Push rejected (branch behind remote): tell user — do not force push
- Nothing to commit (clean working tree): tell user, skip commit/push

## Boundaries

- Never force push (`--force`) to main
- Never skip the build check — always run it first
- Never commit if build is still failing
- Commit message must reflect actual changes, not a placeholder like "update files"

## Example

User: `@skills/skill_gitAddCommitPush.md`
Claude: Runs `npm run build` → finds 2 type errors → fixes them → build passes → `git add .` → `git commit -m "fix: resolve TypeScript type errors in FolderView and Leaf components"` → `git push origin main` → reports done
