# MentorAI Educational Enhancement Plan

## Overview

Transform MentorAI from a basic lesson-quiz app into an adaptive, engaging learning platform with rich content, dynamic difficulty, and mastery-based progression.

---

## 1. Enhanced Lesson Content Structure

### Current Problem
- Lessons are 1-paragraph text
- No interactivity or engagement
- Students read passively

### Proposed Solution
Each lesson becomes a multi-section interactive experience with distinct content types.

### Data Model

```typescript
interface LessonSection {
  type: 'intro' | 'concept' | 'example' | 'tryIt';
  content: string;           // Main text content
  problem?: string;         // Practice problem (for example/tryIt)
  solution?: string;        // Step-by-step solution
  hint?: string;           // Progressive hint for tryIt
  visualUrl?: string;      // Optional diagram/image
}

interface Lesson {
  id?: number;
  subject: Subject;
  grade: Grade;
  language: Language;
  title: string;
  topicId: string;         // Links to mastery tracking
  sections: LessonSection[];
  questions: Question[];
  createdAt: string;
  isPreloaded: boolean;
}
```

### Lesson Structure Example

```json
{
  "title": "Multiplying Fractions",
  "topicId": "multiply-fractions-7",
  "sections": [
    {
      "type": "intro",
      "content": "Imagine you have ½ a pizza and you want to share it equally with one friend. How much pizza does each person get? This is multiplying fractions! 🎂"
    },
    {
      "type": "concept",
      "content": "To multiply fractions, multiply the numerators together, then multiply the denominators. It's that simple! numerator × numerator / denominator × denominator"
    },
    {
      "type": "example",
      "problem": "2/3 × 3/4 = ?",
      "solution": "Step 1: Multiply numerators: 2 × 3 = 6\nStep 2: Multiply denominators: 3 × 4 = 12\nStep 3: Simplify: 6/12 = 1/2",
      "visualUrl": "diagram-fraction-multiplication"
    },
    {
      "type": "example",
      "problem": "1/2 × 2/3 = ?",
      "solution": "2 × 1 = 2 (numerators) and 3 × 2 = 6 (denominators). So 2/6 = 1/3 ✓"
    },
    {
      "type": "tryIt",
      "problem": "3/4 × 1/2 = ?",
      "hint": "Multiply top numbers, then bottom numbers. What do you get?",
      "solution": "3/8 - You got this! Great work! 🌟"
    }
  ]
}
```

### UX Implications
- Tabbed navigation: Read → Examples → Practice → Quiz
- Step-through examples with "Show Next Step" button
- Practice problems with instant feedback
- Progress bar showing sections completed

---

## 2. Adaptive Quiz System

### Current Problem
- Fixed 5 questions per lesson
- No difficulty variation
- No adaptation to student ability

### Proposed Solution
Dynamic question pool with difficulty escalation based on performance.

### Difficulty Levels

| Level | Name | Description | Trigger |
|-------|------|-------------|---------|
| 1 | Recall | Remember facts, basic concept recall | Start of topic |
| 2 | Apply | Use concept in new situation | 2+ correct in a row |
| 3 | Analyze | Multi-step, reasoning, transfer | 3+ correct on level 2 |

### Adaptive Flow

```
[Quiz Starts]
    ↓
Question Difficulty 1
    ↓
[Check: 2 correct in row?]
    ├─ Yes → Escalate to Difficulty 2
    └─ No → Stay at Difficulty 1
    ↓
[Check: 2 wrong in row?]
    ├─ Yes → De-escalate to Difficulty 1
    └─ No → Stay
    ↓
[15-20 questions answered OR mastery reached]
    ↓
[Evaluate: 80% on Difficulty 2+?]
    ├─ Yes → TOPIC MASTERED ✓
    └─ No → Review & retry
```

### Question Pool Management

- Generate 15-20 questions per topic (not just 5)
- Each question tagged with difficulty
- Track which questions student has seen
- If pool runs low during quiz, regenerate via Gemini
- Old questions expire after 7 days for fresh attempts

---

## 3. Mastery Tracking System

### Data Model

```typescript
interface TopicMastery {
  id?: number;
  topicId: string;
  subject: Subject;
  grade: Grade;
  
  // Progress
  totalAttempts: number;
  totalQuestions: number;
  correctFirstTry: number;
  
  // Current State
  currentDifficulty: 1 | 2 | 3;
  questionsPooled: number;
  
  // Mastery Status
  mastered: boolean;
  masteredAt?: string;
  lastAttempt: string;
}

interface StudentSkillProfile {
  nickname: string;
  topicMasteries: Map<string, TopicMastery>;
}
```

### Mastery Criteria

**Topic is mastered when**:
1. Student answers 80% correctly
2. At least 3 questions were difficulty 2 or higher
3. No more than 2 hints used across the attempt
4. Minimum 10 questions answered

**Mastery NOT achieved**:
- Score below 80%
- Too many hints (3+)
- Questions were mostly difficulty 1 only

### On Mastery Achieved
- Celebrate with animation + confetti
- Award bonus XP (25-50 bonus)
- Update topic as "complete" in sidebar
- Recommend next topic in sequence

---

