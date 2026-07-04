# QA Acceptance Checklist

Last updated: 2026-07-05

This checklist is the product QA baseline for the current Study Planner + TOPIK practice flow. It focuses on P0 and P1 only.

## Priority Rules

- P0: Blocks the main study flow, causes wrong learning content, leaks answers before submission, or makes saved progress unreliable.
- P1: Does not block the main flow, but creates obvious confusion, repeated wording, misleading labels, or poor recovery.

## P0 Test Cases

| ID | Scenario | Steps | Expected result | Current status |
| --- | --- | --- | --- | --- |
| P0-01 | Production loads latest version | Open `https://adaptive-study-planner-chi.vercel.app/` | Page loads the latest cache-busted `app.js`; no old local `127.0.0.1` version is used | Passed before latest local fix; needs post-deploy check |
| P0-02 | User-selected modules drive plan | In settings choose TOPIK I, select only `听力` and `阅读`, unselect `词汇` and `语法`, generate plan | Weekly plan contains only `听力`, `阅读`, and allowed `巩固练习`; no `词汇 / 语法` task appears | Passed |
| P0-03 | TOPIK material question does not leak answers | Open a reading material task and start practice | Before submission, only question material + stem + options are visible; no correct answer, Chinese explanation, or textbook notes are visible | Passed |
| P0-04 | Material image is the single question block | Start the TOPIK reading material task | Image path uses `assets/materials/topik1-reading/block-cn/block-*.png`; it shows one material block, not the full textbook page | Passed |
| P0-05 | Answer submission records correctness | Select an option and submit | System shows correct answer, user's choice if wrong, and explanation; button changes to next-question flow | Passed |
| P0-06 | Wrong answer enters review path | Answer at least one question incorrectly and complete the group | Wrong question should be available in the wrong-question/review data, and tomorrow focus should include wrong-question context | Passed locally after fix |
| P0-07 | Completing a study group updates task state | Complete all questions in one task | Task should show completed state, completed hours/progress should update, and reflection should only be available after completion | Passed locally |
| P0-08 | Day1 reward uses current Day1 visual | Complete first valid study check-in for a fresh user | Day1 should show the current "第一盏应援灯亮了" version using `day1-desktop.webp` / `day1-mobile.webp`, not the old full-screen reward copy | Passed locally for current Day1 copy; visual asset check remains post-deploy |
| P0-09 | Day7 reward state machine remains intact | Open Day7 reward preview or reach Day7 | Flow remains `pool → drawing → front → back → collected`; video does not own business state | Not covered in latest run |
| P0-10 | Static app syntax/deploy does not fail | Run JS syntax check and Vercel deploy | `node --check app.js` passes; Vercel deployment is ready | Syntax passed; deploy pending |

## P1 Test Cases

| ID | Scenario | Steps | Expected result | Current status |
| --- | --- | --- | --- | --- |
| P1-01 | Generated task titles are clean | Generate a plan with AI enabled | Cards should not repeat prefixes such as `巩固练习 巩固练习：...`; titles should be readable training points | Passed |
| P1-02 | Task detail avoids unnecessary clutter | Open a task card | Detail modal should focus on task info, question count, and start action; long flow explanation should be first-time only or visually secondary | Partial |
| P1-03 | Reflection appears after answering | Complete a practice group | Reflection input appears after completion, not before answering; it explains what reflection is for | Passed locally |
| P1-04 | Feedback labels are not misleading | Submit an answer | Feedback should label the stem as `题目要求`, not `题目内容`; material content remains in the image area | Passed |
| P1-05 | Chinese support is helpful but not premature | Submit an answer | Chinese translation/explanation appears after submission only; it explains why the correct option is correct | Passed |
| P1-06 | Listening practice has audio affordance | Start a listening task | Listening questions show a play button and do not show full transcript before answering | Passed locally |
| P1-07 | Audio quality note remains tracked | Start listening playback | Current browser TTS is acceptable only as prototype; production should later replace it with better audio | Known follow-up |
| P1-08 | Edit plan is not visually noisy | Open task detail and edit | Edit UI should show editable fields clearly, with secondary actions visually quiet | Needs polish |
| P1-09 | Cancel plan keeps visual trace | Cancel a task | Task remains on calendar with cancelled/struck state, not silently removed | Needs full regression |
| P1-10 | Meal-time warning is non-blocking | Edit task into lunch/dinner time | User sees a warning and can still confirm if they choose | Needs full regression |
| P1-11 | Date and week match today | Open the app on current date | Current day should highlight the actual current date and week; no stale week mismatch | Needs full regression |
| P1-12 | Empty progress state is honest | Open progress before answering | No fake accuracy, fake streak, or fake ability data is shown | Needs full regression |

## Current Acceptance Summary

- Passed in latest self-test:
  - Latest production version loaded.
  - TOPIK module selection now controls generated plan.
  - Reading material question uses single material block images.
  - Answers and Chinese explanations are hidden before submission.
  - Submitted answer feedback shows the correct option and explanation.
  - Generated task title prefix duplication is removed.

- Still needs focused regression:
  - Completing a full group verified locally: 1/5 correct produced 4 wrong-question entries, completed hours became 0.8h, progress became 7%.
  - Day1 reward appeared locally with current "第一盏应援灯亮了" copy.
  - Reflection placement after completion verified locally.
  - Listening task shows play button and hides transcript before answering.
  - Cancel/edit plan behavior.
  - Empty progress state.

## Acceptance Gate For Next Release

Before treating a version as ready for user testing:

1. All P0 cases must be `Passed`.
2. P1 cases may have known follow-ups, but no P1 issue should make a normal learner misunderstand what to do next.
3. The production URL must be checked after deploy, not only local preview.
4. If a data-changing test is run, record whether test data was created.
