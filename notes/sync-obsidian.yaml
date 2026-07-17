name: Sync Obsidian Branch

on:
  push:
    branches: [main]

permissions:
  contents: write

jobs:
  sync-obsidian:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repo (full history)
        uses: actions/checkout@v4
        with:
          fetch-depth: 0
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Configure git identity
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"

      - name: Ensure obsidian branch exists locally
        run: |
          if git ls-remote --exit-code --heads origin obsidian; then
            git fetch origin obsidian:obsidian
          else
            echo "obsidian branch doesn't exist yet — creating from main"
            git branch obsidian origin/main
          fi

      - name: Merge main into obsidian
        run: |
          git checkout obsidian
          git merge origin/main --no-edit

      - name: Push obsidian branch
        run: |
          git push origin obsidian