## 4. Gemini Prompt Updates

### Current Prompt (generateLesson)
```typescript
// PROBLEM: Only generates 5 questions, no difficulty tags
// Hardcodes difficulty: 1
// Returns flat content
```

### New Prompt Requirements
1. Generate 15-20 questions per topic
2. Tag each question with difficulty 1, 2, or 3
3. Create rich lesson sections (intro, concept, 2+ examples, tryIt)
4. Include worked solutions for examples

### New Prompt Template

```
Generate a complete lesson on [TOPIC] for grade [GRADE] student.

Requirements:
- 4-5 lesson sections:
  1. Intro: Engaging hook (1-2 sentences, real-world connection)
  2. Concept: Key idea explained simply (2-3 sentences)
  3. Example 1: Problem + full step-by-step solution
  4. Example 2: Another worked problem
  5. Try It: Practice problem with progressive hint

- Generate 15-20 quiz questions:
  - 5 at difficulty 1 (recall, basic)
  - 7 at difficulty 2 (apply concepts)
  - 5-6 at difficulty 3 (multi-step, reasoning)

- For each question:
  {
    "prompt": "question text",
    "choices": ["A", "B", "C", "D"],
    "correctIndex": 0-3,
    "hint": "one sentence hint",
    "difficulty": 1 | 2 | 3
  }

- Return ONLY valid JSON, no markdown wrapper
```

---

## 5. Files to Modify

| File | Changes |
|------|---------|
| `src/types.ts` | Add `LessonSection`, `TopicMastery`, update `Question` |
| `src/db.ts` | Add tables for question bank, mastery, update queries |
| `src/gemini.ts` | Update prompts for 15-20 questions, difficulty tags |
| `src/screens/lesson.ts` | Render multi-section lessons with interactives |
| `src/screens/quiz.ts` | Adaptive difficulty, mastery tracking |
| `src/main.ts` | Wire up mastery display |
| `lessons/*.json` | Expand to new multi-section structure |

---

## 6. UX Enhancement Details

### Lesson View
- **Section tabs**: Read | Examples | Practice | Quiz
- **Progress dots**: Show completed sections
- **Interactive examples**: "Show Step" buttons reveal solution progressively
- **Sticky tutor**: AI tutor available on right panel throughout

### Quiz View
- **Difficulty badge**: Show current level (🥉 1 | 🥈 2 | 🥇 3)
- **Streak indicator**: "2 correct in a row!" toast
- **Adaptive messages**:
  - On struggle: "Let's try an easier one"
  - On escalation: "You're ready for a challenge!"
  - On mastery: "You mastered this! 🎉"

### Dashboard Updates
- Show mastered topics with checkmarks
- Display "In Progress" for active topics
- Suggest "Up Next" based on topic sequence

---

## 7. Content Requirements

### Current State
- 10 lessons (5 math, 5 ela)
- ~50 questions total

### Target State (per grade)
| Subject | Topics | Questions/Topic | Total Questions |
|--------|--------|-----------------|----------------|
| Math | 8-10 | 15-20 | 150-200 |
| ELA | 8-10 | 15-20 | 150-200 |

### Priority Topics per Grade

| Grade | Math Topics | ELA Topics |
|-------|-----------|----------|
| 6 | Fractions, Decimals, Division, Multiplication, Area/Perimeter, Angles, Data/Graphs, Ratios | Main Idea, Context Clues, Sequencing, Characters, Plot, Compare/Contrast, Poetry, Author's Purpose |
| 7 | Integers, Equations, Inequalities, Proportions, Probability, Angles, Geometric Shapes | Theme, Inference, Text Structure, Argument, Evidence, Vocabulary, Literary Devices, Summarizing |
| 8 | Algebra, Linear Equations, Functions, Pythagorean Theorem, Transformations, Volume, Scatter Plots | Argumentative Writing, Rhetorical Devices, Citing Evidence, Text Analysis, Speech Analysis, Vocabulary in Context |

---

## 8. Implementation Phases

### Phase 1: Data Models & Types (1 day)
- [ ] Update `types.ts` with new interfaces
- [ ] Update `db.ts` with new tables

### Phase 2: Gemini Integration (1 day)
- [ ] Update lesson generation prompts
- [ ] Update question generation to 15-20 with difficulty
- [ ] Add to question bank on generation

### Phase 3: Lesson UI (2 days)
- [ ] Multi-section lesson renderer
- [ ] Interactive examples with step-through
- [ ] Section progress tracking

### Phase 4: Quiz Engine (2 days)
- [ ] Adaptive difficulty logic
- [ ] Question pool management
- [ ] Mastery evaluation
- [ ] Celebration flow

### Phase 5: Content Creation (ongoing)
- [ ] Expand lessons directory with new structure
- [ ] Generate via Gemini for full coverage
- [ ] Manual review and refinement

---

## 9. Success Metrics

| Metric | Target |
|--------|--------|
| Average quiz completion rate | > 80% |
| Average mastery achieved | > 60% first attempt |
| Questions per session | 15-20 |
| Student engagement (return rate) | > 70% |
| Hint usage | < 2 per quiz |

---

*Plan created: 2026-04-26*