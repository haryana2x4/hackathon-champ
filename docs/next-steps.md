# Next Steps & Deferred Ideas

Ideas intentionally left out of v1 to avoid scope creep and keep Hackathon Champ focused, reliable, and fast:

1. **Multi-Team Collaboration & Real-Time Sync:** WebSockets or Supabase/PostgreSQL backend so teammates can tick sprint tasks and read Champ's chat simultaneously from different laptops.
2. **Containerized Code Sandbox:** Replace the lightweight local `run_python` temp-dir subprocess with an ephemeral Docker/WebAssembly (Pyodide) sandbox for stronger isolation.
3. **GitHub Push from Scaffold:** One-click initialization and push of `workspace_out/<idea-slug>/` directly to a new GitHub repository using `GITHUB_TOKEN`.
4. **Calendar Export (`.ics`) for Sprint Milestones:** Export the generated sprint phases and 75% feature-freeze deadline to Google Calendar / Apple Calendar.
5. **PDF / Slide Deck Pitch Export:** Convert `pitch-2min.md` and architecture notes into a slide deck (`.pptx` or Reveal.js HTML).
6. **Multi-Brief Workspace & Saved Hackathons Import:** Attach hackathons from the Map directly to a Brief and track multiple past/upcoming hackathon workspaces cleanly.
7. **Automated Devpost Image/Thumbnail Helper:** Resize and check aspect ratio (3:2) of team demo screenshots before submission.
8. **Offline Local LLM Fallback (Ollama):** Optional local model adapter when hackathon venue Wi-Fi drops.
