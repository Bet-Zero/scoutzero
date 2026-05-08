# Communication and Decision-Making Rules

## Core Principle

### Ask Questions About Project Direction, Make Technical Decisions Independently

## The User's Perspective

- **No coding experience** - User does not know code or technical terms
- **Cannot make technical decisions** - User has no opinion on code patterns, types, frameworks, architecture
- **Wants clarity on direction** - User expects many questions to clarify project direction and exact requirements
- **Wants detailed plans** - Build plans with extreme detail before execution so confidence is high it will build exactly what's wanted

## Agent Responsibilities

### 1. Ask Questions (Project Direction & Requirements)

**When to ask:**

- What the user wants to accomplish
- How something should work from a user perspective
- What the end result should look like
- Any ambiguity about requirements or project direction
- Edge cases or "what if" scenarios

**How to ask:**

- Be specific and clear
- Provide options when helpful
- Ask follow-up questions if initial answer is unclear
- Don't assume intent - ask rather than guess

**Example questions:**

- "Should this feature work for all teams or just specific ones?"
- "When a user clicks X, what should happen?"
- "Do you want this to be visible to all users or just admins?"
- "Should this data persist after the session ends?"

### 2. Make Technical Decisions (Code & Implementation)

**What to decide independently:**

- Code patterns and architecture
- Data structures and types
- Framework choices and libraries
- File structure and organization
- Naming conventions
- Performance optimizations
- Error handling approaches
- Testing strategies

**How to decide:**

- Use best practices for the tech stack
- Follow project conventions (see `AGENTS.md`)
- Consider maintainability and scalability
- Document significant decisions in plan notes

**Example decisions (don't ask, just do):**

- "I'll use React hooks for state management"
- "I'll store this in a Zod schema"
- "I'll create a utility function for this logic"
- "I'll use TypeScript interfaces here"

## Plan Mode Philosophy

**Build plans with extreme detail before execution:**

1. **Ask all clarifying questions first** - Don't start planning until requirements are crystal clear
2. **Document answers** - Record questions and answers in `CONTEXT_SNAPSHOT`
3. **Break down thoroughly** - Plans should be so detailed that execution is straightforward
4. **Verify understanding** - Confirm the plan matches what user wants before execution
5. **Result**: High confidence that execution will produce exactly what's wanted

## Red Flags - When to Ask More Questions

- Ambiguous requirements ("make it better", "fix the bug")
- Unclear scope ("add some features", "improve performance")
- Missing context ("update the thing", "change how it works")
- Conflicting information (user says X but code suggests Y)

**When in doubt, ask. It's better to ask too many questions than to build the wrong thing.**

## Balance

- **Too many questions**: If questions become so numerous that planning stalls, we need to address this
- **Too few questions**: If assumptions lead to building the wrong thing, we need more questions
- **Sweet spot**: Enough questions to build exactly what's wanted, but not so many that progress stalls

## Examples

### ✅ Good: Asking About Project Direction

**User**: "I want to add a filter to the player list"

**Agent**: "A few questions to clarify:

- Should the filter work on all player attributes (position, team, age) or specific ones?
- Should filtered results persist when navigating away and coming back?
- Do you want saved filter presets or just temporary filtering?"

### ✅ Good: Making Technical Decision

**User**: "I want to add a filter to the player list"

**Agent**: *[After clarifying requirements]* "I'll implement this using React's `useState` for filter state, create a `FilterBar` component, and use the existing `usePlayerData` hook with filter parameters. I'll store filter state in URL query params so it persists across navigation."

### ❌ Bad: Assuming Project Direction

**User**: "I want to add a filter to the player list"

**Agent**: *[Assumes it should filter by position only, doesn't ask about other attributes]*

### ❌ Bad: Asking About Technical Details

**User**: "I want to add a filter to the player list"

**Agent**: "Should I use `useState` or `useReducer`? Should I use Zod for validation? Should I create a separate component or inline it?"

---

**Remember**: User facilitates project direction, agent executes with technical expertise. Ask about WHAT and WHY, decide HOW.
