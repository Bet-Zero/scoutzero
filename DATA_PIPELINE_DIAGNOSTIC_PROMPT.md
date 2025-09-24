# Data Pipeline Diagnostic Prompt for AI Agent

## Context Setting

I'm working on the ScoutZero NBA scouting platform and I'm completely lost about where I am with the data processing pipeline. The project has evolved through multiple approaches and I need clarity on the current state and next steps.

## Your Mission

Please analyze my current data pipeline setup and provide a clear, actionable plan. I need you to:

1. **Assess Current State**: Figure out what data pipeline components are actually working vs. what's broken/incomplete
2. **Identify the Best Path Forward**: Recommend whether to stick with current approach or pivot to something else
3. **Provide Concrete Next Steps**: Give me specific commands/actions I can take today

## Key Questions I Need Answered

### Current State Analysis

- What data pipeline approach am I currently using? (Python scripts, Cloud Functions, manual processes, etc.)
- Which components are functional and which are broken?
- What's the actual flow for updating player data right now?
- Are there conflicting approaches that need to be resolved?

### Functional Requirements

- How do I update NBA player data for new seasons?
- How do I add new players (rookies, trades, signings)?
- How do I update contracts and salary information?
- How do I preserve user scouting grades during data updates?
- What's the simplest way to get fresh data into my Firebase?

### Technical Constraints

- The app is React + Firebase (Firestore)
- I want to minimize manual work and complexity
- I don't want to maintain multiple conflicting systems
- I need something reliable that won't break

## What to Investigate

### Check These Files/Folders

- `/data_pipeline/` - Python scripts and documentation
- `/functions/` - Firebase Cloud Functions attempt
- `/scripts/` - Node.js helper scripts
- `package.json` - Available npm commands
- `/data_pipeline/docs/` - Documentation about various approaches

### Key Commands to Test

Try running these and tell me what works/fails:

```bash
npm run season:transition
npm run contracts:update
npm run data:populate
npm run stats:update
```

### Data Flow Questions

- Where does player data currently come from?
- How does it get into Firebase?
- What manual steps am I doing that could be automated?
- Are there any working automated processes?

## Desired Outcome

Give me a clear recommendation in this format:

### Current State Summary

- What's working now
- What's broken/incomplete
- What's conflicting/redundant

### Recommended Approach

- Should I stick with Python scripts?
- Should I move to Cloud Functions?
- Should I use the Node.js scripts?
- Or is there a simpler approach?

### Long-term Strategy

- What's the sustainable approach for regular data updates?
- How do I handle season transitions?
- What should I build vs. what should I abandon?

## Additional Context

- I've been working on this with multiple AI assistants
- The project has documentation that may be outdated or conflicting
- I'm feeling overwhelmed by the complexity
- I just want something that works reliably
- I'm willing to throw away approaches that aren't working

Please be honest about what you find - if something is broken or overly complex, tell me to abandon it. I'd rather have a simple solution that works than a complex one that doesn't.
