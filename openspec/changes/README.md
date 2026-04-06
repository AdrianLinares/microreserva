# OpenSpec Changes Directory

Use this folder to store spec-driven change artifacts for each proposed or active change.

## Intended Use

- Create one subfolder per change using a short, descriptive slug.
- Keep proposal, spec delta, design notes, and tasks together for that change.
- Track implementation progress by updating that change's task checklist.

## Recommended Structure

```
openspec/changes/<change-slug>/
  proposal.md
  spec.md
  design.md
  tasks.md
```

When a change is completed and archived, its final synced specs should live in the main specs location according to your SDD archive process.
